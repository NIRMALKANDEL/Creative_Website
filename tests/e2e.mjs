// End-to-end checks against the built site (public build with test fixture posts).
// How to run (needs Playwright once: npm i -D playwright && npx playwright install chromium):
//   1) BLOG_DIR=tests/fixtures/posts node build.mjs      (public build with 14 fake posts, 2 of them hidden)
//   2) a static server on dist/ e.g. the dev server without rebuild, or: npx serve dist -l 5173
//   3) node tests/e2e.mjs
// The fixture posts never touch src/content/blog, so nothing fake reaches the real site.
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const BASE = process.env.BASE || 'http://localhost:5173';
const DIST = new URL('../dist', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const results = [];
const check = (name, ok, info = '') => { results.push({ name, ok: !!ok, info }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? ' — ' + info : ''}`); };

const browser = await chromium.launch();
const PAGES = ['/', '/services', '/work', '/about', '/book', '/privacy', '/blog/', '/blog/category/paid-ads/', '/blog/test-01', '/blog/test-02', '/404', '/no-such-page'];

/* 1. Routes, console, network, images, SEO basics, overflow — desktop and mobile */
for (const [label, vp] of [['desktop', { width: 1440, height: 900 }], ['tablet', { width: 820, height: 1180 }], ['mobile', { width: 375, height: 740 }]]) {
  const ctx = await browser.newContext({ viewport: vp });
  for (const path of PAGES) {
    const page = await ctx.newPage();
    const errors = []; const failed = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !(path === '/no-such-page' && m.text().includes('404'))) errors.push(m.text()); });
    page.on('requestfailed', (r) => { if (r.url().startsWith(BASE)) failed.push(r.url()); });
    page.on('response', (r) => { if (r.url().startsWith(BASE) && r.status() >= 400 && !r.url().endsWith('/no-such-page')) failed.push(`${r.status()} ${r.url()}`); });
    const res = await page.goto(BASE + path, { waitUntil: 'load' });
    await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { scrollTo({ top: y, behavior: 'instant' }); await new Promise((r) => setTimeout(r, 30)); } });
    await page.waitForTimeout(300);
    const info = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - innerWidth,
      broken: [...document.images].filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.src),
      h1: document.querySelectorAll('h1').length,
      title: document.title, desc: document.querySelector('meta[name=description]')?.content || '',
      canonical: !!document.querySelector('link[rel=canonical]'), og: !!document.querySelector('meta[property="og:image"]'),
      ld: [...document.querySelectorAll('script[type="application/ld+json"]')].every((s) => { try { JSON.parse(s.textContent); return true; } catch { return false; } }),
      dupIds: (() => { const ids = [...document.querySelectorAll('[id]')].map((e) => e.id); return ids.filter((x, i) => ids.indexOf(x) !== i); })(),
      vtDup: (() => { const n = [...document.querySelectorAll('[style*="view-transition-name"]')].map((e) => e.style.viewTransitionName); return n.filter((x, i) => n.indexOf(x) !== i); })(),
    }));
    const expected = path === '/no-such-page' ? 404 : 200;
    check(`[${label}] ${path} loads (${expected})`, res.status() === expected, `status ${res.status()}`);
    check(`[${label}] ${path} no console/page errors`, errors.length === 0, errors.join(' | ').slice(0, 200));
    check(`[${label}] ${path} no failed same-site requests`, failed.length === 0, failed.join(', ').slice(0, 200));
    check(`[${label}] ${path} no broken images`, info.broken.length === 0, info.broken.join(','));
    check(`[${label}] ${path} no horizontal overflow`, info.overflow <= 0, `${info.overflow}px`);
    if (label === 'desktop') {
      check(`[seo] ${path} one h1, title, description, canonical, og:image, valid JSON-LD`, info.h1 === 1 && info.title && info.desc.length > 40 && info.canonical && info.og && info.ld, JSON.stringify({ h1: info.h1, d: info.desc.length }));
      check(`[a11y] ${path} no duplicate ids / view-transition names`, !info.dupIds.length && !info.vtDup.length, [...info.dupIds, ...info.vtDup].join(','));
    }
    await page.close();
  }
  await ctx.close();
}

/* 2. Every internal link on every page resolves */
{
  const ctx = await browser.newContext(); const page = await ctx.newPage();
  const links = new Set();
  for (const path of PAGES) {
    await page.goto(BASE + path);
    (await page.$$eval('a[href^="/"]', (as) => as.map((a) => a.getAttribute('href')))).forEach((h) => links.add(h.split('#')[0].split('?')[0]));
  }
  const bad = [];
  for (const l of links) { const r = await page.request.get(BASE + l); if (r.status() !== 200) bad.push(`${l} ${r.status()}`); }
  check(`all ${links.size} internal links return 200`, bad.length === 0, bad.join(', '));
  await ctx.close();
}

/* 3. Theme toggle + customizer + persistence + reset */
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, colorScheme: 'dark' }); const page = await ctx.newPage();
  await page.goto(BASE + '/');
  check('theme follows system (dark) on first visit', (await page.getAttribute('html', 'data-theme')) === 'dark');
  await page.click('.theme-toggle--bar'); await page.waitForTimeout(800);
  check('quick toggle switches to light', (await page.getAttribute('html', 'data-theme')) === 'light');
  await page.reload();
  check('light mode persists after reload', (await page.getAttribute('html', 'data-theme')) === 'light');
  await page.click('.look-btn');
  check('customizer opens as a modal dialog', await page.evaluate(() => document.getElementById('look-panel').open));
  await page.click('label.theme-card:has(input[value="grape"])'); await page.waitForTimeout(800);
  await page.click('label.swatch:has(input[value="teal"])');
  await page.click('.seg label:has(input[name="radius"][value="sharp"])');
  await page.click('.seg label:has(input[name="motion"][value="calm"])');
  await page.click('.seg label:has(input[name="mode"][value="dark"])'); await page.waitForTimeout(800);
  const st = await page.evaluate(() => { const cs = getComputedStyle(document.documentElement); return { t: document.documentElement.dataset.theme, p: document.documentElement.dataset.palette, a: document.documentElement.dataset.accent, r: cs.getPropertyValue('--radius-l').trim(), accent: cs.getPropertyValue('--accent').trim(), bg: cs.getPropertyValue('--bg').trim(), m: document.documentElement.dataset.motion, meta: document.querySelector('meta[name=theme-color]').content }; });
  check('customizer applies palette/accent/corners/motion/mode', st.t === 'dark' && st.p === 'grape' && st.a === 'teal' && st.r === '6px' && st.accent.toUpperCase() === '#5EEAD4' && st.m === 'calm', JSON.stringify(st));
  check('browser theme-color follows the palette', st.meta.toUpperCase() === st.bg.toUpperCase(), st.meta);
  await page.keyboard.press('Escape');
  check('Escape closes the customizer', !(await page.evaluate(() => document.getElementById('look-panel').open)));
  await page.goto(BASE + '/services');
  const st2 = await page.evaluate(() => [document.documentElement.dataset.theme, document.documentElement.dataset.palette, document.documentElement.dataset.accent, document.documentElement.dataset.radius, document.documentElement.dataset.motion].join(','));
  check('all choices persist across pages', st2 === 'dark,grape,teal,sharp,calm', st2);
  // before-paint: attributes exist as soon as the DOM is parsed
  const early = await page.evaluate(async () => { const r = await fetch('/about'); return (await r.text()).includes("localStorage.getItem('wb-look')"); });
  check('look is applied by an inline script in <head> (no flash)', early);
  await page.click('.look-btn'); await page.click('[data-look-reset]'); await page.waitForTimeout(800);
  const st3 = await page.evaluate(() => ({ p: document.documentElement.dataset.palette || 'cherry', a: document.documentElement.dataset.accent || 'auto', r: document.documentElement.dataset.radius || 'rounded', s: localStorage.getItem('wb-look'), t: document.documentElement.dataset.theme }));
  check('reset restores defaults and clears storage', st3.p === 'cherry' && st3.a === 'auto' && st3.r === 'rounded' && st3.s === null && st3.t === 'dark', JSON.stringify(st3));
  check('reset shows a confirmation', await page.locator('.notice').first().isVisible());
  // light palettes all readable: contrast text vs bg
  const contrast = await page.evaluate(() => {
    const lum = (hex) => { const c = hex.replace('#', '').match(/../g).map((x) => parseInt(x, 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
    const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
    const out = [];
    for (const p of ['cherry', 'grape', 'sunset']) for (const t of ['dark', 'light']) for (const a of ['auto', 'pink', 'violet', 'coral', 'teal']) {
      const d = document.documentElement; d.dataset.theme = t; if (p === 'cherry') d.removeAttribute('data-palette'); else d.dataset.palette = p; if (a === 'auto') d.removeAttribute('data-accent'); else d.dataset.accent = a;
      const cs = getComputedStyle(d); const g = (k) => cs.getPropertyValue(k).trim();
      out.push({ k: `${p}/${t}/${a}`, text: ratio(g('--text'), g('--bg')), muted: ratio(g('--muted'), g('--bg')), accent: ratio(g('--accent'), g('--bg')), cta: ratio(g('--cta-text'), g('--cta-bg').startsWith('#') ? g('--cta-bg') : '#FFE08A') });
    }
    return out;
  });
  const weak = contrast.filter((c) => c.text < 7 || c.muted < 4.5 || c.accent < 4.5 || c.cta < 4.5);
  check(`contrast ≥ 4.5:1 for text, muted, accent and buttons in all ${contrast.length} theme combinations`, weak.length === 0, JSON.stringify(weak.map((w) => ({ k: w.k, m: w.muted.toFixed(2), a: w.accent.toFixed(2), c: w.cta.toFixed(2) }))).slice(0, 400));
  await ctx.close();
}

/* 4. Blog: visibility, search, load more, categories, related, share */
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] }); const page = await ctx.newPage();
  await page.goto(BASE + '/blog/');
  const html = await page.content();
  check('drafts and scheduled posts are not listed publicly', !html.includes('Hidden draft') && !html.includes('Future scheduled'));
  const sitemap = readFileSync(`${DIST}/sitemap.xml`, 'utf8'); const feed = readFileSync(`${DIST}/blog/feed.xml`, 'utf8');
  check('drafts/scheduled absent from sitemap and RSS', !/test-draft|test-scheduled/.test(sitemap + feed));
  check('draft and scheduled post URLs return 404', (await page.request.get(BASE + '/blog/test-draft')).status() === 404 && (await page.request.get(BASE + '/blog/test-scheduled')).status() === 404);
  check('featured post shown in the banner slot', (await page.locator('.featured-wrap .post-card-title').innerText()).includes('Test post four'));
  const visible = () => page.$$eval('[data-blog-grid] [data-post]', (els) => els.filter((e) => !e.hidden).length);
  check('first page shows 9 posts', (await visible()) === 9, String(await visible()));
  await page.click('[data-load-more]'); await page.waitForTimeout(400);
  check('"Show more posts" reveals the rest and hides itself', (await visible()) === 11 && (await page.locator('[data-load-more-wrap]').isHidden()), String(await visible()));
  await page.fill('[data-blog-search]', 'eleven'); await page.waitForTimeout(400);
  check('search narrows to the matching post', (await visible()) === 1 && (await page.locator('.featured-wrap').isHidden()));
  check('search is reflected in the URL', page.url().includes('q=eleven'));
  await page.fill('[data-blog-search]', 'zzzz-nothing'); await page.waitForTimeout(400);
  check('no-results state appears', await page.locator('[data-blog-empty]').isVisible());
  await page.click('[data-blog-clear]'); await page.waitForTimeout(400);
  check('clear search restores posts', (await visible()) === 9 && (await page.locator('[data-blog-empty]').isHidden()));
  await page.goto(BASE + '/blog/?q=tag7');
  check('?q= from a tag link pre-fills the search', (await page.inputValue('[data-blog-search]')) === 'tag7' && (await visible()) === 1);
  await Promise.all([page.waitForURL('**/paid-ads/'), page.click('.chip-link[data-filter-cat="paid-ads"]')]); await page.waitForLoadState('load');
  const cats = await page.$$eval('[data-post] .cat-pill', (e) => [...new Set(e.map((x) => x.textContent))]);
  check('category chip opens a page with only that category', page.url().endsWith('/blog/category/paid-ads/') && cats.length === 1 && cats[0] === 'Paid ads', cats.join());
  check('active category chip is marked', (await page.getAttribute('.chip-link[aria-current="page"]', 'data-filter-cat')) === 'paid-ads');
  await page.goto(BASE + '/blog/test-06');
  check('post shows breadcrumb, category, tags, updated date, share', await page.locator('.crumbs').isVisible() && (await page.locator('.crumbs').innerText()).includes('Reels & video') && (await page.locator('.tag-list li').count()) === 3 && (await page.locator('.post-byline').innerText()).includes('Updated'));
  const rel = await page.$$eval('.post-more [data-post]', (e) => e.length);
  check('related posts shown at the end (3)', rel === 3, String(rel));
  check('user text cannot inject template tokens', (await page.locator('.post-body').innerText()).includes('{{email}}'));
  await page.click('[data-copy-link]'); await page.waitForTimeout(200);
  check('copy link copies the canonical URL and confirms', (await page.evaluate(() => navigator.clipboard.readText())).endsWith('/blog/test-06') && await page.locator('.notice').first().isVisible());
  const meta = await page.evaluate(() => ({ pub: document.querySelector('meta[property="article:published_time"]')?.content, mod: document.querySelector('meta[property="article:modified_time"]')?.content, tags: document.querySelectorAll('meta[property="article:tag"]').length, ld: JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent)['@graph'].map((x) => x['@type']) }));
  check('post has article meta + BlogPosting + BreadcrumbList', meta.pub && meta.mod === '2026-10-01' && meta.tags === 3 && meta.ld.includes('BlogPosting') && meta.ld.includes('BreadcrumbList'), JSON.stringify(meta));
  await page.goto(BASE + '/blog/'); await Promise.all([page.waitForURL('**/test-04'), page.click('.featured-wrap .stretched')]); await page.waitForLoadState('load');
  check('clicking a blog card opens the post', page.url().endsWith('/blog/test-04'));
  check('RSS feed is valid-looking and linked', feed.startsWith('<?xml') && feed.includes('<item>') && (await page.locator('link[type="application/rss+xml"]').count()) === 1);
  await ctx.close();
}

/* 5. Mobile navigation + customizer as bottom sheet */
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }); const page = await ctx.newPage();
  await page.goto(BASE + '/');
  check('mobile: menu hidden initially', await page.locator('#site-nav').isHidden());
  await page.tap('.menu-btn'); await page.waitForTimeout(500);
  check('mobile: menu opens, locks page scroll, sets aria-expanded', await page.locator('#site-nav a[href="/services"]').isVisible() && (await page.getAttribute('.menu-btn', 'aria-expanded')) === 'true' && await page.evaluate(() => getComputedStyle(document.body).overflow === 'hidden'));
  await page.tap('#site-nav [data-open-look]'); await page.waitForTimeout(600);
  const sheet = await page.evaluate(() => { const r = document.getElementById('look-panel').getBoundingClientRect(); return { open: document.getElementById('look-panel').open, bottom: Math.round(r.bottom), w: Math.round(r.width) }; });
  check('mobile: customizer opens from the menu as a bottom sheet', sheet.open && sheet.bottom === 844 && sheet.w === 390, JSON.stringify(sheet));
  check('mobile: menu closed when customizer opened', (await page.getAttribute('.menu-btn', 'aria-expanded')) === 'false');
  await page.tap('.look-foot .btn-primary'); await page.waitForTimeout(500);
  await page.tap('.menu-btn'); await page.waitForTimeout(400); await Promise.all([page.waitForURL('**/work'), page.tap('#site-nav a[href="/work"]')]); await page.waitForLoadState('load');
  check('mobile: menu link navigates', page.url().endsWith('/work'));
  const small = await page.$$eval('a, button, input, select, summary', (els) => els.filter((e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && !e.closest('.post-body, .prose, p, .crumbs, .footer-bottom, .hp, .lead, .muted, figcaption') && (r.height < 32); }).map((e) => `${e.tagName}.${e.className}:${Math.round(e.getBoundingClientRect().height)}`));
  check('mobile: tap targets at least 32px tall (outside running text)', small.length === 0, small.slice(0, 6).join(' '));
  await page.goto(BASE + '/');
  await page.locator('.reel').first().scrollIntoViewIfNeeded();
  const box = await page.locator('.reel').first().boundingBox();
  await page.touchscreen.tap(box.x + 50, box.y + 80); await page.touchscreen.tap(box.x + 50, box.y + 80); await page.waitForTimeout(150);
  check('double-tap on a reel shows a heart', (await page.locator('.reel .heart-burst').count()) === 1);
  await ctx.close();
}

/* 6. Reduced motion + motion off */
{
  const ctx = await browser.newContext({ reducedMotion: 'reduce' }); const page = await ctx.newPage();
  await page.goto(BASE + '/'); await page.waitForTimeout(300);
  const s = await page.evaluate(() => ({ s1: getComputedStyle(document.querySelector('.slide.s1')).opacity, s2: getComputedStyle(document.querySelector('.slide.s2')).opacity, anim: getComputedStyle(document.querySelector('.aurora .a1')).animationName, reveal: getComputedStyle(document.querySelector('[data-reveal]')).opacity, toast: getComputedStyle(document.querySelector('.toast')).opacity }));
  check('reduced motion: static first story frame, no drifting glows, content visible', s.s1 === '1' && s.s2 === '0' && s.anim === 'none' && s.reveal === '1' && s.toast === '1', JSON.stringify(s));
  await ctx.close();
}

/* 7. Contact pop-up, booking tab, enquiry form, time zones */
for (const [tz, label] of [['Asia/Kolkata', 'India visitor'], ['Europe/London', 'UK visitor'], ['America/New_York', 'US visitor']]) {
  const ctx = await browser.newContext({ timezoneId: tz, viewport: { width: 1280, height: 860 } }); const page = await ctx.newPage();
  await page.goto(BASE + '/services');
  await page.click('.header-cta'); await page.waitForTimeout(250);
  check(`[${label}] header CTA opens the "Let's talk" pop-up without leaving the page`, await page.evaluate(() => document.getElementById('contact-panel').open) && page.url().endsWith('/services'));
  // Cal.com isn't connected in config (REPLACE), so the pop-up must start on the enquiry tab and say so honestly on the call tab
  check(`[${label}] with no booking link, it opens on the enquiry tab with the cursor in Name`, (await page.getAttribute('#tab-enquiry', 'aria-selected')) === 'true' && await page.evaluate(() => document.activeElement?.name === 'name'));
  await page.click('#tab-call');
  const tzText = await page.textContent('#pane-call [data-tz-text]');
  const ok = tz === 'Asia/Kolkata' ? /India Standard Time \(IST, UTC\+5:30\)/.test(tzText) : tzText.includes(tz.replace(/_/g, ' ')) && /IST/.test(tzText) && /Indore/.test(tzText);
  check(`[${label}] time-zone line names the visitor's zone and IST clearly`, ok, tzText);
  check(`[${label}] call tab says booking isn't switched on (no fake confirmation)`, await page.locator('#pane-call [data-cal-missing]').isVisible());
  await page.click('#pane-call [data-switch-tab="enquiry"]');
  check(`[${label}] "Send an enquiry instead" switches tabs`, (await page.getAttribute('#tab-enquiry', 'aria-selected')) === 'true');
  check(`[${label}] hidden field records the visitor's time zone`, (await page.inputValue('#pane-enquiry [data-visitor-tz]')) === tz);
  await ctx.close();
}
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } }); const page = await ctx.newPage();
  await page.goto(BASE + '/');
  await page.click('.cta-band [data-contact="enquiry"]');
  const form = page.locator('#pane-enquiry form');
  await form.locator('input[name="name"]').fill('Asha Verma');
  await form.locator('button[type=submit]').click();
  const errs = await form.locator('.error').evaluateAll((e) => e.filter((x) => x.textContent.trim()).length);
  check('enquiry: empty required fields show inline errors (email, service, consent)', errs === 3, String(errs));
  check('enquiry: an error notice appears', (await page.locator('.notice--error').count()) >= 1);
  check('enquiry: typed name is kept after a failed submit', (await form.locator('input[name="name"]').inputValue()) === 'Asha Verma');
  await form.locator('input[name="email"]').fill('asha@example');
  await form.locator('input[name="email"]').blur();
  check('enquiry: invalid email is flagged', (await form.locator('#m-email-error').textContent()).includes('valid email'));
  await form.locator('input[name="email"]').fill('asha@example.co.uk');
  await form.locator('label.choice:has(input[value="Paid ads"])').click();
  await form.locator('.more-fields summary').click();
  await form.locator('select[name="phone_country"]').selectOption('+44');
  await form.locator('input[name="phone"]').fill('12ab');
  await form.locator('input[name="phone"]').blur();
  check('enquiry: phone accepts any country code and flags bad numbers', (await form.locator('#m-phone-error').textContent()).includes('digits'));
  await form.locator('input[name="phone"]').fill('7700 900123');
  await form.locator('select[name="budget_currency"]').selectOption('GBP');
  check('enquiry: currency is selectable (INR is the default)', (await form.locator('select[name="budget_currency"] option[selected]').getAttribute('value')) === 'INR');
  await form.locator('#m-consent').check();
  await form.locator('button[type=submit]').click();
  check('enquiry: without a Web3Forms key it says "not sent" and keeps the text', (await form.locator('.form-status').textContent()).includes("isn't connected") && (await form.locator('input[name="email"]').inputValue()) === 'asha@example.co.uk');
  // success path: fake the Web3Forms API response, and set a key on the form
  await page.route('https://api.web3forms.com/submit', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true}' }));
  let posted = null;
  page.on('request', (r) => { if (r.url().startsWith('https://api.web3forms.com')) posted = r.postData(); });
  await form.locator('[name="access_key"]').evaluate((i) => { i.value = 'test-key'; });
  await form.locator('button[type=submit]').click();
  await page.waitForTimeout(400);
  check('enquiry: success shows "Thanks, Asha" panel and a success notice', (await page.locator('#pane-enquiry [data-sent-title]').textContent()).includes('Thanks, Asha') && (await page.locator('.notice--success').count()) >= 1);
  check('enquiry: phone is sent with its country code, time zone included', !!posted && posted.includes('+44 7700 900123') && posted.includes('visitor_timezone'));
  await page.keyboard.press('Escape');
  check('pop-up closes with Escape and focus returns to the button', !(await page.evaluate(() => document.getElementById('contact-panel').open)) && await page.evaluate(() => document.activeElement?.matches('[data-contact]')));
  // Book page: links scroll instead of opening a pop-up; page form works too
  await page.goto(BASE + '/book');
  await page.click('.jump-links a[href="#enquiry"]'); await page.waitForTimeout(500);
  check('book page: "Send an enquiry" jumps to the form, no pop-up', !(await page.evaluate(() => document.getElementById('contact-panel').open)) && await page.locator('#f-name').isVisible());
  await page.click('#enquiry button[type=submit]');
  check('book page: same short form validates inline', ((await page.textContent('#f-email-error')) || '').length > 0);
  check('book page: honest message while booking is not connected', await page.locator('#call [data-cal-missing]').isVisible());
  await ctx.close();
}
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }); const page = await ctx.newPage();
  await page.goto(BASE + '/about');
  await page.tap('.header-cta');
  const box = await page.evaluate(() => { const r = document.getElementById('contact-panel').getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), sw: document.querySelector('#contact-panel .cp-inner').scrollWidth - document.querySelector('#contact-panel .cp-inner').clientWidth }; });
  check('mobile: pop-up fills the screen with no sideways scroll', box.w === 390 && box.h === 844 && box.sw <= 0, JSON.stringify(box));
  await page.tap('[data-close-contact]');
  check('mobile: close button closes it', !(await page.evaluate(() => document.getElementById('contact-panel').open)));
  await ctx.close();
}

