// Shared frontmatter gate for /admin pages: handles the ?key= bootstrap
// bridge (sets a session cookie, redirects to the clean URL) and reads
// the signed-in admin's email from the session cookie.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AstroLike = any;

import { getEnv } from './env';
import { SESSION_COOKIE, makeSessionValue, verifySessionValue } from './auth';

export async function adminGate(
	Astro: AstroLike,
): Promise<{ email: string | null; redirect?: Response }> {
	const key = Astro.url.searchParams.get('key');
	const secret = getEnv(Astro, 'ADMIN_SECRET');
	if (key && secret && key === secret) {
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
	const email = await verifySessionValue(Astro, Astro.cookies.get(SESSION_COOKIE)?.value);
	return { email };
}
