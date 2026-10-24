// Shared frontmatter gate for /admin pages: handles the ?key= bootstrap
// bridge (sets a session cookie, redirects to the clean URL) and reads
// the signed-in admin's email from the session cookie.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AstroLike = any;

import { getEnv } from './env';
import { SESSION_COOKIE, makeSessionValue, verifySessionValue } from './auth';
import { baSessionUser } from './baSession';

export async function adminGate(
	Astro: AstroLike,
): Promise<{ email: string | null; redirect?: Response }> {
	const key = Astro.url.searchParams.get('key');
	const secret = getEnv(Astro, 'ADMIN_SECRET');
	// URL query decoding turns '+' into a space; the generated secret
	// never contains spaces, so restore '+' before comparing — a
	// hand-pasted ?key= link otherwise breaks for secrets with '+'.
	const keyOk = !!key && !!secret && (key === secret || key.replace(/ /g, '+') === secret);
	if (keyOk) {
		const email = getEnv(Astro, 'ADMIN_EMAIL') ?? 'admin';
		const value = await makeSessionValue(Astro, email);
		Astro.cookies.set(SESSION_COOKIE, value, {
			httpOnly: true,
			secure: true,
			sameSite: 'lax',
			path: '/',
			maxAge: 7 * 24 * 3600,
		});
		return { email, redirect: Astro.redirect(Astro.url.pathname) };
	}
	// better-auth session: admins are accounts with role 'admin'.
	const baUser = await baSessionUser(Astro);
	if (baUser?.role === 'admin') return { email: baUser.email };
	const email = await verifySessionValue(Astro, Astro.cookies.get(SESSION_COOKIE)?.value);
	return { email };
}
