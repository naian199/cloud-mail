// Storage encryption is managed by the storage provider. These controls protect
// transport and keep decrypted HTTP responses out of browser/shared caches.
export function httpsRedirect(request) {
	const url = new URL(request.url);
	const local =
		['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
		url.hostname.endsWith('.localhost');
	if (url.protocol !== 'http:' || local) return null;
	url.protocol = 'https:';
	return new Response(null, {
		status: 308,
		headers: { Location: url.href, 'Cache-Control': 'no-store' }
	});
}

export function secureResponse(response, requestUrl) {
	// Preserve the Durable Object WebSocket upgrade, including its webSocket handle.
	if (response.status === 101) return response;
	const url = new URL(requestUrl);
	const headers = new Headers(response.headers);
	if (url.protocol === 'https:') headers.set('Strict-Transport-Security', 'max-age=31536000');
	headers.set('X-Content-Type-Options', 'nosniff');
	headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/attachments/')) {
		headers.set('Cache-Control', 'private, no-store');
		headers.set('CDN-Cache-Control', 'no-store');
		headers.set('Cloudflare-CDN-Cache-Control', 'no-store');
		headers.set('Pragma', 'no-cache');
		headers.set('Expires', '0');
	}
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers
	});
}
