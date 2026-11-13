// CostAction (Turbobit) file API client. https://api.costaction.com/en/v1/docs
//
// Verified against the live API on 2026-11-13:
//   - Auth is `Authorization: Bearer <token>`; unauthenticated calls answer 401.
//   - The upload-URL route is /v1/file/upload_url. The documented /file/upload_url
//     answers 404 "route could not be found".
//   - Limit: 60 requests per minute per account; 429 carries `retry-after` seconds.
//
// The token is used only for requests to api.costaction.com. It never appears in
// errors, return values or logs.

export const API_BASE = 'https://api.costaction.com';
export const APPTYPE = 'fd1'; // turbobit.net
const UPLOAD_HOST = /^([a-z0-9-]+\.)*turbobit\.net$/i;

export class CostActionError extends Error {
	constructor(message, { status = 0, retryable = false } = {}) {
		super(message);
		this.name = 'CostActionError';
		this.status = status;
		this.retryable = retryable;
	}
}

// Keeps requests under the account limit (60/min) with a sliding window kept in memory.
// Workers KV allows one write per key per second, so a shared KV counter cannot take a write
// per request. This window is per isolate, so it is approximate across isolates; the API's
// 429 answers are still honoured by retrying after `retry-after`.
export function memoryRateLimiter({ perMinute = 50, now = () => Date.now(), sleep = (ms) => new Promise((r) => setTimeout(r, ms)), window = [] } = {}) {
	return async function acquire() {
		for (let attempt = 0; attempt < 3; attempt++) {
			const t = now();
			while (window.length && t - window[0] >= 60000) window.shift();
			if (window.length < perMinute) { window.push(t); return; }
			await sleep(60000 - (t - window[0]) + 50);
		}
		throw new CostActionError('Large attachment service is busy, try again shortly', { status: 429, retryable: true });
	};
}

export function createCostAction({
	token,
	fetch: fetchImpl = fetch,
	sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
	acquire = async () => {},
	baseUrl = API_BASE,
	timeoutMs = 15000,
	maxRetries = 3,
	// Tests only: an exact extra origin allowed for upload URLs (e.g. a local mock).
	extraUploadOrigin = ''
}) {
	if (!token) throw new CostActionError('Large attachment storage is not configured', { status: 503 });

	async function request(method, path, { body, query } = {}) {
		const url = new URL(path, baseUrl);
		for (const [k, v] of Object.entries(query || {})) url.searchParams.set(k, String(v));
		let lastError;
		for (let attempt = 0; attempt <= maxRetries; attempt++) {
			await acquire();
			const controller = new AbortController();
			const timer = setTimeout(() => controller.abort(), timeoutMs);
			let response;
			try {
				response = await fetchImpl(url.toString(), {
					method,
					headers: {
						Accept: 'application/json',
						'Content-Type': 'application/json',
						Authorization: `Bearer ${token}`
					},
					body: body === undefined ? undefined : JSON.stringify(body),
					signal: controller.signal
				});
			} catch (error) {
				lastError = new CostActionError(error?.name === 'AbortError' ? 'Large attachment service timed out' : 'Large attachment service unreachable', { retryable: true });
				if (attempt < maxRetries) { await sleep(1000 * 2 ** attempt); continue; }
				throw lastError;
			} finally {
				clearTimeout(timer);
			}
			const data = await response.json().catch(() => ({}));
			if (response.status === 429) {
				lastError = new CostActionError('Large attachment service rate limit reached', { status: 429, retryable: true });
				const wait = Number(response.headers.get('retry-after') ?? data['retry-after']);
				if (attempt < maxRetries) { await sleep(Math.min(Number.isFinite(wait) && wait > 0 ? wait : 5, 30) * 1000); continue; }
				throw lastError;
			}
			if (response.status >= 500) {
				lastError = new CostActionError('Large attachment service error', { status: response.status, retryable: true });
				if (attempt < maxRetries) { await sleep(1000 * 2 ** attempt); continue; }
				throw lastError;
			}
			if (!response.ok || data.status === 'error') {
				// Vendor messages are short, fixed English strings; they never echo the token.
				throw new CostActionError(typeof data.message === 'string' ? data.message.slice(0, 200) : 'Large attachment request failed', { status: response.status });
			}
			return data;
		}
		throw lastError;
	}

	return {
		// A one-time upload URL; a new one is required for every file.
		async requestUploadUrl(folderId = 0) {
			const data = await request('POST', '/v1/file/upload_url', { body: { apptype: APPTYPE, folder_id: folderId } });
			let url;
			try { url = new URL(data.url); } catch { url = null; }
			// The browser posts the file here, so only accept Turbobit upload hosts over HTTPS.
			const trusted = url && ((url.protocol === 'https:' && UPLOAD_HOST.test(url.hostname)) || (extraUploadOrigin && url.origin === extraUploadOrigin));
			if (!trusted) {
				throw new CostActionError('Unexpected upload address from the storage service');
			}
			return { url: url.toString(), expire: typeof data.expire === 'string' ? data.expire : '' };
		},

		async fileInfo(id) {
			const data = await request('GET', `/v1/file/${encodeURIComponent(id)}`, { query: { properties: 'days_left' } });
			const file = data.file || {};
			return {
				id: String(file.id || ''),
				name: String(file.name || ''),
				size: Number(file.size_in_bytes) || 0,
				deleted: file.is_deleted === true || file.is_deleted === 'true' || file.is_deleted === 1,
				deleteReason: file.delete_reason || '',
				daysLeft: file.days_left === undefined || file.days_left === null ? null : Number(file.days_left)
			};
		},

		// Turbobit download pages; the API documents no direct file links.
		async downloadLink(id) {
			const data = await request('GET', `/v1/file/${encodeURIComponent(id)}/share`);
			const links = data.links?.for_downloading || {};
			const link = links.with_file_name || links.standard || '';
			if (!/^https:\/\//i.test(link)) throw new CostActionError('No download link available');
			return link;
		},

		async deleteFile(id) {
			try {
				await request('DELETE', `/v1/file/${encodeURIComponent(id)}`, { query: { permanent: 'true' } });
			} catch (error) {
				// 403 "File already deleted" means the goal is met.
				if (error instanceof CostActionError && error.status === 403) return;
				throw error;
			}
		},

		// A valid token turns a lookup of a file that cannot exist into 404; a bad one into 401.
		async testConnection() {
			try {
				await request('GET', '/v1/file/cloud-mail-connection-test');
				return { ok: true };
			} catch (error) {
				if (error instanceof CostActionError && error.status === 404) return { ok: true };
				if (error instanceof CostActionError && error.status === 401) return { ok: false, reason: 'unauthorized' };
				return { ok: false, reason: error.retryable ? 'unavailable' : 'failed' };
			}
		}
	};
}
