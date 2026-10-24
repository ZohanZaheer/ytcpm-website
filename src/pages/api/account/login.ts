import type { APIRoute } from 'astro';
import { authForRequest, forwardCookies } from '../../../lib/baSession';
import { getDatabaseUrl, getEnv } from '../../../lib/env';
import {
	getLoginGuard,
	recordLoginFailure,
	resetLoginFailures,
	isLocked,
	getFraudInfoByEmail,
	clearUserSessions,
} from '../../../lib/db';
import { getEffectiveSettings } from '../../../lib/settings';

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
	const backTo = (code: string, extra?: Record<string, string>): Response => {
		const qs = new URLSearchParams({ error: code, ...extra });
		if (next) qs.set('next', next);
		return new Response(null, { status: 303, headers: { Location: '/login?' + qs.toString() } });
	};
	try {
		const email = String(form?.get('email') ?? '').trim();
		const password = String(form?.get('password') ?? '');
		if (!email || !password) return backTo('missing');
		const auth = await authForRequest(ctx);
		if (!auth) return backTo('server');

		const dbUrl = getDatabaseUrl(ctx);
		const env = (key: string) => getEnv(ctx, key);
		const guard = dbUrl ? await getLoginGuard(dbUrl, 'user', email).catch(() => null) : null;

		// A locked account is refused before the password is even checked.
		if (isLocked(guard)) return backTo('locked', { until: guard!.locked_until! });

		const res = await auth.api.signInEmail({ body: { email, password }, asResponse: true });
		if (!res.ok) {
			if (dbUrl && guard) {
				const cfg = (await getEffectiveSettings(dbUrl, env)).lockout;
				const out = await recordLoginFailure(dbUrl, 'user', guard, cfg).catch(() => null);
				if (out?.lockedUntil) return backTo('locked', { until: out.lockedUntil });
				if (out) {
					return backTo('invalid', {
						left: String(out.attemptsLeft),
						max: String(cfg.maxAttempts),
					});
				}
			}
			return backTo('invalid');
		}

		if (dbUrl) {
			// A fraud-blocked account never stays signed in: the strike
			// that blocked it already deleted its sessions; refuse here
			// too and drop the session this sign-in just created.
			const fraud = await getFraudInfoByEmail(dbUrl, email).catch(() => null);
			if (fraud?.blocked_at) {
				await clearUserSessions(dbUrl, fraud.id).catch(() => {});
				return backTo('blocked');
			}
			if (guard) await resetLoginFailures(dbUrl, 'user', guard.id).catch(() => {});
		}

		const headers = new Headers({ Location: next ?? '/account' });
		forwardCookies(res, headers);
		return new Response(null, { status: 303, headers });
	} catch {
		return backTo('server');
	}
};
