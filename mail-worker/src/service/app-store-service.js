import BizError from '../error/biz-error';
import userContext from '../security/user-context';
import permService from './perm-service';
import cloudFile from './cloud-file-service';

// App store (see init/app-store-schema.js).
//
//   - Every signed-in user can browse published apps and download their published versions.
//   - Publishers (app:publish) create listings and add versions whose installer is a CostAction
//     file they uploaded through the verified large-attachment flow. Nothing is public until a
//     reviewer (app:review) approves it.
//   - Downloads go to the provider's official page, exactly like My files; this site counts the
//     click only.
//   - A listing's card (used by chat link previews) reveals nothing about apps the viewer cannot
//     see: it answers "unavailable" for drafts, rejected, hidden and removed apps alike.

export const PLATFORMS = ['android', 'ios', 'windows', 'macos', 'linux', 'web'];
export const CATEGORIES = ['tools', 'social', 'productivity', 'media', 'games', 'education', 'other'];
const PAGE = 24;

const fail = (message, code = 400) => { throw new BizError(message, code); };
const now = () => Math.floor(Date.now() / 1000);
const id = (value) => {
	const n = Number(value);
	if (!Number.isSafeInteger(n) || n < 1) fail('Invalid ID / 无效编号');
	return n;
};
const text = (value, max, required = false) => {
	const s = typeof value === 'string' ? value.trim() : '';
	if ((required && !s) || s.length > max) fail('Invalid input / 输入无效');
	return s;
};
const url = (value) => {
	const s = text(value, 500);
	if (s && !/^https:\/\/[^\s]+$/i.test(s)) fail('Source must be an https link / 来源须为 https 链接');
	return s;
};

const PUBLISHER = `COALESCE(NULLIF(p.display_name, ''), '@' || h.username, '') AS publisherName`;
const PUBLISHER_JOIN = `LEFT JOIN mail_user_profile p ON p.user_id = a.publisher_id LEFT JOIN mail_user_handle h ON h.user_id = a.publisher_id`;

function appRow(row) {
	if (!row) return null;
	return {
		appId: row.app_id, name: row.name, summary: row.summary, description: row.description,
		category: row.category, sourceUrl: row.source_url, status: row.status, removedBy: row.removed_by,
		reviewNote: row.review_note, publisherId: row.publisher_id, publisherName: row.publisherName || '',
		platforms: row.platforms ? String(row.platforms).split(',').filter(Boolean) : [],
		latestVersion: row.latestVersion || '', publishTime: row.publish_time, updateTime: row.update_time
	};
}

function versionRow(row) {
	return {
		versionId: row.version_id, appId: row.app_id, version: row.version, platform: row.platform, notes: row.notes,
		status: row.status, reviewNote: row.review_note, clicks: row.click_count, publishTime: row.publish_time,
		createTime: row.create_time, fileId: row.file_id, filename: row.filename || '', size: row.size || 0,
		fileStatus: row.fileStatus || ''
	};
}

