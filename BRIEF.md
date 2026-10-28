# Brightloop — final build brief (plan + Vishal's instructions, merged)

Date: 16 Oct 2026. This file replaces the plan for building purposes. Anything marked **FIX** is a correction or gap found in the original plan.

## 1. Goal
Five-page static site plus a privacy note. Every page builds credibility, shows the work, and ends with one "Book a discovery call" button. No database.

## 2. Pages
| Page | URL | Must contain |
|---|---|---|
| Home | `/` | Headline, reels row, how it works, services teaser, proof strip, short FAQ, booking CTA |
| Services | `/services` | Social media management, content & branding, paid ads, 1:1 audit, process, packages (hidden until client confirms prices) |
| Our Work | `/work` | Reels wall, case studies (problem → what we did → result), results only with permission |
| About | `/about` | Founder story, team, values, "why only a few brands a month" |
| Book a call | `/book` | Cal.com calendar (visitor's time zone), short form fallback, what happens after booking |
| Privacy note | `/privacy` | What the form, booking tool and analytics collect |
| **FIX** 404 | `/404` | Missing in plan. Broken Instagram links otherwise land on a host error page |

Shared header: logo, menu, theme toggle, "Book a discovery call". Shared footer: Instagram, email, privacy note.

## 3. Stack (unchanged, with fixes)
- Plain HTML, CSS, one small JS file. **FIX:** header and footer are kept once in `src/partials/` and a zero-dependency `build.mjs` stitches pages into `dist/`. Without this, six copies of the header drift apart on the first edit. Cloudflare Pages: build command `node build.mjs`, output folder `dist`.
- Hosting: Cloudflare Pages (Netlify fallback). Not Vercel Hobby (non-commercial only).
- Booking: Cal.com free. Form: Web3Forms free (250/month).
- Analytics: Cloudflare Web Analytics. Meta Pixel off until the client says yes (then a consent banner is required).
- Fonts: Syne (headings) + Manrope (body), self-hosted WOFF2, chosen from the ui-ux-pro-max "Fashion Forward" pairing for creative agencies.

## 4. Design direction (ui-ux-pro-max + 21st.dev)
ui-ux-pro-max match for "Marketing Agency": storytelling + feature-rich layout, bold expressive type, motion-driven with portfolio reveals and results animation; must-haves are portfolio and results; anti-pattern is "boring design + hidden work". Palette family: bold pink + deep cherry.

Applied:
- Brand accents: Instagram pink, butter, cherry. Accents and glows only, never page backgrounds.
- Dark mode: warm cherry-black, not pure black; borders instead of shadows.
- Light mode: warm cream, not pure white; text accent is the darker cherry (pink fails 4.5:1 on light).
- 21st.dev-style elements, rebuilt in vanilla CSS/JS (21st.dev ships React + Tailwind + Framer Motion, which the plan rules out): aurora glow hero, rotating headline word, infinite marquee, spotlight (cursor-glow) cards, bento services grid, phone-frame reels, shimmer CTA button, animated counter strip, accordion FAQ, animated sun/moon toggle, scroll reveals.
- All motion is CSS transform/opacity only, and stops under `prefers-reduced-motion`.

## 5. Corrections and gaps found in the plan
1. **Weight budget vs Cal.com.** The Cal.com embed alone is larger than the 100 KB budget. The budget applies to first-party files only; Cal.com loads only on `/book`, only when the calendar scrolls into view or "Show times" is pressed.
2. **No SEO / sharing basics.** Added: title + description per page, canonical URL, Open Graph + Twitter card (links shared in Instagram DMs/WhatsApp need a preview image), `sitemap.xml`, `robots.txt`, Organization structured data, favicon set, web manifest.
3. **Security headers.** `_headers` file for Cloudflare: HSTS, nosniff, referrer policy, frame-ancestors, and long cache for `/assets/*` with versioned filenames.
4. **Privacy law.** India's DPDP Act 2023 applies to names/emails collected. Privacy note states purpose, retention, processors (Web3Forms, Cal.com, Cloudflare) and a contact for deletion requests. Form has a consent line.
5. **Form spam and failure.** Honeypot field, client-side validation with errors next to fields, visible success/failure states, and a no-JavaScript fallback (plain POST still works).
6. **Web3Forms key** is public by design; restrict it to the client's domain in the Web3Forms dashboard.
7. **iOS video.** Reels need `muted playsinline` or they will not autoplay on iPhone. Only on-screen reels play.
8. **Theme storage.** Saved choice is read inside try/catch so private browsing does not break the page.
9. **Proof honesty.** Every stat, testimonial, case study and team member ships as a visibly labelled placeholder until the client confirms it. Nothing invented. "20+ clients" stays off until confirmed.
10. **Dependency.** Cal.com account must exist before Day 7; tie it to the content date like the other files.
11. **Instagram tracking.** Bio link uses `?utm_source=instagram&utm_medium=bio`.
12. **Price note.** "₹24,999 + ₹3,000 per extra page" only gives ₹31k–34k if the Standard package covers 2–3 pages; confirm what Standard includes, and whether prices are before GST.

## 6. Suggestions (optional, for the client)
- Add a WhatsApp button next to the form; most Indian small-business enquiries prefer it, and it costs nothing.
- Get one short video testimonial; it outperforms any written quote on an Instagram-led audience.
- Turn the 1:1 audit into a paid Cal.com event later; the free plan supports it via Stripe when they are ready.

## 7. Still waiting on the client
Logo (light + dark), brand kit hex values and fonts, 6–8 reels with permission, page copy, testimonials with permission, founder/team photos, domain DNS access, Cal.com account, Web3Forms key, Meta Pixel yes/no, budget, deadline, the one approver.

## 8. Blog (added 16 Oct)
Blog list at `/blog/`, posts at `/blog/<name>`, written by the client at `/admin` (Decap CMS + GitHub login on Cloudflare). Setup steps in README → Blog.

## 9. Where placeholders live
- `src/config.json` — business name, email, Instagram handle, Cal.com link, Web3Forms key, site URL.
- Search the source for `data-placeholder` to find every block that needs real content.

## 10. Redesign + features (17 Oct)
- Theme customizer: 3 palettes (Cherry, Grape, Sunset) × light/dark/system, accent colour, corner style, motion level, reset. Saved per visitor, applied before paint.
- Studio hero (phone playing an IG story + workflow notifications), story-bar scroll progress, cross-page View Transitions, double-tap hearts, magnetic main button.
- Blog: categories, tags, featured banner, search, Show more, category pages, related posts, share buttons, RSS, scheduled posts (daily rebuild via GitHub Action + Cloudflare deploy hook), richer editor (filters, preview, upload limit).
- SEO: Twitter cards, og:image:alt, article meta, WebSite/Blog/BlogPosting/BreadcrumbList structured data, per-post lastmod in sitemap, RSS.
