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
