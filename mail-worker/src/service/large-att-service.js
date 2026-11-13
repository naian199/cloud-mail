import BizError from '../error/biz-error';
import userContext from '../security/user-context';
import settingService from './setting-service';
import mailChat from './mail-chat-service';
import { createCostAction, kvRateLimiter, CostActionError } from '../lib/costaction.mjs';

// Large attachments kept with CostAction/Turbobit (apptype fd1).
//
// The browser asks for a one-time upload URL here, posts the file straight to it, then
// reports the remote file ID, which is checked against the API before the attachment
// counts as ready. The API token stays on the server; the browser only ever sees the
// one-time upload URL and, later, a Turbobit download page.
//
// Rows use attachments.storage = 'costaction'. Everything else keeps storage = '' and
// the deployment's existing R2/S3/KV path.

const STORAGE = 'costaction';
const fail = (message, code = 400) => { throw new BizError(message, code); };
const positiveId = (value) => {
	const n = Number(value);
	if (!Number.isSafeInteger(n) || n < 1) fail('Invalid ID / 无效编号');
	return n;
};
// Vendor failures reach users as one short message; details stay out of responses and logs.
const unavailable = (error) => {
	if (error instanceof BizError) throw error;
	const status = error instanceof CostActionError && error.status === 429 ? 429 : 502;
	fail(status === 429 ? 'Large attachment service is busy, try again shortly / 大附件服务繁忙，请稍后再试' : 'Large attachment service unavailable / 大附件服务暂不可用', status);
};

function client(c, setting) {
	return createCostAction({
		token: setting.costactionToken,
		// Both unset in production; the integration test points them at a local mock.
		baseUrl: c.env.costaction_api_base || undefined,
		extraUploadOrigin: c.env.costaction_upload_origin || '',
		acquire: kvRateLimiter(c.env.kv, { sleep: (ms) => new Promise((r) => setTimeout(r, ms)) })
	});
}

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

