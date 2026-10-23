// Portable environment access.
// Works on Cloudflare Workers (locals.runtime.env), Vercel / Node / cPanel
// (import.meta.env and process.env), and local dev (.env / .env.local).

interface CtxLike {
	locals?: unknown;
}

export function getEnv(ctx: CtxLike | undefined, key: string): string | undefined {
	const locals = (ctx?.locals ?? {}) as Record<string, unknown>;
	const runtime = locals.runtime as { env?: Record<string, unknown> } | undefined;
	const fromRuntime = runtime?.env?.[key];
	if (fromRuntime != null && fromRuntime !== '') return String(fromRuntime);

	const fromMeta = (import.meta.env as Record<string, unknown>)[key];
	if (fromMeta != null && fromMeta !== '') return String(fromMeta);

	if (typeof process !== 'undefined' && process.env && process.env[key]) {
		return process.env[key];
	}
	return undefined;
}

/** Postgres connection string: Hyperdrive binding first, then DATABASE_URL. */
export function getDatabaseUrl(ctx: CtxLike | undefined): string | undefined {
	const locals = (ctx?.locals ?? {}) as Record<string, unknown>;
	const runtime = locals.runtime as { env?: Record<string, unknown> } | undefined;
	const hyperdrive = runtime?.env?.HYPERDRIVE as { connectionString?: string } | undefined;
	if (hyperdrive?.connectionString) return hyperdrive.connectionString;
	return getEnv(ctx, 'DATABASE_URL');
}
