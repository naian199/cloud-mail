import BizError from '../error/biz-error';
import userContext from '../security/user-context';
import settingService from './setting-service';
import mailChat from './mail-chat-service';
import cloudFile, { apptypeOf, costaction, unavailable, PREVIEW_DAYS } from './cloud-file-service';
import { CostActionError } from '../lib/costaction.mjs';

// Uploads of large attachments to CostAction, from the chat composer.
//
// begin    registers the file: a cloud_file record (the original) and a draft attachments row
//          (the composer's link to it). A client request ID makes a retry reuse both.
// upload   the browser posts the file to this Worker, which streams it to a one-time upload
//          URL in Cloud-Mail/<category>/<year>/<month>, then verifies it with the API.
// send     the draft link becomes the message's link (mail-chat-service / mail-live-service).
//
// The API token and upload URLs stay on the server. Rows use attachments.storage = 'costaction';
// every other attachment keeps storage = '' and the deployment's existing R2/S3/KV path.

const STORAGE = 'costaction';
const fail = (message, code = 400) => { throw new BizError(message, code); };
const positiveId = (value) => {
	const n = Number(value);
	if (!Number.isSafeInteger(n) || n < 1) fail('Invalid ID / 无效编号');
	return n;
};

async function policy(c) {
	const setting = await settingService.query(c);
	const userId = userContext.getUserId(c);
	const user = await c.env.db.prepare('SELECT email, type FROM user WHERE user_id = ? AND is_del = 0 AND status = 0').bind(userId).first();
	if (!user) fail('Unauthorized', 403);
	// An empty role list means administrators only.
	const roles = String(setting.costactionRoles || '').split(',').filter(Boolean).map(Number);
	const allowed = user.email === c.env.admin || roles.includes(user.type);
	const enabled = setting.costactionStatus === 0 && !!setting.costactionToken;
	return { setting, userId, isAdmin: user.email === c.env.admin, enabled, allowed };
}

// The composer's draft row for an upload, with its file.
async function draft(c, attId, userId) {
	return c.env.db
		.prepare(
			`SELECT a.att_id AS attId, a.file_id AS fileId, a.size, a.remote_status AS status, f.category, f.apptype, f.status AS fileStatus
      FROM attachments a JOIN cloud_file f ON f.file_id = a.file_id
      WHERE a.att_id = ? AND a.user_id = ? AND a.storage = ? AND a.email_id = 0`
		)
		.bind(attId, userId, STORAGE)
		.first();
}

