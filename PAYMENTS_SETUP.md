# Payments Setup — Pricing, Crypto Checkout & Orders

This site has a complete license checkout flow:

- `/pricing` — all license packages (data: `src/lib/packages.ts`).
- `/pay/<package-slug>` — checkout for exactly that package's amount. The
  customer picks **USDT, BTC or ETH**; only the selected currency's address
  and QR code are shown. After paying, the customer submits their details
  plus the **payment screenshot**.
- `/pay/status/<order-id>` — the customer's status page. It polls the server
  and shows *waiting* until the payment is confirmed, then *confirmed* plus
  "admin will contact you within 24 hours".
- `/admin` — the admin dashboard (email + password login): order review
  (view screenshots, confirm or reject), a package/price editor, and
  payment/download settings. Everything saved there is stored in the
  `site_settings` table and applies to the live site immediately.

## 1. Required configuration

Set these environment variables (see `.env.example` for the full list):

| Variable | Purpose |
| --- | --- |
| `PAYMENT_USDT_ADDRESS`, `PAYMENT_BTC_ADDRESS`, `PAYMENT_ETH_ADDRESS` | Your receiving addresses. Until at least one is set, checkout pages show a "being configured" notice instead of any address. |
| `PAYMENT_USDT_NETWORK` | `TRC20` (default) or `ERC20` — shown next to USDT everywhere. |
| `DATABASE_URL` | PostgreSQL connection string for orders (works on every platform, including Cloudflare). |
| `ADMIN_SECRET` | Signs admin sessions; opening any `/admin` page once with `?key=<value>` also signs you in (bootstrap/recovery). |
| `ADMIN_EMAIL` | Admin dashboard login email (set as a Secret). |
| `ADMIN_PASSWORD` | Admin dashboard login password (set as a Secret; chosen by the owner, never stored in the repo). |
| `STORAGE_DRIVER` | Where screenshots go: `local`, `s3` (incl. Cloudflare R2), or `github`. Plus the matching `S3_*` / `GITHUB_*` variables. |

Orders are stored in the `payment_orders` table (auto-created on first
use; `db/schema.sql` has the same schema).

## 2. Screenshot safety

Uploads are validated before storage: only PNG/JPEG/WebP **image
signatures** are accepted (executables or other files are rejected even if
renamed), max size is configurable (`MAX_UPLOAD_BYTES`, default 5 MB), and
tiny images are rejected as implausible screenshots. This is a sanity
check, not proof of payment — final trust comes from on-chain verification
and admin review.

## 3. Automatic confirmation — how it really works

When a customer includes their **transaction hash**, the status API checks
public explorers:

- **BTC** — mempool.space (no key). Also verifies the payment goes to your
  configured BTC address.
- **USDT (TRC20)** — Trongrid (no key).
- **ETH / USDT (ERC20)** — Etherscan (set `ETHERSCAN_API_KEY`, free).

If the transaction is confirmed on-chain, the order flips to `confirmed`
automatically. If there is no TX hash or no checker available, the order
stays `pending` until an admin confirms it in `/admin`. Nothing is ever
auto-confirmed from a screenshot alone.

## 4. Hosting notes

The same code runs on all supported hosts; only the env/storage choices
differ:

