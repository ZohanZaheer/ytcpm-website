import type { APIRoute } from 'astro';
import { hashPassword, verifyPassword } from 'better-auth/crypto';
import { checkCredentials, makeSessionValue, sessionCookieHeader, adminConfigured } from '../../../lib/auth';
import { getDatabaseUrl, getEnv } from '../../../lib/env';
import {
	countAdminUsers,
	getAdminByEmail,
	createAdminUser,
	ensureSchema,
	isLocked,
	recordLoginFailure,
	resetLoginFailures,
	type LoginGuard,
} from '../../../lib/db';
import { getEffectiveSettings } from '../../../lib/settings';

export const prerender = false;

function redirect(location: string, cookie?: string): Response {
	const headers = new Headers({ Location: location });
	if (cookie) headers.set('Set-Cookie', cookie);
	return new Response(null, { status: 303, headers });
}

async function signedIn(ctx: Parameters<APIRoute>[0], email: string): Promise<Response> {
	const value = await makeSessionValue(ctx, email.toLowerCase());
	return redirect('/admin', sessionCookieHeader(value));
}

// Admin sign-in reads ONLY the admin_users table — customer accounts
// are a completely separate system (better-auth) and can never sign
// in here, even with a correct customer password.
//
// First-run bootstrap: while the table is empty, the environment
// credentials (ADMIN_EMAIL / ADMIN_PASSWORD) create the first admin
// row (password stored hashed) and sign in. If the database itself
// is unreachable, the environment credentials still work as a
// disaster-recovery login with the same signed session cookie.
export const POST: APIRoute = async (ctx) => {
	const form = await ctx.request.formData().catch(() => null);
	const email = String(form?.get('email') ?? '').trim();
	const password = String(form?.get('password') ?? '');
	// Small delay to slow down guessing.
	await new Promise((r) => setTimeout(r, 400));

	const dbUrl = getDatabaseUrl(ctx);
	if (dbUrl) {
		try {
			await ensureSchema(dbUrl);
			const admins = await countAdminUsers(dbUrl);
			if (admins === 0) {
				if (!adminConfigured(ctx)) return redirect('/admin?error=config');
				if (!checkCredentials(ctx, email, password)) return redirect('/admin?error=invalid');
				const passwordHash = await hashPassword(password);
				await createAdminUser(dbUrl, { email: email.toLowerCase(), name: 'Admin', passwordHash });
				return signedIn(ctx, email);
			}
			const admin = await getAdminByEmail(dbUrl, email);
			if (admin) {
				const guard: LoginGuard = {
					id: admin.id,
					failed_logins: admin.failed_logins ?? 0,
					lock_level: admin.lock_level ?? 0,
					lock_day: admin.lock_day,
					locked_until: admin.locked_until,
				};
				// A locked admin account is refused before the password check.
				if (isLocked(guard)) {
					return redirect('/admin?error=locked&until=' + encodeURIComponent(guard.locked_until!));
				}
				if (await verifyPassword({ hash: admin.password_hash, password })) {
					await resetLoginFailures(dbUrl, 'admin', admin.id).catch(() => {});
					return signedIn(ctx, admin.email);
				}
				const env = (key: string) => getEnv(ctx, key);
				const cfg = (await getEffectiveSettings(dbUrl, env)).lockout;
				const out = await recordLoginFailure(dbUrl, 'admin', guard, cfg).catch(() => null);
				if (out?.lockedUntil) {
					return redirect('/admin?error=locked&until=' + encodeURIComponent(out.lockedUntil));
				}
				if (out) {
					return redirect(`/admin?error=invalid&left=${out.attemptsLeft}&max=${cfg.maxAttempts}`);
				}
				return redirect('/admin?error=invalid');
			}
			return redirect('/admin?error=invalid');
		} catch {
			// Database unreachable — fall through to the recovery login.
		}
	}

	if (!adminConfigured(ctx)) return redirect('/admin?error=config');
	if (!checkCredentials(ctx, email, password)) return redirect('/admin?error=invalid');
	return signedIn(ctx, email);
};
