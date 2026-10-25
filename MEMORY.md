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

- 2026-10-24 (later): Admin Users pagination + Add New User page —
  /admin/users shows 20 users per page with numbered pagination
  (?page=N, ellipsis window); the add-user form moved to its own page
  /admin/users/new, linked as an indented "Add New User" submenu under
  Users in the sidebar (create errors return to that page).
- 2026-10-24 (later): Fraud strikes & blocking — the Orders page shows
  each payment screenshot as a small thumbnail that opens in a popup
  (close button / backdrop / Esc). Each order has a Fraud action:
  marking it adds a strike to the customer (`payment_orders.fraud_at`,
  `"user".fraud_count`); at 3 strikes the account is blocked
  (`blocked_at` + reason), its sessions are deleted, sign-in is refused
  with a blocked message, and checkout rejects new orders. Strikes and
  blocked state show on Orders, the Users list and the user detail
  page, which also has an Unblock action (orders keep their fraud
  marks as history).
- 2026-10-24 (later): Login lockout for customers AND admins —
  wrong-password attempts are counted per account (`failed_logins`,
  `lock_level`, `lock_day`, `locked_until` on both `"user"` and
  `admin_users`). Reaching the limit locks the account; the lock
  escalates per lockout on the same day (America/New_York): 1st →
  firstHours, 2nd → secondHours, 3rd+ → thirdDays. Defaults 3
  attempts / 1h / 12h / 7d, editable in Admin → Settings → Login
  lockout (stored in the `lockout` section of site settings). Sign-in
  pages show attempts remaining after a failure and the remaining
  lock time while locked; the Users list/detail show live lock
  status, and the detail page can lift a lock early (Unlock login).
- 2026-10-24 (later): Google Analytics (GA4) support — `GA_MEASUREMENT_ID`
  in `src/config/site.ts` (empty = disabled); BaseHead loads gtag.js on
  public pages only (never admin/account/checkout/auth). Verified with a
  dummy ID in a local build (renders on /faq, absent on /404). The real
  Measurement ID still has to be pasted into site.ts by the owner.
- 2026-10-24 (later): Owner filled site.ts himself (commit 6f2f640):
  ADS_TXT is now his AdSense line and the Google/Bing/Pinterest
  verification codes are set. The GA commit (d8e22eb) was based on a
  pre-edit copy and overwrote site.ts; 0987007 restored his values
  verbatim (Google value normalized to the bare token — the meta tag
  renders it as the content attribute) and kept the GA block.
  Lesson: when the remote head has moved, diff the actual files
  before pushing, not just the head.
- 2026-10-24 (later): Cookie consent (owner's CookieConsent.astro from
  his Quran Studio project, adapted) — `src/components/CookieConsent.astro`
  is mounted from the Footer on public pages and owns GA loading: the
  banner shows Accept/Decline (choice in localStorage `ytcpm-consent`),
  GA4 loads only after Accept, never after Decline. The unconditional
  gtag block added with d8e22eb is removed from BaseHead. Privacy page
  gained a "Cookies and analytics" section (the old "we do not run
  analytics trackers" line was removed). The owner set the real
  GA_MEASUREMENT_ID (G-NCM400NB7C) himself in d882f9eb.
- 2026-10-24 (later): AdSense option in site.ts — `ADSENSE_CLIENT_ID`
  renders the adsbygoogle script in the head of every public page via
  BaseHead (noindex areas excluded). Value as supplied by the owner:
  ca-pub-8198067510150459 — note this DIFFERS from the ads.txt
  publisher (pub-1802003890783048); the owner was asked to confirm
  which AdSense account is the right one, since script and ads.txt
  must match for verification.
- 2026-10-24 (later): Blog cover images had empty alt text (Bing
  Webmaster flagged every post + the index). BlogPost layout and the
  blog index now use the post title as the cover's alt; covers are
  branded title cards, so the title is the accurate description.
- 2026-10-24 (later): Two post titles exceeded Bing's 70-character
  title limit and were shortened (keywords and meaning kept; the
  cover images use their own short display titles, so no cover
  changes were needed): "Browser Fingerprinting Explained: Why User
  Agents Aren't Enough" (63) and "Residential vs Datacenter vs
  Mobile Proxies: Which Do You Need?" (63).
- 2026-10-24 (later): /blog had no H1 at all (Bing notice) — the index
  went straight into the post grid. Added "The YTCPM Blog" H1 with a
  short intro line above the grid. A sweep of every public page
  confirmed all others have exactly one H1.
- 2026-10-24 (later): Full on-page SEO audit (all 22 public pages)
  followed by the fix batch the owner approved: /blog has its own
  title + unique description (it previously inherited the site
  defaults and duplicated the homepage description); card links no
  longer carry the trailing slash; card titles are H2 under the H1
  (were H4) with lazy card images; 13 over-160-char meta descriptions
  trimmed (site description, instructions, disclaimer, 9 posts);
  homepage screenshots (Hero + Showcase) carry width/height (CLS);
  posts gained a BreadcrumbList schema node, and BlogPosting
  mainEntityOfPage no longer ends in .html (clean pageUrl). consts.ts
  now re-exports SITE_TITLE/SITE_DESCRIPTION from config/site.ts so
  the starter-era duplicate cannot drift again. Owner-side, still
  open: Cloudflare "Always Use HTTPS" (http currently serves 200
  without redirecting). www intentionally has no DNS record — the
  owner wants only https://ytcpm.cyou to exist.
- 2026-10-24 (later): Privacy page gained the "Advertising" section
  AdSense review requires (third-party/Google ad cookies, personalized
  ads based on prior visits, opt-out via Google Ads Settings and
  aboutads.info; ads only on public pages) — the last known gap in
  the site's AdSense readiness. Technical setup verified complete:
  script + matching ads.txt publisher; content/pages all present.
  Approval itself is Google's call (product-category risk flagged to
  the owner honestly).
