import type { APIRoute } from 'astro';
import { checkCredentials, makeSessionValue, sessionCookieHeader, adminConfigured } from '../../../lib/auth';
import { getDatabaseUrl } from '../../../lib/env';
import { getAuthUserByEmail, setAuthUserRole } from '../../../lib/db';
import { authForRequest, forwardCookies } from '../../../lib/baSession';

export const prerender = false;

function redirect(location: string, cookiesFrom?: Response): Response {
	const headers = new Headers({ Location: location });
	if (cookiesFrom) forwardCookies(cookiesFrom, headers);
	return new Response(null, { status: 303, headers });
}

// Admin login, now on better-auth: admins are accounts whose role is
// 'admin' in the user table. Two bridges keep the owner un-lockoutable:
//  1. First-time bootstrap — if no account exists for the admin email
//     yet, the environment credentials (ADMIN_EMAIL / ADMIN_PASSWORD)
//     create the better-auth admin account and sign in.
//  2. Legacy recovery — if the database/auth layer is unreachable, the
//     environment credentials still sign in with the old signed cookie.
export const POST: APIRoute = async (ctx) => {
	const form = await ctx.request.formData().catch(() => null);
	const email = String(form?.get('email') ?? '').trim();
	const password = String(form?.get('password') ?? '');
	// Small delay to slow down guessing.
	await new Promise((r) => setTimeout(r, 400));

	const dbUrl = getDatabaseUrl(ctx);
	const auth = await authForRequest(ctx);
	if (auth && dbUrl) {
		try {
			const existing = await getAuthUserByEmail(dbUrl, email);
			if (existing) {
				const res = await auth.api.signInEmail({ body: { email, password }, asResponse: true });
				if (!res.ok) return redirect('/admin?error=invalid');
				if (existing.role !== 'admin') return redirect('/admin?error=notadmin');
				return redirect('/admin', res);
			}
			if (adminConfigured(ctx) && checkCredentials(ctx, email, password)) {
				const res = await auth.api.signUpEmail({
					body: { name: 'Admin', email, password },
					asResponse: true,
				});
				if (res.ok) {
					const created = await getAuthUserByEmail(dbUrl, email);
					if (created) await setAuthUserRole(dbUrl, created.id, 'admin');
					return redirect('/admin', res);
				}
			}
			return redirect('/admin?error=invalid');
		} catch {
			// Auth layer unreachable — fall through to the legacy login.
		}
	}

	if (!adminConfigured(ctx)) return redirect('/admin?error=config');
	if (!checkCredentials(ctx, email, password)) return redirect('/admin?error=invalid');
	const value = await makeSessionValue(ctx, email.toLowerCase());
	const headers = new Headers({ Location: '/admin', 'Set-Cookie': sessionCookieHeader(value) });
	return new Response(null, { status: 303, headers });
};
