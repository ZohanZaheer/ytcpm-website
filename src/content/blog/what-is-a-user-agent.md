---
title: "What Is a User Agent? Your Browser's ID Card, Explained"
description: "A user agent is the string your browser sends to every website — browser, version, OS and device in one line. How it is built, and why it matters."
pubDate: "Oct 21 2026"
heroImage: "/blog/what-is-a-user-agent.jpg"
---

Every time your browser opens a website, it introduces itself with a single line of text called the **user agent** (UA). The site reads it and decides what to serve you — the mobile layout or the desktop one, the right download for your operating system, the video format your browser can play. This guide explains what a user agent is, how to read one, and why it quietly matters for everything from web development to multi-browser work.

## A real user agent, dissected

Here is what a current Chrome browser on Windows sends:

```
Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36
```

Read it piece by piece:

| Part | Meaning |
|---|---|
| `Mozilla/5.0` | A historical compatibility token — nearly every browser claims it, a leftover from the 1990s browser wars |
| `Windows NT 10.0; Win64; x64` | Operating system (Windows), 64-bit, on x64 hardware |
| `AppleWebKit/537.36` | The rendering engine family |
| `(KHTML, like Gecko)` | Another compatibility token engines carry |
| `Chrome/144.0.0.0` | The actual browser and its version |
| `Safari/537.36` | Yes, another compatibility token — Chrome is not Safari |

Those layers of imitation are why UA strings look like a pile of other browsers' names: decades of websites serving content by *which browser asked*, so every browser learned to claim it was also the others. The UA is best understood as a **negotiated ID card**, not a precise spec sheet.

## What a website learns from your user agent

From that one line — plus the request it rides in — a site can infer:

- Browser family and version (serve compatible code and formats)
- Operating system and device type (touch layout? app-store link for iOS or Android?)
- Rough form factor (phone, tablet, desktop, TV, bot crawler)

What it does **not** contain, despite popular belief: your name, your accounts, your location (that comes from your IP address), or anything truly unique. Millions of devices running the same Chrome version on Windows share a byte-identical user agent — which is exactly why sites that need to tell visitors apart combine the UA with many other signals, a technique called [browser fingerprinting](/blog/browser-fingerprinting-explained).

## Where user agents do real work

- **Responsive serving:** sites deliver mobile or desktop pages based on the UA before any script runs.
- **Downloads and updates:** "Download for Windows / macOS / Android" buttons pre-select using the UA.
- **Analytics:** your traffic reports' device and browser breakdowns are mostly parsed UA strings.
- **Crawlers identify themselves honestly:** search engines send UAs naming their bot (for example, Googlebot) so sites can treat them correctly.
- **Testing:** developers switch UA to preview how a site behaves for other devices without owning them all.

## How to see (and change) your user agent

- **See yours:** any "what is my user agent" checker will print it, or open your browser's developer tools and run `navigator.userAgent` in the console.
- **Change it temporarily:** developer tools in Chrome, Edge and Firefox include device emulation with UA switching built in.
- **Change it per profile:** multi-browser workflows assign **a UA per browser profile** rather than per machine. The YTCPM Bot, for example, documents four Select User Agents modes in its [instructions](/instructions) — **Off** (built-in default), **Auto** (loads UAs from a web page), **List Mix** (random selection from your list, repeats possible) and **List Unique** (each line used once per run) — because when ten browsers run side by side, ten identical "ID cards" on one machine is itself a pattern worth managing.

## The catch: the UA must agree with everything else

A user agent is a *claim*, and browsers leak the truth elsewhere: JavaScript reports the platform, installed fonts hint at the OS, screen size hints at the device. A UA claiming "Windows" on a browser whose fonts and graphics say "macOS" is a contradiction any serious system spots instantly. Consistency — UA matching the rest of the browser's signals — is the whole game, which is the subject of [browser fingerprinting explained](/blog/browser-fingerprinting-explained). It is also why Chrome is gradually *reducing* UA detail and moving to User-Agent Client Hints, where sites ask for specific facts instead of receiving the full string by default.

## Frequently asked questions

**Is a user agent the same as a browser?**
No. The browser is the software; the user agent is the identification string it sends. Apps and crawlers have user agents too.

**Can two different devices have the same user agent?**
Yes — constantly. Same browser version + same OS = same string, across millions of devices.

**Does changing my user agent make me anonymous?**
No. It changes one line of your introduction while your IP address and dozens of other signals stay the same. It is a compatibility and organization tool, not an invisibility cloak.
