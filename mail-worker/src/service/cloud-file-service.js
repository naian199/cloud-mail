import BizError from '../error/biz-error';
import userContext from '../security/user-context';
import settingService from './setting-service';
import r2Service from './r2-service';
import { createCostAction, memoryRateLimiter, CostActionError, APPTYPES } from '../lib/costaction.mjs';
import { CATEGORIES, categoryOf, folderPath } from '../lib/cloud-file-paths.mjs';

// CostAction file service and personal document library (see init/cloud-file-schema.js).
//
//   - Originals live with CostAction. This site never serves or proxies them: every download
//     goes to the program's official share page, as the API returns it.
//   - The site keeps only a small preview (image thumbnail / video cover), for 7 days after
//     the upload succeeds. After that the card stays and downloads still work.
//   - A user's library (user_file) collects a file when they upload it, actively open its
//     preview or click download. Messages scrolling into view do not count.
//   - Chat deletion removes message links only; the library and the original are untouched.

const DAY = 86400;
export const PREVIEW_DAYS = 7;
const PREVIEW_MAX = 512 * 1024;
const PREVIEW_TYPES = ['image/webp', 'image/jpeg', 'image/png'];

export { CATEGORIES, categoryOf, folderPath };

const fail = (message, code = 400) => { throw new BizError(message, code); };
const now = () => Math.floor(Date.now() / 1000);
const positiveId = (value) => {
	const n = Number(value);
	if (!Number.isSafeInteger(n) || n < 1) fail('Invalid ID / 无效编号');
	return n;
};

// One window per isolate, shared by every request it serves (account limit: 60/min).
const rateWindow = [];

export function apptypeOf(setting) {
	return APPTYPES.includes(setting?.costactionApptype) ? setting.costactionApptype : 'fd1';
}

export function costaction(c, setting, apptype = apptypeOf(setting)) {
	return createCostAction({
		token: setting.costactionToken,
		apptype,
		// Both unset in production; the integration test points them at a local mock.
		baseUrl: c.env.costaction_api_base || undefined,
		extraUploadOrigin: c.env.costaction_upload_origin || '',
		acquire: memoryRateLimiter({ window: rateWindow })
	});
}

// Vendor failures reach users as one short message; details stay out of responses and logs.
export function unavailable(error) {
	if (error instanceof BizError) throw error;
	if (error instanceof CostActionError && error.status === 429) fail('Large attachment service is busy, try again shortly / 大附件服务繁忙，请稍后再试', 429);
	fail('Large attachment service unavailable, try again / 大附件服务暂不可用，请重试', 502);
}

const MARKS = { uploaded: 'uploaded', viewed: 'viewed', downloaded: 'downloaded' };

