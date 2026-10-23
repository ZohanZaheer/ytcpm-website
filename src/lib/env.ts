// Environment access for server code — deliberately platform-neutral.
//
// Every platform this project can run on exposes configuration the
// same way:
//   - Node server / local dev: real environment variables
//     (locally: the .env file, loaded by Astro in dev or by
//     `node --env-file=.env` / the shell in production).
//   - Vercel: project Environment Variables → process.env.
//   - Cloudflare Workers: with the `nodejs_compat` flag (set in
//     wrangler.json), Worker vars and secrets are also exposed as
//     process.env — so no Cloudflare-specific API is needed anywhere.
//
// The `ctx` argument is accepted (and ignored) for call-site
// compatibility with older Astro code.

interface CtxLike {
	locals?: unknown;
}

export function getEnv(_ctx: CtxLike, key: string): string | undefined {
	const v = process.env?.[key];
	return typeof v === 'string' && v !== '' ? v : undefined;
}

export function getDatabaseUrl(ctx: CtxLike): string | undefined {
	// Portable everywhere: a plain PostgreSQL connection string.
	// (The old Cloudflare-Hyperdrive binding path was removed together
	// with the platform lock-in; DATABASE_URL works on every host,
	// including Cloudflare.)
	return getEnv(ctx, 'DATABASE_URL');
}
