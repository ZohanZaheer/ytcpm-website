import type { APIRoute } from 'astro';
import { authForRequest, forwardCookies } from '../../../lib/baSession';

export const prerender = false;

/** Only local paths may be used as a post-login destination. */
export function safeNext(raw: string | null | undefined): string | null {
	if (!raw) return null;
	if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return null;
	return raw;
}

export const POST: APIRoute = async (ctx) => {
	const form = await ctx.request.formData().catch(() => null);
	const next = safeNext(form ? String(form.get('next') ?? '') : null);
	const backTo = (code: string): Response => {
		const qs = new URLSearchParams({ error: code });
		if (next) qs.set('next', next);
		return new Response(null, { status: 303, headers: { Location: '/login?' + qs.toString() } });
	};
	try {
		const email = String(form?.get('email') ?? '').trim();
		const password = String(form?.get('password') ?? '');
		if (!email || !password) return backTo('missing');
		const auth = await authForRequest(ctx);
		if (!auth) return backTo('server');
		const res = await auth.api.signInEmail({ body: { email, password }, asResponse: true });
		if (!res.ok) return backTo('invalid');
		const headers = new Headers({ Location: next ?? '/account' });
		forwardCookies(res, headers);
		return new Response(null, { status: 303, headers });
	} catch {
		return backTo('server');
	}
};
