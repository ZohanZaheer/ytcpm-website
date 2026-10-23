type Runtime = import("@astrojs/cloudflare").Runtime<Env>;

declare namespace App {
  interface Locals extends Runtime {}
}

// The `cloudflare:workers` module (used by src/lib/env.ts) is typed in
// full by `wrangler types` (npm run cf-typegen); this minimal declaration
// keeps `tsc` satisfied in a fresh checkout before that runs.
declare module "cloudflare:workers" {
  export const env: Record<string, unknown>;
}
