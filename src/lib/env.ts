// Environment access for server code.
//
// Astro v6+ removed `Astro.locals.runtime.env`; on Cloudflare the
// supported way to read bindings and variables is the
// `cloudflare:workers` module. The `ctx` argument is kept (and ignored)
// so existing call sites — getEnv(ctx, 'KEY') — do not change.
//
// In local Astro dev the same module is populated from the project's
// wrangler config vars and .dev.vars, exactly like production.

import { env as cfEnv } from 'cloudflare:workers';

interface CtxLike {
	locals?: unknown;
}

type EnvRecord = Record<string, unknown>;

function cf(): EnvRecord {
	return (cfEnv ?? {}) as unknown as EnvRecord;
}

export function getEnv(_ctx: CtxLike, key: string): string | undefined {
	const v = cf()[key];
	return typeof v === 'string' && v !== '' ? v : undefined;
}

export function getDatabaseUrl(_ctx: CtxLike): string | undefined {
	// A Cloudflare Hyperdrive binding takes precedence when present:
	// add a `hyperdrive` entry named HYPERDRIVE to the wrangler config.
	const hd = cf()['HYPERDRIVE'] as { connectionString?: string } | undefined;
	if (hd?.connectionString) return hd.connectionString;
	return getEnv(_ctx, 'DATABASE_URL');
}
