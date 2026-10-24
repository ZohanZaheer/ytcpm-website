import type { APIRoute } from 'astro';
import { authForRequest, forwardCookies } from '../../../lib/baSession';

export const prerender = false;

// Sign out of the customer account (clears the better-auth session).
export const POST: APIRoute = async (ctx) => {
	const auth = await authForRequest(ctx);
	const headers = new Headers({ Location: '/' });
	if (auth) {
		try {
			const res = await auth.api.signOut({ headers: ctx.request.headers, asResponse: true });
			forwardCookies(res, headers);
		} catch {
			// Session already gone — the redirect home is enough.
		}
	}
	return new Response(null, { status: 303, headers });
};
