import type { APIRoute } from 'astro';
import { authForRequest, forwardCookies } from '../../../lib/baSession';

export const prerender = false;

function back(params: Record<string, string>): Response {
	const qs = new URLSearchParams(params).toString();
	return new Response(null, { status: 303, headers: { Location: `/signup?${qs}` } });
}

// Customer sign-up (better-auth email + password). On success the
// better-auth sign-up also signs the user in; we forward its session
// cookie and land on the account dashboard.
export const POST: APIRoute = async (ctx) => {
	const auth = await authForRequest(ctx);
	if (!auth) return back({ error: 'server' });
	const form = await ctx.request.formData().catch(() => null);
	const name = String(form?.get('name') ?? '').trim();
	const email = String(form?.get('email') ?? '').trim();
	const password = String(form?.get('password') ?? '');
	if (name.length < 2 || name.length > 80) return back({ error: 'name' });
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return back({ error: 'email' });
	if (password.length < 8) return back({ error: 'password' });
	try {
		const res = await auth.api.signUpEmail({
			body: { name, email, password },
			asResponse: true,
		});
		if (!res.ok) {
			const text = await res.text().catch(() => '');
			return back({ error: /already|exists|USER_ALREADY/i.test(text) ? 'exists' : 'invalid' });
		}
		const headers = new Headers({ Location: '/account' });
		forwardCookies(res, headers);
		return new Response(null, { status: 303, headers });
	} catch {
		return back({ error: 'server' });
	}
};