const largeAtt = {
	// What the composer needs to decide whether to offer large uploads.
	async config(c) {
		const { setting, enabled, allowed } = await policy(c);
		return { enabled: enabled && allowed, minSize: setting.costactionMinSize, maxSize: setting.costactionMaxSize, previewDays: PREVIEW_DAYS };
	},

	async begin(c, params) {
		const { setting, userId, enabled, allowed } = await policy(c);
		if (!enabled) fail('Large attachments are disabled / 大附件未启用', 403);
		if (!allowed) fail('Unauthorized / 无权使用大附件', 403);
		const account = await mailChat.account(c, params?.accountId);
		const filename = typeof params.filename === 'string' ? params.filename.trim() : '';
		if (!filename || filename.length > 200 || /[\r\n\\/]/.test(filename)) fail('Invalid file name / 文件名无效');
		const size = Number(params.size);
		if (!Number.isSafeInteger(size) || size < setting.costactionMinSize || size > setting.costactionMaxSize)
			fail('File size outside the large attachment limits / 文件大小不符合大附件限制');
		if (typeof params.clientId !== 'string' || !/^[a-zA-Z0-9_-]{16,80}$/.test(params.clientId))
			fail('Invalid request ID / 无效请求标识');
		const mime = typeof params.mimeType === 'string' && /^[\w.+-]+\/[\w.+-]+$/.test(params.mimeType) ? params.mimeType.toLowerCase().slice(0, 100) : 'application/octet-stream';

		// One file and one draft row per client request: a retry reuses them.
		const existing = await c.env.db
			.prepare('SELECT att_id AS attId, file_id AS fileId, remote_status AS status, filename, size FROM attachments WHERE user_id = ? AND client_key = ?')
			.bind(userId, params.clientId)
			.first();
		if (existing && (existing.filename !== filename || existing.size !== size)) fail('Request ID already used / 请求标识已使用', 409);
		if (existing?.status === 'ready') return { attId: existing.attId, fileId: existing.fileId, status: 'ready' };
		if (existing && !['uploading', 'failed'].includes(existing.status)) fail('Attachment unavailable / 附件不可用', 409);
		if (existing?.fileId) {
			await c.env.db.batch([
				c.env.db.prepare("UPDATE attachments SET remote_status = 'uploading' WHERE att_id = ? AND user_id = ?").bind(existing.attId, userId),
				c.env.db.prepare("UPDATE cloud_file SET status = 'uploading' WHERE file_id = ? AND status = 'failed'").bind(existing.fileId)
			]);
			return { attId: existing.attId, fileId: existing.fileId, status: 'uploading' };
		}
		const file = await c.env.db
			.prepare(
				`INSERT INTO cloud_file(uploader_id, client_key, apptype, filename, size, mime_type, category) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(uploader_id, client_key) WHERE client_key != '' DO UPDATE SET status = 'uploading' RETURNING file_id AS fileId`
			)
			.bind(userId, params.clientId, apptypeOf(setting), filename, size, mime, cloudFile.categoryOf(filename, mime))
			.first();
		let attId = existing?.attId;
		if (attId) {
			await c.env.db.prepare("UPDATE attachments SET file_id = ?, remote_status = 'uploading' WHERE att_id = ?").bind(file.fileId, attId).run();
		} else {
			const row = await c.env.db
				.prepare(
					`INSERT INTO attachments(user_id, account_id, email_id, key, filename, size, mime_type, type, storage, remote_status, client_key, file_id)
          VALUES (?, ?, 0, ?, ?, ?, ?, 0, ?, 'uploading', ?, ?) RETURNING att_id AS attId`
				)
				.bind(userId, account.account_id, `${STORAGE}:pending:${crypto.randomUUID()}`, filename, size, mime, STORAGE, params.clientId, file.fileId)
				.first();
			attId = row.attId;
		}
		return { attId, fileId: file.fileId, status: 'uploading' };
	},

	// Relays the browser's multipart upload to a fresh upload URL, then verifies it.
	// The programs' upload hosts answer the CORS preflight without allow headers, so browsers
	// cannot post to them directly; the request body is streamed through, never buffered.
	async upload(c, rawId) {
		const { setting, userId, enabled, allowed } = await policy(c);
		if (!enabled) fail('Large attachments are disabled / 大附件未启用', 403);
		if (!allowed) fail('Unauthorized / 无权使用大附件', 403);
		const attId = positiveId(rawId);
		const row = await draft(c, attId, userId);
		if (!row) fail('Attachment unavailable / 附件不可用', 404);
		// Already uploaded (a retry after a lost reply): never upload the original again.
		if (row.status === 'ready') return { attId, fileId: row.fileId, status: 'ready' };
		if (row.status !== 'uploading') fail('Attachment unavailable / 附件不可用', 409);
		const type = c.req.header('content-type') || '';
		const length = Number(c.req.header('content-length'));
		// The multipart envelope adds a little to the file itself.
		if (!/^multipart\/form-data;\s*boundary=/i.test(type) || !Number.isSafeInteger(length) || length < row.size || length > row.size + 64 * 1024 || !c.req.raw.body)
			fail('Invalid upload / 上传请求无效');
		const api = costaction(c, setting, row.apptype);
		let upload, folderId;
		try {
			folderId = await cloudFile.folderFor(c, api, row.apptype, row.category, Math.floor(Date.now() / 1000));
			upload = await api.requestUploadUrl(folderId);
		} catch (error) {
			unavailable(error);
		}
		const { readable, writable } = new FixedLengthStream(length);
		const piping = c.req.raw.body.pipeTo(writable).catch(() => {});
		let remoteId = '';
		try {
			const response = await fetch(upload.url, { method: 'POST', headers: { 'Content-Type': type }, body: readable });
			const data = await response.json().catch(() => ({}));
			if (response.ok && data.status === 'success' && typeof data.id === 'string') remoteId = data.id;
		} catch {}
		await piping;
		if (!remoteId) fail('Upload to the storage service failed, try again / 上传到存储服务失败，请重试', 502);
		await c.env.db.prepare('UPDATE cloud_file SET folder_id = ? WHERE file_id = ?').bind(folderId, row.fileId).run();
		return this.complete(c, { attId, remoteId });
	},

	// Trusts nothing about the upload until the API confirms the file and its size.
	async complete(c, params) {
		const { setting, userId } = await policy(c);
		const attId = positiveId(params?.attId);
		const remoteId = typeof params.remoteId === 'string' ? params.remoteId.trim() : '';
		if (!/^[a-zA-Z0-9]{4,64}$/.test(remoteId)) fail('Invalid file ID / 文件编号无效');
		const row = await draft(c, attId, userId);
		if (!row) fail('Attachment unavailable / 附件不可用', 404);
		if (row.status === 'ready') return { attId, fileId: row.fileId, status: 'ready' };
		// A remote file can back only one upload, so one user cannot claim another's file.
		const claimed = await c.env.db.prepare('SELECT 1 FROM cloud_file WHERE remote_id = ? AND file_id != ? LIMIT 1').bind(remoteId, row.fileId).first();
		if (claimed) fail('File already registered / 文件已登记', 409);
		let info;
		try {
			info = await costaction(c, setting, row.apptype).fileInfo(remoteId);
		} catch (error) {
			if (error instanceof CostActionError && error.status === 404) fail('Uploaded file not found / 未找到已上传的文件', 404);
			unavailable(error);
		}
		if (info.deleted || info.size !== row.size) {
			await c.env.db.batch([
				c.env.db.prepare("UPDATE attachments SET remote_status = 'failed' WHERE att_id = ?").bind(attId),
				c.env.db.prepare("UPDATE cloud_file SET status = 'failed' WHERE file_id = ?").bind(row.fileId)
			]);
			fail('Uploaded file does not match / 上传的文件不一致', 409);
		}
		const at = Math.floor(Date.now() / 1000);
		await c.env.db.batch([
			c.env.db
				.prepare("UPDATE cloud_file SET remote_id = ?, status = 'ready', ready_at = ?, preview_until = ? WHERE file_id = ?")
				.bind(remoteId, at, at + PREVIEW_DAYS * 86400, row.fileId),
			c.env.db
				.prepare("UPDATE attachments SET remote_id = ?, key = ?, remote_status = 'ready' WHERE att_id = ? AND user_id = ?")
				.bind(remoteId, `${STORAGE}:${remoteId}`, attId, userId)
		]);
		await cloudFile.collect(c, userId, row.fileId, 'uploaded');
		return { attId, fileId: row.fileId, status: 'ready', daysLeft: info.daysLeft };
	},

	async markFailed(c, params) {
		const userId = userContext.getUserId(c);
		const row = await draft(c, positiveId(params?.attId), userId);
		if (!row || row.status !== 'uploading') return;
		await c.env.db.batch([
			// Guarded: an upload that completed meanwhile stays ready.
			c.env.db.prepare("UPDATE attachments SET remote_status = 'failed' WHERE att_id = ? AND remote_status = 'uploading'").bind(row.attId),
			c.env.db.prepare("UPDATE cloud_file SET status = 'failed' WHERE file_id = ? AND status = 'uploading'").bind(row.fileId)
		]);
	},

	// Older clients: the download page for a message's attachment, by attachment ID.
	async link(c, rawId) {
		const row = await c.env.db
			.prepare("SELECT file_id AS fileId FROM attachments WHERE att_id = ? AND user_id = ? AND storage = ? AND file_id != 0")
			.bind(positiveId(rawId), userContext.getUserId(c), STORAGE)
			.first();
		if (!row) fail('Attachment unavailable / 附件不可用', 404);
		return cloudFile.download(c, row.fileId);
	},

	// Removes a large attachment from the composer before it is sent. Only the draft link goes:
	// an uploaded file stays in the uploader's library and with CostAction.
	async remove(c, rawId) {
		const userId = userContext.getUserId(c);
		const row = await draft(c, positiveId(rawId), userId);
		if (!row) return;
		const statements = [c.env.db.prepare('DELETE FROM attachments WHERE att_id = ? AND email_id = 0').bind(row.attId)];
		if (row.fileStatus !== 'ready') statements.push(c.env.db.prepare("UPDATE cloud_file SET status = 'failed' WHERE file_id = ? AND status = 'uploading'").bind(row.fileId));
		await c.env.db.batch(statements);
	},

	// Admin connection test with the saved token, or with one typed into the form before saving.
	async testConnection(c, params) {
		const setting = await settingService.query(c);
		const typed = typeof params?.token === 'string' ? params.token.trim() : '';
		const token = typed || setting.costactionToken;
		if (!token) return { ok: false, reason: 'missing' };
		return costaction(c, { ...setting, costactionToken: token }).testConnection();
	},

	// Validates large attachments named by a chat send: the sender's own and uploaded, either not
	// yet sent or already on the message this same request committed (a retry after a lost reply).
	async forSend(c, account, rawIds, requestKey) {
		if (rawIds === undefined) return [];
		if (!Array.isArray(rawIds) || rawIds.length > 5) fail('Too many large attachments / 最多 5 个大附件');
		const ids = [...new Set(rawIds.map(positiveId))];
		if (!ids.length) return [];
		const { results } = await c.env.db
			.prepare(
				`SELECT att_id AS attId, filename, size, mime_type AS mimeType, remote_id AS remoteId, file_id AS fileId FROM attachments
        WHERE user_id = ? AND account_id = ? AND storage = ? AND remote_status = 'ready' AND file_id != 0
        AND (email_id = 0 OR email_id = (SELECT email_id FROM email WHERE send_key = ? AND user_id = ?))
        AND att_id IN (${ids.map(() => '?').join(',')})`
			)
			.bind(account.user_id, account.account_id, STORAGE, requestKey, account.user_id, ...ids)
			.all();
		if (results.length !== ids.length) fail('Large attachment unavailable / 大附件不可用', 409);
		return results;
	}
};

export default largeAtt;
export { STORAGE };
