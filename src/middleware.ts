import { defineMiddleware } from 'astro:middleware';

// Edge HTML cache (Cloudflare Cache API) for the public SSR pages whose
// content only changes when the admin edits settings or packages:
// home, pricing and download. Rendering them costs a database round
// trip per visit; serving a warm edge copy instead takes the database
// (and most of the TTFB) out of the path for anonymous visitors.
//
// Safety rails:
// - GET only, exact paths, no query string.
// - Requests carrying a session cookie (admin or customer) always
//   bypass the cache, in both directions.
// - Only 200 text/html responses are stored, without Set-Cookie.
// - TTL is short (120s), so admin edits appear within about two
//   minutes even in a datacenter whose copy was not purged.
const CACHEABLE_PATHS = new Set(['/', '/pricing', '/download']);
const TTL_SECONDS = 120;

function hasSessionCookie(request: Request): boolean {
	const cookie = request.headers.get('cookie') ?? '';
	return cookie.includes('ytcpm_admin_session') || cookie.includes('session_token');
}

export const onRequest = defineMiddleware(async (context, next) => {
	const url = new URL(context.request.url);
	const cacheApi = (globalThis as { caches?: { default: Cache } }).caches?.default;
	if (
		!cacheApi ||
		context.request.method !== 'GET' ||
		!CACHEABLE_PATHS.has(url.pathname) ||
		url.search !== '' ||
		hasSessionCookie(context.request)
	) {
		return next();
	}

	const key = new Request(url.toString(), { method: 'GET' });
	const hit = await cacheApi.match(key);
	if (hit) {
		const res = new Response(hit.body, hit);
		res.headers.set('x-page-cache', 'HIT');
		return res;
	}

	const res = await next();
	if (res.status === 200 && (res.headers.get('content-type') ?? '').includes('text/html')) {
		const stored = res.clone();
		stored.headers.set('Cache-Control', `public, max-age=0, s-maxage=${TTL_SECONDS}`);
		stored.headers.delete('Set-Cookie');
		await cacheApi.put(key, stored);
		res.headers.set('x-page-cache', 'MISS');
	}
	return res;
});
