// Request-scoped helpers around the better-auth instance: build it
// from the current request's configuration, and read the signed-in
// account (customer or admin) from its session cookie.
import { getEnv, getDatabaseUrl } from './env';
import { createAuth, type Auth } from './auth-server';
import { ensureSchema } from './db';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CtxLike = any;

export function authFor(ctx: CtxLike): Auth | null {
	const dbUrl = getDatabaseUrl(ctx);
	if (!dbUrl) return null;
	const secret = getEnv(ctx, 'BETTER_AUTH_SECRET') ?? getEnv(ctx, 'ADMIN_SECRET');
	if (!secret) return null;
	return createAuth(dbUrl, secret);
}

/**
 * authFor + a guarantee that the database schema (including the
 * better-auth tables) exists. better-auth refuses to run against a
 * database missing its tables, and on a cold start an auth request
 * can arrive before any other page has created them.
 */
export async function authForRequest(ctx: CtxLike): Promise<Auth | null> {
	const dbUrl = getDatabaseUrl(ctx);
	if (!dbUrl) return null;
	try {
		await ensureSchema(dbUrl);
	} catch {
		// The auth call below will surface the real error if this matters.
	}
	return authFor(ctx);
}

export interface BaUser {
	id: string;
	email: string;
	name: string;
	role: string;
}

/** The better-auth user for this request, or null when signed out. */
export async function baSessionUser(ctx: CtxLike): Promise<BaUser | null> {
	const auth = await authForRequest(ctx);
	if (!auth) return null;
	try {
		const session = await auth.api.getSession({ headers: ctx.request.headers });
		if (!session) return null;
		const u = session.user as typeof session.user & { role?: string };
		return { id: u.id, email: u.email, name: u.name, role: u.role ?? 'user' };
	} catch {
		return null;
	}
}

/** Copy any Set-Cookie headers from a better-auth response onto ours. */
export function forwardCookies(from: Response, to: Headers): void {
	const cookies =
		typeof from.headers.getSetCookie === 'function'
			? from.headers.getSetCookie()
			: [from.headers.get('set-cookie')].filter((v): v is string => !!v);
	for (const c of cookies) to.append('Set-Cookie', c);
}
