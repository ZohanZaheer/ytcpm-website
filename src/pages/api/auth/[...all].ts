import type { APIRoute } from 'astro';
import { authForRequest } from '../../../lib/baSession';

export const prerender = false;

// The better-auth handler, mounted at /api/auth/*. Our own pages use
// the friendlier form endpoints under /api/account/* (and
// /api/admin/login); this mount exists so the standard better-auth
// endpoints (session, sign-out, future providers) are available.
const handle: APIRoute = async (ctx) => {
	const auth = await authForRequest(ctx);
	if (!auth) return new Response('Accounts are not configured.', { status: 503 });
	return auth.handler(ctx.request);
};

export const GET = handle;
export const POST = handle;