- **Cloudflare Workers** (this repo's current setup): set the variables in
  the Worker settings; use a **Hyperdrive** binding for PostgreSQL; use
  `STORAGE_DRIVER=s3` with an **R2** bucket (the local driver is not
  persistent on Workers).
- **Vercel**: set env vars in the project settings; `DATABASE_URL` to any
  Postgres (Neon/Supabase/etc.); use `s3` or `github` storage (serverless
  disks are ephemeral, so avoid `local`).
- **Node server / VPS**: `DATABASE_URL` + `STORAGE_DRIVER=local` works out
  of the box; screenshots are written to `UPLOAD_DIR`.
- **cPanel (Node.js app)**: same as a Node server; set env vars in the
  Node.js app settings and keep `UPLOAD_DIR` inside your app folder.

Local development: copy `.env.example` to `.env` (or `.env.local`), fill
in your values, and run `npm run dev`.

## 5. Current production setup (owner decision, 2026-10-23)

The live configuration currently uses: **USDT (TRC20) payments only**
(BTC/ETH addresses intentionally left empty for now), **PostgreSQL** via
`DATABASE_URL`, and **screenshot storage on GitHub** (`STORAGE_DRIVER=github`,
same repo, `payment-screenshots/` folder). This was verified end-to-end
locally with these exact settings. The screenshot location is temporary:
once the site is complete, screenshots will move to a separate
**private** repository (update `GITHUB_REPO` then).

Quick checklist to switch the live site on (Cloudflare dashboard):

1. Workers & Pages → your Worker → Settings → Variables and Secrets: add
   every variable from your `.env` file (`PAYMENT_USDT_ADDRESS`,
   `PAYMENT_USDT_NETWORK`, `DATABASE_URL`, `ADMIN_SECRET`,
   `STORAGE_DRIVER=github`, `GITHUB_OWNER`, `GITHUB_REPO`,
   `GITHUB_BRANCH`, `GITHUB_UPLOAD_DIR`, `GITHUB_TOKEN`,
   `ETHERSCAN_API_KEY`). Keep `DATABASE_URL`, `ADMIN_SECRET` and
   `GITHUB_TOKEN` as encrypted secrets.
2. If `pg` cannot reach your database from Workers directly, add a
   **Hyperdrive** binding named `HYPERDRIVE` for the same database
   instead of `DATABASE_URL`.
3. Redeploy. Until these variables exist, checkout pages show an
   "addresses are being configured" notice instead of any address.

## 6. Go-live log

- 2026-10-23: All variables confirmed saved in the Cloudflare dashboard
  (Production), with `DATABASE_URL`, `ADMIN_SECRET`, `GITHUB_TOKEN` and
  `ETHERSCAN_API_KEY` stored as encrypted secrets. This entry also serves
  as the deployment trigger that applies them.

## 7. Admin dashboard (added 2026-10-23)

- Login: `/admin` with `ADMIN_EMAIL` + `ADMIN_PASSWORD` (Runtime
  secrets). Sessions are signed cookies (7 days) signed with
  `ADMIN_SECRET`; the old `?key=<ADMIN_SECRET>` link still works as a
  bootstrap/recovery sign-in and is stripped from the URL on use.
- Sections: Dashboard (order counts + live config summary), Orders
  (confirm/reject/reset, screenshot viewing), Packages & Prices
  (duration, devices, price, save-note, popular, active, add/delete —
  the pricing page and checkout read these values), Payment & Download
  Settings (USDT/BTC/ETH addresses, USDT network, download link, file
  name/size, bot version, SHA-256).
- Storage: one JSON document in Postgres table `site_settings`
  (key `site`). Environment variables remain the fallback until the
  dashboard saves its first values; payment addresses saved in the
  dashboard are authoritative (an empty BTC/ETH field hides that
  currency at checkout).
- The database layer opens a fresh connection per operation with one
  retry — long-lived pools caused intermittent Worker 1101 errors when
  isolates were suspended and their sockets went stale.

## 8. Running on other platforms (portability)

The project is not locked to Cloudflare. The hosting adapter is picked
at build time (`DEPLOY_TARGET` in astro.config.mjs); configuration is
read from `process.env` everywhere; the database is plain PostgreSQL
(`DATABASE_URL`); screenshot storage drivers (github / s3 / local)
are platform-neutral.

- **Cloudflare Workers** (current production): default build —
  `npm run build` — deployed by Workers Builds from git, exactly as
  today. Nothing changes.
- **Any Node server / VPS / local machine**:
  `npm run build:node` then `npm start` (serves `dist/server/entry.mjs`
  with variables from `.env`; set `PORT`/`HOST` to taste). Put it
  behind any reverse proxy (nginx/Caddy) for HTTPS.
- **Vercel**: import the repo in Vercel — the build auto-selects the
  Vercel adapter (Vercel sets `VERCEL=1`); or build locally with
  `npm run build:vercel`. Add the same variables as Environment
  Variables in the Vercel project. On Vercel (serverless, read-only
  filesystem) keep `STORAGE_DRIVER=github` or `s3` — the `local`
  driver needs a writable disk, so use it only on a real server.
- Local development stays `npm run dev` on any OS.

## 9. Repository notes

- `worker-configuration.d.ts` is a generated file (`npm run cf-typegen`)
  and is intentionally NOT committed (see .gitignore). Nothing in the
  code depends on it: configuration is read from `process.env`, so the
  project type-checks and builds without it. Regenerate it only if you
  want editor types for Cloudflare bindings while developing.
- The homepage and site chrome live in components: `src/components/
  Header.astro`, `Footer.astro`, and `src/components/home/*` (Hero,
  Features, Showcase, HowItWorks, PricingStrip, Faq, CtaBand). Design
  tokens (colors, fonts) are in `src/styles/global.css` — change them
  there and the whole site follows.