const largeAtt = {
	// What the composer needs to decide whether to offer large uploads.
	async config(c) {
		const { setting, enabled, allowed } = await policy(c);
		return { enabled: enabled && allowed, minSize: setting.costactionMinSize, maxSize: setting.costactionMaxSize };
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

		// One row per client request: a retry reuses it and never creates a second record.
		const existing = await c.env.db
			.prepare('SELECT att_id AS attId, remote_status AS status, filename, size FROM attachments WHERE user_id = ? AND client_key = ?')
			.bind(userId, params.clientId)
			.first();
		if (existing && (existing.filename !== filename || existing.size !== size)) fail('Request ID already used / 请求标识已使用', 409);
		if (existing?.status === 'ready') return { attId: existing.attId, status: 'ready' };
		if (existing && !['uploading', 'failed'].includes(existing.status)) fail('Attachment unavailable / 附件不可用', 409);

		let upload;
		try {
			upload = await client(c, setting).requestUploadUrl();
		} catch (error) {
			unavailable(error);
		}
		let attId = existing?.attId;
		if (attId) {
			await c.env.db.prepare("UPDATE attachments SET remote_status = 'uploading' WHERE att_id = ? AND user_id = ?").bind(attId, userId).run();
		} else {
			const row = await c.env.db
				.prepare(
					`INSERT INTO attachments(user_id, account_id, email_id, key, filename, size, mime_type, type, storage, remote_status, client_key)
          VALUES (?, ?, 0, ?, ?, ?, 'application/octet-stream', 0, ?, 'uploading', ?) RETURNING att_id AS attId`
				)
				.bind(userId, account.account_id, `${STORAGE}:pending:${crypto.randomUUID()}`, filename, size, STORAGE, params.clientId)
				.first();
			attId = row.attId;
		}
		return { attId, status: 'uploading', uploadUrl: upload.url, expire: upload.expire };
	},

	// Called after the browser's upload; trusts nothing it sends until the API confirms the file.
	async complete(c, params) {
		const { setting, userId } = await policy(c);
		const attId = positiveId(params?.attId);
		const remoteId = typeof params.remoteId === 'string' ? params.remoteId.trim() : '';
		if (!/^[a-zA-Z0-9]{4,64}$/.test(remoteId)) fail('Invalid file ID / 文件编号无效');
		const row = await c.env.db
			.prepare(`SELECT att_id, filename, size, remote_status FROM attachments WHERE att_id = ? AND user_id = ? AND storage = ? AND email_id = 0`)
			.bind(attId, userId, STORAGE)
			.first();
		if (!row) fail('Attachment unavailable / 附件不可用', 404);
		if (row.remote_status === 'ready') return { attId, status: 'ready' };
		// A remote file can back only one upload, so one user cannot claim another's file.
		const claimed = await c.env.db.prepare('SELECT 1 FROM attachments WHERE remote_id = ? AND att_id != ? LIMIT 1').bind(remoteId, attId).first();
		if (claimed) fail('File already registered / 文件已登记', 409);
		let info;
		try {
			info = await client(c, setting).fileInfo(remoteId);
		} catch (error) {
			if (error instanceof CostActionError && error.status === 404) fail('Uploaded file not found / 未找到已上传的文件', 404);
			unavailable(error);
		}
		if (info.deleted || info.size !== row.size) {
			await c.env.db.prepare("UPDATE attachments SET remote_status = 'failed' WHERE att_id = ?").bind(attId).run();
			fail('Uploaded file does not match / 上传的文件不一致', 409);
		}
		await c.env.db
			.prepare("UPDATE attachments SET remote_id = ?, key = ?, remote_status = 'ready' WHERE att_id = ? AND user_id = ?")
			.bind(remoteId, `${STORAGE}:${remoteId}`, attId, userId)
			.run();
		return { attId, status: 'ready', daysLeft: info.daysLeft };
	},

	async markFailed(c, params) {
		const userId = userContext.getUserId(c);
		await c.env.db
			.prepare("UPDATE attachments SET remote_status = 'failed' WHERE att_id = ? AND user_id = ? AND storage = ? AND remote_status = 'uploading'")
			.bind(positiveId(params?.attId), userId, STORAGE)
			.run();
	},

	// A Turbobit download page for an attachment the user may see: their own upload, or one
	// on a message in a mailbox they own.
	async link(c, rawId) {
		const { setting, userId } = await policy(c);
		const row = await c.env.db
			.prepare(
				`SELECT a.remote_id AS remoteId, a.remote_status AS status, a.account_id AS accountId FROM attachments a
        LEFT JOIN email e ON e.email_id = a.email_id
        WHERE a.att_id = ? AND a.user_id = ? AND a.storage = ?
        AND (a.email_id = 0 OR (e.user_id = a.user_id AND e.account_id = a.account_id AND e.is_del = 0))`
			)
			.bind(positiveId(rawId), userId, STORAGE)
			.first();
		if (!row || !row.remoteId) fail('Attachment unavailable / 附件不可用', 404);
		await mailChat.account(c, row.accountId);
		if (row.status !== 'ready') fail('Attachment is no longer available / 附件已失效', 410);
		const api = client(c, setting);
		try {
			const info = await api.fileInfo(row.remoteId);
			if (info.deleted) {
				const status = info.deleteReason === 'lifetime' ? 'expired' : 'deleted';
				await c.env.db.prepare('UPDATE attachments SET remote_status = ? WHERE remote_id = ?').bind(status, row.remoteId).run();
				fail('Attachment is no longer available / 附件已失效', 410);
			}
			return { url: await api.downloadLink(row.remoteId), daysLeft: info.daysLeft };
		} catch (error) {
			if (error instanceof CostActionError && error.status === 404) {
				await c.env.db.prepare("UPDATE attachments SET remote_status = 'deleted' WHERE remote_id = ?").bind(row.remoteId).run();
				fail('Attachment is no longer available / 附件已失效', 410);
			}
			unavailable(error);
		}
	},

	// Only the uploader (the row carrying the client request ID) or the administrator may delete.
	async remove(c, rawId) {
		const { setting, userId, isAdmin } = await policy(c);
		const row = await c.env.db
			.prepare('SELECT remote_id AS remoteId, user_id AS owner, client_key AS clientKey FROM attachments WHERE att_id = ? AND storage = ?')
			.bind(positiveId(rawId), STORAGE)
			.first();
		if (!row || !(isAdmin || (row.owner === userId && row.clientKey))) fail('Attachment unavailable / 附件不可用', 404);
		if (row.remoteId) {
			try {
				await client(c, setting).deleteFile(row.remoteId);
			} catch (error) {
				if (!(error instanceof CostActionError && error.status === 404)) unavailable(error);
			}
			await c.env.db.prepare("UPDATE attachments SET remote_status = 'deleted' WHERE remote_id = ?").bind(row.remoteId).run();
		} else {
			await c.env.db.prepare("UPDATE attachments SET remote_status = 'deleted' WHERE att_id = ?").bind(positiveId(rawId)).run();
		}
	},

	// Admin connection test with the saved token, or with one typed into the form before saving.
	async testConnection(c, params) {
		const setting = await settingService.query(c);
		const typed = typeof params?.token === 'string' ? params.token.trim() : '';
		const token = typed || setting.costactionToken;
		if (!token) return { ok: false, reason: 'missing' };
		return client(c, { costactionToken: token }).testConnection();
	},

	// Validates large attachments named by a chat send: the sender's own, uploaded and not yet sent.
	async forSend(c, account, rawIds) {
		if (rawIds === undefined) return [];
		if (!Array.isArray(rawIds) || rawIds.length > 5) fail('Too many large attachments / 最多 5 个大附件');
		const ids = [...new Set(rawIds.map(positiveId))];
		if (!ids.length) return [];
		const { results } = await c.env.db
			.prepare(
				`SELECT att_id AS attId, filename, size, remote_id AS remoteId FROM attachments
        WHERE user_id = ? AND account_id = ? AND storage = ? AND remote_status = 'ready' AND email_id = 0
        AND att_id IN (${ids.map(() => '?').join(',')})`
			)
			.bind(account.user_id, account.account_id, STORAGE, ...ids)
			.all();
		if (results.length !== ids.length) fail('Large attachment unavailable / 大附件不可用', 409);
		return results;
	}
};

export default largeAtt;
export { STORAGE };