- 2026-10-24 (later): Discovery endpoints upgraded for maximum
  pickup. sitemap.xml: posts now declare their cover image
  (image sitemap extension) and static pages no longer carry a
  build-date <lastmod> (it claimed freshness that was not real;
  posts keep true updatedDate ?? pubDate). rss.xml: every item now
  carries the full article as sanitized HTML in <content:encoded>
  (marked + sanitize-html, relative URLs absolutized) plus channel
  <lastBuildDate> and <image>. llms.txt: new generated "Blog posts"
  section listing every post with its description, and a new
  /llms-full.txt with the complete markdown of all posts — both are
  generated from the content collection, so new posts appear
  automatically.
- 2026-10-24 (later): PageSpeed pass (owner target: 99+ everywhere).
  Fonts are self-hosted now (public/fonts, @font-face in global.css,
  Inter 400/500 + Jakarta 800 preloaded in BaseHead; the Google Fonts
  stylesheet is gone — it was render-blocking). Screenshots are real
  files under public/images/shots/ (screenshots.ts holds paths, not
  data URIs — the instructions page HTML dropped from ~206 KB to a
  fraction). Blog covers gained WebP variants (full + 720w) served
  via <picture>/srcset on the index cards and post hero; the first
  card is eager/fetchpriority=high, the post hero high priority.
  Accessibility: --accent deepened to #c2410c (hover #9a3412) and
  --gray to 122,102,84 so orange/gray text passes WCAG AA; inline
  <code> on its chip uses gray-dark. Instructions step-4 list markup
  fixed (figures now inside their <li>). Local Lighthouse after the
  pass: Accessibility 100 and SEO 100 on every template, desktop
  Performance 100 on 8/9 templates, mobile 95–100 (the residual is
  local dev-server latency; production is edge-served).
- 2026-10-24 (later): TTFB fix. Live timings showed the SSR pages
  were slow (home ~1.3s, pricing ~2.4s TTFB vs ~0.4s for static
  pages): every DB operation opened a fresh connection AND re-ran
  the whole schema DDL, and nothing cached the rendered HTML.
  db.ts now applies the schema once per isolate (re-armed if a query
  reports a missing table/column); the settings cache TTL rose to
  60s. A new src/middleware.ts caches the anonymous HTML of /, 
  /pricing and /download in the Cloudflare Cache API for 120s
  (session-cookie requests always bypass; x-page-cache header marks
  HIT/MISS). AdSense no longer loads in <head>: BaseHead injects it
  on window load + idle or first interaction, so it cannot compete
  with first paint/LCP. Hero image got fetchpriority="high".
  Verified locally end-to-end (cache HIT at ~0.03s, test order →
  admin confirm → confirmed, lockout path, all test data deleted).
- 2026-10-24 (later): Best Practices + critical-path round. The
  owner's live PSI dropped Best Practices to 81 on ONE audit —
  "Uses deprecated APIs": Google's own AdSense library (lidar.js)
  registers deprecated unload listeners. Since that code is Google's,
  AdSense is now consent-gated exactly like GA: BaseHead's loader
  waits for the 'ytcpm-consent' event (or a stored acceptance) from
  CookieConsent before injecting the script, still deferred to
  load+idle/interaction after that. Banner text now mentions ads,
  and /privacy's Advertising section says ads load only on consent.
  Also from his PSI insights: all CSS is inlined into the HTML
  (astro.config build.inlineStylesheets 'always' — the separate
  files were render-blocking), the font preload set is now the
  above-the-fold weights (Inter 400/600/700, Jakarta 700/800), and
  the homepage screenshots have 480w/688w variants with srcset
  (Hero + Showcase). Local Lighthouse after this round: A11Y/BP/SEO
  100, zero render-blocking and zero image-delivery findings.
- 2026-10-24 (later): the AdSense consent gate is now a switch —
  ADS_REQUIRE_CONSENT in src/config/site.ts (right under the client
  ID). false = ads load for every visitor (still deferred past page
  load); true = ads wait for cookie consent like GA. Currently
  FALSE at the owner's direction so the AdSense review sees the ad
  code running; he will flip it to true himself after approval.
  The /privacy Advertising consent sentence renders only when the
  switch is on, so the text always matches the behavior. Both
  states verified locally in a real browser before shipping.
- 2026-10-24 (later): PayPal + Stripe payment methods. Every
  checkout method now follows one rule (availableMethods in
  src/lib/settings.ts): it appears only when ENABLED in Admin →
  Settings AND its value is complete. Crypto gained per-currency
  switches (usdtEnabled/btcEnabled/ethEnabled; settings saved
  before the switches derive them from whether an address is
  filled in, so behavior did not change). PayPal = an email in
  settings (customer sends there, submits the transaction ID +
  screenshot; admin confirms manually). Stripe = a Payment Link
  URL from the Stripe dashboard (customer pays on Stripe's page
  with their email prefilled, then submits the receipt screenshot).
  Orders store the method in the existing crypto column
  ('PayPal'/'Stripe'); chain auto-confirm ignores them. The orders
  API rejects any method the checkout does not currently offer.
  Payment values live in the DATABASE (site_settings) — the
  dashboard is authoritative; env vars are only the fallback.
  E2E-verified locally end to end; prod settings restored
  byte-for-byte and all test data deleted afterwards.
