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
- `/admin?key=<ADMIN_SECRET>` — order review: view screenshots, confirm or
  reject orders.

## 1. Required configuration

Set these environment variables (see `.env.example` for the full list):

| Variable | Purpose |
| --- | --- |
| `PAYMENT_USDT_ADDRESS`, `PAYMENT_BTC_ADDRESS`, `PAYMENT_ETH_ADDRESS` | Your receiving addresses. Until at least one is set, checkout pages show a "being configured" notice instead of any address. |
| `PAYMENT_USDT_NETWORK` | `TRC20` (default) or `ERC20` — shown next to USDT everywhere. |
| `DATABASE_URL` | PostgreSQL connection string for orders. On Cloudflare, a Hyperdrive binding named `HYPERDRIVE` can be used instead. |
| `ADMIN_SECRET` | Long random secret that protects `/admin` and screenshot viewing. |
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
