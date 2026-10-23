import type { APIRoute } from 'astro';
import { checkCredentials, makeSessionValue, sessionCookieHeader, adminConfigured } from '../../../lib/auth';

export const prerender = false;

// Admin login: email + password form → signed session cookie.
export const POST: APIRoute = async (ctx) => {
	if (!adminConfigured(ctx)) {
		return new Response(null, { status: 303, headers: { Location: '/admin?error=config' } });
	}
	const form = await ctx.request.formData().catch(() => null);
	const email = String(form?.get('email') ?? '');
	const password = String(form?.get('password') ?? '');
	// Small delay to slow down guessing.
	await new Promise((r) => setTimeout(r, 400));
	if (!checkCredentials(ctx, email, password)) {
		return new Response(null, { status: 303, headers: { Location: '/admin?error=invalid' } });
	}
	const value = await makeSessionValue(ctx, email.trim().toLowerCase());
	return new Response(null, {
		status: 303,
		headers: { Location: '/admin', 'Set-Cookie': sessionCookieHeader(value) },
	});
};