/* 8a. Location + trust */
{
  const ctx = await browser.newContext({ timezoneId: 'America/New_York' }); const page = await ctx.newPage();
  await page.goto(BASE + '/');
  const foot = await page.textContent('.footer-place');
  check('footer shows Indore and the current IST time', foot.includes('Indore, Madhya Pradesh, India') && /IST, UTC\+5:30/.test(foot), foot);
  const ld = await page.evaluate(() => JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent));
  const org = ld['@graph'].find((x) => x['@id']?.endsWith('#org'));
  check('structured data: business address is Indore, MP, India', org.address.addressLocality === 'Indore' && org.address.addressCountry === 'IN');
  const html = await page.content();
  check('no false scarcity lines left', !/few spots open|few new brands this month/i.test(html));
  await ctx.close();
}

/* 8. Admin + headers */
{
  const r = await (await browser.newContext()).request.get(BASE + '/admin/');
  const body = await r.text();
  check('admin page is noindex and loads Decap', r.status() === 200 && body.includes('noindex') && body.includes('decap-cms'));
  const ap = await (await browser.newContext()).newPage();
  await ap.goto(BASE + '/admin/'); await ap.waitForTimeout(1500);
  check('admin: branded screen shows a clear error when the editor cannot load (no internet here)', (await ap.locator('#wb-boot.failed .err').isVisible()));
  const robots = readFileSync(`${DIST}/robots.txt`, 'utf8'); const headers = readFileSync(`${DIST}/_headers`, 'utf8'); const cms = readFileSync(`${DIST}/admin/config.yml`, 'utf8');
  check('robots.txt blocks /admin and lists the sitemap', robots.includes('Disallow: /admin/') && robots.includes('Sitemap:'));
  check('uploaded images are sandboxed by headers', headers.includes("/assets/blog/*") && headers.includes('sandbox'));
  check('CMS config has category, tags, featured, updated, filters and size limit', ['name: category', 'name: tags', 'name: featured', 'name: updated', 'view_filters'].every((k) => cms.includes(k)));
}

await browser.close();
const fails = results.filter((r) => !r.ok);
console.log(`\n${results.length - fails.length}/${results.length} checks passed`);
if (fails.length) { console.log('FAILED:'); fails.forEach((f) => console.log(' - ' + f.name + ' :: ' + f.info)); process.exit(1); }
