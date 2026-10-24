import type { APIRoute } from 'astro';
import { clearCookieHeader } from '../../../lib/auth';
import { authForRequest, forwardCookies } from '../../../lib/baSession';

export const prerender = false;

// Admin sign-out: ends the better-auth session (if any) and clears the
// legacy session cookie as well.
export const POST: APIRoute = async (ctx) => {
	const headers = new Headers({ Location: '/admin' });
	headers.append('Set-Cookie', clearCookieHeader());
	const auth = await authForRequest(ctx);
	if (auth) {
		try {
			const res = await auth.api.signOut({ headers: ctx.request.headers, asResponse: true });
			forwardCookies(res, headers);
		} catch {
			// No better-auth session to end.
		}
	}
	return new Response(null, { status: 303, headers });
};
