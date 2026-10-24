# MEMORY.md — ytcpm-website

## Repo

- GitHub: ZohanZaheer/ytcpm-website (private, default branch `main`)
- Purpose: official website for the YTCPM Bot — storefront, crypto
  checkout, customer accounts, admin dashboard, blog
- Live: https://ytcpm.cyou (Cloudflare Workers Builds, Git-connected)
- Owner: Zohan Zaheer. Docs: [`README.md`](README.md) ·
  [`AGENTS.md`](AGENTS.md) · [`CLAUDE.md`](CLAUDE.md) ·
  [`PAYMENTS_SETUP.md`](PAYMENTS_SETUP.md) · [`.env.example`](.env.example)

## Product facts (owner-confirmed — never invent others)

- Bot: standalone Windows app, current version 3.0.4,
  `public/YoutubeCPM.zip` (17.0 MB); first run downloads up to 2.0 GB
  of engine; ~2.5 GB free space; each browser ≈ 2 GB RAM.
- Licenses: 1 / 6 / 12 months and lifetime, 100–500 devices,
  $500–$20,000 (exact rows live in the `packages` table / admin).
- Support: 6 days a week, 10:00 AM–6:00 PM New York time.
- The site's design reference is nicheminer.net's style: ivory
  `#fff7ed`, burnt orange `#ea580c`, Inter + Plus Jakarta Sans.

## Log

- **2026-10-23:** Launch day. Astro 7.4 redesign in the nicheminer
  style; full-width layout + clean URLs; pricing + crypto checkout
  (USDT/BTC/ETH, screenshot proof, on-chain auto-confirm) with orders
  in PostgreSQL; admin dashboard (orders, packages, settings) with
  `site_settings` persistence; contact form → /admin/messages;
  /faq, /privacy, /terms, /contact; /download + /instructions with the
  bot ZIP in-repo; Cloudflare runtime-vs-build variables lesson
  recorded in PAYMENTS_SETUP.md §5.
- **2026-10-23 (evening):** Accounts overhaul — better-auth customer
  accounts with full registration profiles, email verification via
  Resend, checkout gated to signed-in (verified) customers; separate
  `admin_users` table (customers can never admin-login); packages moved
  to their own table with `duration_days`; bot licenses
  (/admin/licenses assigns bot credentials; customers see them only
  after the license is marked fulfilled); priority support requests
  from /account/support → /admin/requests; proper AdminShell (dark
  sidebar) + customer account shell; blog launched (10 researched
  posts, branded covers).
- **2026-10-24:** Mobile responsiveness passes (verified by headless
  Chromium at 360×800): wide tables scroll inside their own box, blog
  tables scroll inside the article, global `main` is border-box,
  auth cards get fluid side padding; dashboard sidebar links stack
  vertically; the license "Contact about this license" button is a
  one-line full-width pill inside the credentials box.
- **2026-10-24:** Registration rules (owner-set): usernames 8–15
  chars, letters+digits, start with a letter, reserved words
  (admin, owner, …) blocked; passwords ≥ 8 chars with letter + digit
  + special — enforced at signup and password change, with live
  tick-off checklists on /signup. Signup field order: Full name,
  Email, Username, Password, then the rest. Account band greets by
  profile full name. Admin **Users** section added (/admin/users +
  /admin/users/[id]): all customers, details, manual user creation,
  license assignment.
- **2026-10-24:** Error/legal/discovery pages: custom /404 and /500,
  /disclaimer, /sitemap (HTML). SEO suite per the owner's reference
  pattern: `src/config/site.ts` as the single source for canonical,
  full OG/Twitter meta and JSON-LD (WebSite + Organization +
  SoftwareApplication with AggregateOffer; BlogPosting on posts,
  FAQPage on /faq — generated from the page's own Q&A array);
  private areas are noindex by path in BaseHead. Hand-rolled `.ts`
  endpoints replace the plugins/starter files: /sitemap.xml (public
  pages + blog posts, linked by `post.id`), /rss.xml (blog feed;
  starter `rss.xml.js` removed), /robots.txt (disallows private
  areas), /ads.txt (declares no authorized ad sellers), /llms.txt.
  `@astrojs/sitemap` integration removed. `.env.example` completed
  (incl. BETTER_AUTH_SECRET), README rewritten with a homepage
  screenshot, `vercel.json` added, and this docs trio
  (`AGENTS.md` / `CLAUDE.md` / `MEMORY.md`) created.