const cloudFile = {
	categoryOf,

	// Adds the file to the user's library with a mark, or adds the mark and refreshes the
	// last-access time when it is there already. One row per user and file.
	async collect(c, userId, fileId, mark) {
		const column = MARKS[mark];
		await c.env.db
			.prepare(`INSERT INTO user_file(user_id, file_id, ${column}, last_access) VALUES (?, ?, 1, unixepoch())
        ON CONFLICT(user_id, file_id) DO UPDATE SET ${column} = 1, last_access = unixepoch()`)
			.bind(userId, fileId)
			.run();
	},

	// The remote folder ID for Cloud-Mail/<category>/<year>/<month>, created on first use and
	// cached. Returns 0 (the account's Inbox) when the folders cannot be resolved, so a folder
	// problem never blocks an upload.
	async folderFor(c, api, apptype, category, time) {
		const parts = folderPath(category, time);
		const path = parts.join('/');
		const cached = await c.env.db.prepare('SELECT folder_id FROM cloud_folder WHERE apptype = ? AND path = ?').bind(apptype, path).first();
		if (cached) return cached.folder_id;
		try {
			let parent = null;
			for (let i = 0; i < parts.length; i++) {
				const prefix = parts.slice(0, i + 1).join('/');
				const known = await c.env.db.prepare('SELECT folder_id FROM cloud_folder WHERE apptype = ? AND path = ?').bind(apptype, prefix).first();
				let id = known?.folder_id ?? null;
				if (!id) {
					// Concurrent uploads may race to create the same folder: 422 means it exists.
					id = (await api.createFolder(parts[i], parent)) ?? (await api.findFolder(parts[i], parent));
					if (!id) return 0;
					await c.env.db.prepare('INSERT OR IGNORE INTO cloud_folder(apptype, path, folder_id) VALUES (?, ?, ?)').bind(apptype, prefix, id).run();
				}
				parent = id;
			}
			return parent;
		} catch (error) {
			console.warn('CostAction folder unavailable, using Inbox');
			return 0;
		}
	},

	// The file, if the user may reach it: it is in their library, or it is linked to a message in
	// one of their mailboxes that still exists, or to their own unsent draft.
	async accessible(c, userId, rawId) {
		const fileId = positiveId(rawId);
		const row = await c.env.db
			.prepare(
				`SELECT f.* FROM cloud_file f WHERE f.file_id = ? AND (
          EXISTS (SELECT 1 FROM user_file u WHERE u.user_id = ? AND u.file_id = f.file_id)
          OR EXISTS (SELECT 1 FROM attachments a LEFT JOIN email e ON e.email_id = a.email_id
            WHERE a.file_id = f.file_id AND a.user_id = ? AND a.storage = 'costaction'
            AND ((a.email_id = 0 AND a.client_key != '') OR (e.user_id = a.user_id AND e.is_del = 0))))`
			)
			.bind(fileId, userId, userId)
			.first();
		if (!row) fail('File unavailable / 文件不可用', 404);
		return row;
	},

	previewState(file, at = now()) {
		if (file.preview_status === 'ready' && file.preview_key && file.preview_until > at) return 'ready';
		if (file.preview_status === 'expired' || (file.preview_key && file.preview_until <= at)) return 'expired';
		return 'none';
	},

	// Marks the remote file as gone, everywhere it is shown, once the API has confirmed it.
	async markGone(c, file, status) {
		await c.env.db.batch([
			c.env.db.prepare('UPDATE cloud_file SET status = ? WHERE file_id = ?').bind(status, file.file_id),
			c.env.db.prepare("UPDATE attachments SET remote_status = ? WHERE file_id = ? AND storage = 'costaction'").bind(status, file.file_id)
		]);
	},

	// The official share page for a file. Clicking counts as "clicked download" in the library;
	// it is not a completed download.
	async download(c, rawId) {
		const userId = userContext.getUserId(c);
		const file = await this.accessible(c, userId, rawId);
		if (file.status !== 'ready') fail('File is no longer available / 文件已失效', 410);
		const setting = await settingService.query(c);
		if (!setting.costactionToken) fail('Large attachment service unavailable / 大附件服务暂不可用', 503);
		const api = costaction(c, setting, file.apptype);
		let info, url;
		try {
			info = await api.fileInfo(file.remote_id);
			if (!info.deleted) url = await api.downloadLink(file.remote_id);
		} catch (error) {
			// Only the API's own answer that the file does not exist marks it gone.
			if (error instanceof CostActionError && error.status === 404) {
				await this.markGone(c, file, 'deleted');
				fail('File is no longer available / 文件已失效', 410);
			}
			unavailable(error);
		}
		if (info.deleted) {
			await this.markGone(c, file, info.deleteReason === 'lifetime' ? 'expired' : 'deleted');
			fail('File is no longer available / 文件已失效', 410);
		}
		await this.collect(c, userId, file.file_id, 'downloaded');
		return { url, daysLeft: info.daysLeft };
	},

	// Opening a preview on purpose collects the file as "viewed".
	async view(c, rawId) {
		const userId = userContext.getUserId(c);
		const file = await this.accessible(c, userId, rawId);
		await this.collect(c, userId, file.file_id, 'viewed');
		return { preview: this.previewState(file) };
	},

	async previewObject(c, rawId) {
		const file = await this.accessible(c, userContext.getUserId(c), rawId);
		if (this.previewState(file) !== 'ready') fail('Preview expired / 预览已到期', 410);
		const object = await r2Service.getObj(c, file.preview_key);
		if (!object) fail('Preview unavailable / 预览不可用', 404);
		return { body: object.body, type: file.preview_type };
	},

	// The uploader stores a small preview generated in the browser. A failure here never touches
	// the original, which is already uploaded.
	async putPreview(c, rawId) {
		const userId = userContext.getUserId(c);
		const fileId = positiveId(rawId);
		const file = await c.env.db.prepare('SELECT * FROM cloud_file WHERE file_id = ? AND uploader_id = ?').bind(fileId, userId).first();
		if (!file) fail('File unavailable / 文件不可用', 404);
		if (file.status !== 'ready' || file.preview_until <= now()) fail('Preview not accepted / 不接受预览', 409);
		if (file.preview_status === 'ready') return { preview: 'ready' };
		const type = (c.req.header('content-type') || '').split(';')[0].trim().toLowerCase();
		const length = Number(c.req.header('content-length'));
		if (!PREVIEW_TYPES.includes(type) || !Number.isSafeInteger(length) || length < 1 || length > PREVIEW_MAX) fail('Invalid preview / 预览无效');
		const body = await c.req.arrayBuffer();
		if (body.byteLength !== length) fail('Invalid preview / 预览无效');
		const key = `cloud-preview/${fileId}-${crypto.randomUUID()}`;
		await r2Service.putObj(c, key, body, { contentType: type });
		const updated = await c.env.db
			.prepare("UPDATE cloud_file SET preview_key = ?, preview_type = ?, preview_status = 'ready' WHERE file_id = ? AND preview_key = ''")
			.bind(key, type, fileId)
			.run();
		// Another request stored one first: keep that one.
		if (!updated.meta?.changes) await r2Service.delete(c, key).catch(() => {});
		return { preview: 'ready' };
	},

	async list(c, query = {}) {
		const userId = userContext.getUserId(c);
		const where = ['u.user_id = ?'];
		const binds = [userId];
		const q = typeof query.q === 'string' ? query.q.trim().slice(0, 100) : '';
		if (q) {
			where.push("f.filename LIKE ? ESCAPE '\\'");
			binds.push(`%${q.replace(/[\\%_]/g, (m) => '\\' + m)}%`);
		}
		if (query.category && CATEGORIES[query.category]) {
			where.push('f.category = ?');
			binds.push(query.category);
		}
		if (['uploaded', 'viewed', 'downloaded'].includes(query.mark)) where.push(`u.${query.mark} = 1`);
		const order = { name: 'f.filename COLLATE NOCASE ASC', size: 'f.size DESC', recent: 'u.last_access DESC' }[query.sort] || 'u.last_access DESC';
		const page = Math.max(1, Math.min(1000, Number(query.page) || 1));
		const size = 30;
		const { results } = await c.env.db
			.prepare(
				`SELECT f.file_id, f.filename, f.size, f.mime_type, f.category, f.status, f.preview_key, f.preview_status, f.preview_until, f.create_time,
          u.uploaded, u.viewed, u.downloaded, u.last_access
        FROM user_file u JOIN cloud_file f ON f.file_id = u.file_id
        WHERE ${where.join(' AND ')} ORDER BY ${order}, f.file_id DESC LIMIT ? OFFSET ?`
			)
			.bind(...binds, size + 1, (page - 1) * size)
			.all();
		const at = now();
		return {
			hasMore: results.length > size,
			list: results.slice(0, size).map((f) => ({
				fileId: f.file_id,
				filename: f.filename,
				size: f.size,
				mimeType: f.mime_type,
				category: f.category,
				status: f.status,
				preview: this.previewState(f, at),
				uploaded: !!f.uploaded,
				viewed: !!f.viewed,
				downloaded: !!f.downloaded,
				lastAccess: f.last_access,
				createTime: f.create_time
			}))
		};
	},

	// Removes the user's own library entry only: other users' entries, message links and the
	// remote original stay.
	async removeEntry(c, rawId) {
		await c.env.db.prepare('DELETE FROM user_file WHERE user_id = ? AND file_id = ?').bind(userContext.getUserId(c), positiveId(rawId)).run();
	},

	// Hourly: drop previews 7 days after upload, and give up on uploads stuck for a day.
	async cleanup(c) {
		const at = now();
		const { results } = await c.env.db
			.prepare("SELECT file_id, preview_key FROM cloud_file WHERE preview_key != '' AND preview_until <= ? LIMIT 200")
			.bind(at)
			.all();
		for (const row of results) {
			try {
				await r2Service.delete(c, row.preview_key);
			} catch {
				continue; // Try again next hour; the preview is already refused after preview_until.
			}
			await c.env.db.prepare("UPDATE cloud_file SET preview_key = '', preview_status = 'expired' WHERE file_id = ? AND preview_key = ?").bind(row.file_id, row.preview_key).run();
		}
		await c.env.db.batch([
			c.env.db.prepare("UPDATE cloud_file SET status = 'failed' WHERE status = 'uploading' AND create_time < ?").bind(at - DAY),
			c.env.db.prepare("UPDATE attachments SET remote_status = 'failed' WHERE storage = 'costaction' AND remote_status = 'uploading' AND email_id = 0 AND file_id IN (SELECT file_id FROM cloud_file WHERE status = 'failed')")
		]);
	}
};

export default cloudFile;