const appService = {
	async can(c, key) {
		const user = userContext.getUser(c);
		if (user?.email && user.email === c.env.admin) return true;
		const keys = await permService.userPermKeys(c, userContext.getUserId(c));
		return keys.includes('*') || keys.includes(key);
	},

	// Published apps with at least one published version, newest first.
	async list(c, query = {}) {
		const q = text(query.q, 80).toLowerCase();
		const platform = PLATFORMS.includes(query.platform) ? query.platform : '';
		const category = CATEGORIES.includes(query.category) ? query.category : '';
		const page = Math.max(0, Math.min(1000, Number(query.page) || 0));
		const where = [`a.status = 'published'`, `EXISTS (SELECT 1 FROM app_version v WHERE v.app_id = a.app_id AND v.status = 'published'${platform ? ' AND v.platform = ?' : ''})`];
		const binds = platform ? [platform] : [];
		if (q) { where.push(`(instr(lower(a.name), ?) > 0 OR instr(lower(a.summary), ?) > 0)`); binds.push(q, q); }
		if (category) { where.push('a.category = ?'); binds.push(category); }
		const { results } = await c.env.db.prepare(`SELECT a.*, ${PUBLISHER},
        (SELECT group_concat(DISTINCT v.platform) FROM app_version v WHERE v.app_id = a.app_id AND v.status = 'published') AS platforms,
        (SELECT v.version FROM app_version v WHERE v.app_id = a.app_id AND v.status = 'published' ORDER BY v.publish_time DESC, v.version_id DESC LIMIT 1) AS latestVersion
      FROM app a ${PUBLISHER_JOIN} WHERE ${where.join(' AND ')}
      ORDER BY a.publish_time DESC, a.app_id DESC LIMIT ? OFFSET ?`).bind(...binds, PAGE + 1, page * PAGE).all();
		return { apps: results.slice(0, PAGE).map(appRow), hasMore: results.length > PAGE, platforms: PLATFORMS, categories: CATEGORIES };
	},

	async loadApp(c, appId) {
		return c.env.db.prepare(`SELECT a.*, ${PUBLISHER},
        (SELECT group_concat(DISTINCT v.platform) FROM app_version v WHERE v.app_id = a.app_id AND v.status = 'published') AS platforms,
        (SELECT v.version FROM app_version v WHERE v.app_id = a.app_id AND v.status = 'published' ORDER BY v.publish_time DESC, v.version_id DESC LIMIT 1) AS latestVersion
      FROM app a ${PUBLISHER_JOIN} WHERE a.app_id = ?`).bind(appId).first();
	},

	async versions(c, appId, all) {
		const { results } = await c.env.db.prepare(`SELECT v.*, f.filename, f.size, f.status AS fileStatus FROM app_version v
      LEFT JOIN cloud_file f ON f.file_id = v.file_id WHERE v.app_id = ? ${all ? '' : "AND v.status = 'published'"}
      ORDER BY v.create_time DESC, v.version_id DESC LIMIT 100`).bind(appId).all();
		return results.map(versionRow);
	},

	// Who may see what: everyone sees published apps; the publisher and reviewers see the rest.
	async access(c, appId) {
		const row = await this.loadApp(c, appId);
		if (!row) return { row: null };
		const userId = userContext.getUserId(c);
		const owner = row.publisher_id === userId && await this.can(c, 'app:publish');
		const reviewer = await this.can(c, 'app:review');
		return { row, owner, reviewer, visible: row.status === 'published' || owner || reviewer };
	},

	async detail(c, rawId) {
		const { row, owner, reviewer, visible } = await this.access(c, id(rawId));
		if (!row || !visible) fail('App unavailable / 应用不可用', 404);
		const app = appRow(row);
		const versions = await this.versions(c, app.appId, owner || reviewer);
		return { app, versions, canManage: owner, canReview: reviewer };
	},

	// What a shared link may show. No metadata for apps the viewer cannot see.
	async card(c, rawId) {
		const { row } = await this.access(c, id(rawId));
		if (!row || row.status !== 'published') return { appId: Number(rawId), available: false };
		const app = appRow(row);
		return { appId: app.appId, available: true, name: app.name, summary: app.summary, platforms: app.platforms, latestVersion: app.latestVersion, publisherName: app.publisherName };
	},

	async download(c, rawAppId, rawVersionId) {
		const appId = id(rawAppId), versionId = id(rawVersionId);
		const row = await c.env.db.prepare(`SELECT v.version_id, f.* FROM app_version v JOIN app a ON a.app_id = v.app_id
      JOIN cloud_file f ON f.file_id = v.file_id
      WHERE v.version_id = ? AND v.app_id = ? AND v.status = 'published' AND a.status = 'published'`).bind(versionId, appId).first();
		if (!row) fail('Version unavailable / 版本不可用', 404);
		const link = await cloudFile.officialLink(c, row);
		await c.env.db.prepare('UPDATE app_version SET click_count = click_count + 1 WHERE version_id = ?').bind(versionId).run();
		return link;
	},

	// ---- Publisher ----

	async mine(c) {
		const { results } = await c.env.db.prepare(`SELECT a.*, ${PUBLISHER},
        (SELECT group_concat(DISTINCT v.platform) FROM app_version v WHERE v.app_id = a.app_id) AS platforms,
        (SELECT v.version FROM app_version v WHERE v.app_id = a.app_id ORDER BY v.create_time DESC, v.version_id DESC LIMIT 1) AS latestVersion
      FROM app a ${PUBLISHER_JOIN} WHERE a.publisher_id = ? ORDER BY a.update_time DESC LIMIT 200`).bind(userContext.getUserId(c)).all();
		return results.map(appRow);
	},

	// Installers the publisher uploaded and the Worker verified: candidates for a version.
	async files(c) {
		const { results } = await c.env.db.prepare(`SELECT file_id, filename, size, create_time FROM cloud_file
      WHERE uploader_id = ? AND status = 'ready' ORDER BY create_time DESC LIMIT 100`).bind(userContext.getUserId(c)).all();
		return results.map((f) => ({ fileId: f.file_id, filename: f.filename, size: f.size, createTime: f.create_time }));
	},

	fields(params) {
		const category = CATEGORIES.includes(params?.category) ? params.category : 'tools';
		return { name: text(params?.name, 60, true), summary: text(params?.summary, 140), description: text(params?.description, 4000), category, sourceUrl: url(params?.sourceUrl) };
	},

	async create(c, params) {
		const f = this.fields(params);
		const userId = userContext.getUserId(c);
		const { count } = await c.env.db.prepare('SELECT count(*) AS count FROM app WHERE publisher_id = ?').bind(userId).first();
		if (count >= 50) fail('Too many apps / 应用数量已达上限');
		const row = await c.env.db.prepare(`INSERT INTO app(publisher_id, name, summary, description, category, source_url)
      VALUES (?, ?, ?, ?, ?, ?) RETURNING app_id`).bind(userId, f.name, f.summary, f.description, f.category, f.sourceUrl).first();
		return { appId: row.app_id };
	},

	async own(c, rawId) {
		const row = await c.env.db.prepare('SELECT * FROM app WHERE app_id = ? AND publisher_id = ?').bind(id(rawId), userContext.getUserId(c)).first();
		if (!row) fail('App unavailable / 应用不可用', 404);
		return row;
	},

	// Edits to a listing return it to review unless it is still a draft; a removed listing stays removed.
	async update(c, rawId, params) {
		const row = await this.own(c, rawId);
		if (row.status === 'removed') fail('Removed by review / 已被审核下架', 409);
		const f = this.fields(params);
		const status = row.status === 'draft' ? 'draft' : 'review';
		await c.env.db.prepare(`UPDATE app SET name = ?, summary = ?, description = ?, category = ?, source_url = ?, status = ?, update_time = ? WHERE app_id = ?`)
			.bind(f.name, f.summary, f.description, f.category, f.sourceUrl, status, now(), row.app_id).run();
		return { status };
	},

	async addVersion(c, rawId, params) {
		const row = await this.own(c, rawId);
		if (row.status === 'removed') fail('Removed by review / 已被审核下架', 409);
		const version = text(params?.version, 40, true);
		const platform = PLATFORMS.includes(params?.platform) ? params.platform : fail('Choose a platform / 请选择平台');
		const fileId = id(params?.fileId);
		const file = await c.env.db.prepare(`SELECT file_id FROM cloud_file WHERE file_id = ? AND uploader_id = ? AND status = 'ready'`).bind(fileId, userContext.getUserId(c)).first();
		if (!file) fail('Choose a verified file you uploaded / 请选择你上传且已核验的文件', 400);
		const res = await c.env.db.prepare(`INSERT INTO app_version(app_id, version, platform, notes, file_id) VALUES (?, ?, ?, ?, ?) RETURNING version_id`)
			.bind(row.app_id, version, platform, text(params?.notes, 2000), fileId).first();
		await c.env.db.prepare('UPDATE app SET update_time = ? WHERE app_id = ?').bind(now(), row.app_id).run();
		return { versionId: res.version_id };
	},

	async submit(c, rawId) {
		const row = await this.own(c, rawId);
		if (!['draft', 'rejected', 'hidden'].includes(row.status)) fail('Nothing to submit / 无需提交', 409);
		const { count } = await c.env.db.prepare(`SELECT count(*) AS count FROM app_version WHERE app_id = ? AND status IN ('review','published')`).bind(row.app_id).first();
		if (!count) fail('Add a version first / 请先添加版本', 409);
		await c.env.db.prepare(`UPDATE app SET status = 'review', removed_by = '', update_time = ? WHERE app_id = ?`).bind(now(), row.app_id).run();
		return { status: 'review' };
	},

	async hide(c, rawId) {
		const row = await this.own(c, rawId);
		if (row.status !== 'published') fail('Only published apps can be hidden / 仅已上架应用可下架', 409);
		await c.env.db.prepare(`UPDATE app SET status = 'hidden', removed_by = 'publisher', update_time = ? WHERE app_id = ?`).bind(now(), row.app_id).run();
		return { status: 'hidden' };
	},

	async withdrawVersion(c, rawId, rawVersionId) {
		const row = await this.own(c, rawId);
		const res = await c.env.db.prepare(`UPDATE app_version SET status = 'withdrawn' WHERE version_id = ? AND app_id = ? AND status IN ('review','published')`)
			.bind(id(rawVersionId), row.app_id).run();
		if (!res.meta.changes) fail('Version unavailable / 版本不可用', 404);
		return { status: 'withdrawn' };
	},

	// ---- Reviewer ----

	async queue(c) {
		const { results } = await c.env.db.prepare(`SELECT a.*, ${PUBLISHER},
        (SELECT count(*) FROM app_version v WHERE v.app_id = a.app_id AND v.status = 'review') AS pending,
        (SELECT group_concat(DISTINCT v.platform) FROM app_version v WHERE v.app_id = a.app_id) AS platforms
      FROM app a ${PUBLISHER_JOIN}
      WHERE a.status IN ('review','published','removed','hidden','rejected')
      ORDER BY (a.status = 'review' OR EXISTS (SELECT 1 FROM app_version v WHERE v.app_id = a.app_id AND v.status = 'review')) DESC, a.update_time DESC LIMIT 200`).all();
		return results.map((r) => ({ ...appRow(r), pendingVersions: r.pending }));
	},

	async reviewApp(c, rawId, params) {
		const appId = id(rawId);
		const note = text(params?.note, 500);
		const row = await c.env.db.prepare('SELECT * FROM app WHERE app_id = ?').bind(appId).first();
		if (!row) fail('App unavailable / 应用不可用', 404);
		const action = params?.action;
		const t = now();
		if (action === 'approve') {
			if (row.status !== 'review') fail('Not waiting for review / 不在待审核状态', 409);
			await c.env.db.batch([
				c.env.db.prepare(`UPDATE app SET status = 'published', removed_by = '', review_note = ?, publish_time = CASE WHEN publish_time = 0 THEN ? ELSE publish_time END, update_time = ? WHERE app_id = ?`).bind(note, t, t, appId),
				// Approving a listing approves the versions submitted with it.
				c.env.db.prepare(`UPDATE app_version SET status = 'published', publish_time = ? WHERE app_id = ? AND status = 'review'`).bind(t, appId)
			]);
			return { status: 'published' };
		}
		if (action === 'reject') {
			if (row.status !== 'review') fail('Not waiting for review / 不在待审核状态', 409);
			if (!note) fail('Give a reason / 请填写原因');
			await c.env.db.prepare(`UPDATE app SET status = 'rejected', review_note = ?, update_time = ? WHERE app_id = ?`).bind(note, t, appId).run();
			return { status: 'rejected' };
		}
		if (action === 'remove') {
			if (!['published', 'hidden', 'review'].includes(row.status)) fail('Cannot remove / 无法下架', 409);
			if (!note) fail('Give a reason / 请填写原因');
			await c.env.db.prepare(`UPDATE app SET status = 'removed', removed_by = 'admin', review_note = ?, update_time = ? WHERE app_id = ?`).bind(note, t, appId).run();
			return { status: 'removed' };
		}
		if (action === 'restore') {
			if (row.status !== 'removed') fail('Not removed / 未下架', 409);
			await c.env.db.prepare(`UPDATE app SET status = 'published', removed_by = '', review_note = ?, update_time = ? WHERE app_id = ?`).bind(note, t, appId).run();
			return { status: 'published' };
		}
		fail('Unknown action / 未知操作');
	},

	async reviewVersion(c, rawId, rawVersionId, params) {
		const appId = id(rawId), versionId = id(rawVersionId);
		const note = text(params?.note, 500);
		const row = await c.env.db.prepare('SELECT * FROM app_version WHERE version_id = ? AND app_id = ?').bind(versionId, appId).first();
		if (!row) fail('Version unavailable / 版本不可用', 404);
		const action = params?.action, t = now();
		if (action === 'approve' && row.status === 'review') {
			await c.env.db.prepare(`UPDATE app_version SET status = 'published', review_note = ?, publish_time = ? WHERE version_id = ?`).bind(note, t, versionId).run();
			return { status: 'published' };
		}
		if (action === 'reject' && row.status === 'review') {
			if (!note) fail('Give a reason / 请填写原因');
			await c.env.db.prepare(`UPDATE app_version SET status = 'rejected', review_note = ? WHERE version_id = ?`).bind(note, versionId).run();
			return { status: 'rejected' };
		}
		// Blocking stops downloads at once; it is not just hidden from the list.
		if (action === 'block' && ['published', 'review'].includes(row.status)) {
			if (!note) fail('Give a reason / 请填写原因');
			await c.env.db.prepare(`UPDATE app_version SET status = 'blocked', review_note = ? WHERE version_id = ?`).bind(note, versionId).run();
			return { status: 'blocked' };
		}
		fail('Not allowed in this state / 当前状态不可操作', 409);
	}
};

export default appService;
