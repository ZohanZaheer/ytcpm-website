import type { APIRoute } from 'astro';
import { authForRequest, forwardCookies } from '../../../lib/baSession';

export const prerender = false;

// Customer sign-in (better-auth email + password) → account dashboard.
export const POST: APIRoute = async (ctx) => {
	const auth = await authForRequest(ctx);
	if (!auth) {
		return new Response(null, { status: 303, headers: { Location: '/login?error=server' } });
	}
	const form = await ctx.request.formData().catch(() => null);
	const email = String(form?.get('email') ?? '').trim();
	const password = String(form?.get('password') ?? '');
	// Small delay to slow down guessing (same as the admin login).
	await new Promise((r) => setTimeout(r, 300));
	try {
		const res = await auth.api.signInEmail({
			body: { email, password },
			asResponse: true,
		});
		if (!res.ok) {
			return new Response(null, { status: 303, headers: { Location: '/login?error=invalid' } });
		}
		const headers = new Headers({ Location: '/account' });
		forwardCookies(res, headers);
		return new Response(null, { status: 303, headers });
	} catch {
		return new Response(null, { status: 303, headers: { Location: '/login?error=server' } });
	}
};
