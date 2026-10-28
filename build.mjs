// Brightloop — zero-dependency build. Run: node build.mjs
// Stitches src/pages/* with the shared head/header/footer, inlines CSS,
// fingerprints the JS, writes dist/. Cloudflare Pages: build `node build.mjs`, output `dist`.
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, copyFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { markdownToHtml, imageSize, parsePost, escapeHtml } from './lib/markdown.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SRC = join(ROOT, 'src');
const DIST = join(ROOT, 'dist');
const read = (p) => readFileSync(join(SRC, p), 'utf8');
const cfg = JSON.parse(read('config.json'));
const hash = (s) => createHash('sha256').update(s).digest('hex').slice(0, 10);

/* ---------- icons (Lucide-style, stroke) ---------- */
const svg = (d, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${extra}>${d}</svg>`;
const ICONS = {
  arrow: svg('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  menu: svg('<path d="M4 7h16M4 12h16M4 17h16"/>', ' width="22" height="22"'),
  instagram: svg('<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".6" fill="currentColor"/>'),
  mail: svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>'),
  shield: svg('<path d="M12 3 4 6v6c0 4.5 3.4 8.2 8 9 4.6-.8 8-4.5 8-9V6l-8-3Z"/>'),
  check: svg('<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>'),
  back: svg('<path d="M19 12H5M11 18l-6-6 6-6"/>'),
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 7 4.5Z" fill="currentColor"/></svg>',
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  clock: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  globe: svg('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>'),
  spark: svg('<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>'),
  calendar: svg('<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/>'),
  phone: svg('<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M11 18h2"/>'),
  pen: svg('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>'),
  target: svg('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>'),
  search: svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
  heart: svg('<path d="M19.5 12.6 12 20l-7.5-7.4A5 5 0 1 1 12 6a5 5 0 1 1 7.5 6.6Z"/>'),
  eye: svg('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>'),
  users: svg('<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0M16 4a4 4 0 0 1 0 8M22 21a7 7 0 0 0-4-6.3"/>'),
  chart: svg('<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-6"/>'),
  message: svg('<path d="M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-6.4A8 8 0 1 1 21 12Z"/>'),
  whatsapp: svg('<path d="M3 21l1.7-5A8.5 8.5 0 1 1 8 19.3Z"/><path d="M9 9.5c.3 2.2 2.3 4.2 4.5 4.5l1.2-1.2 1.8.8-.4 1.6c-3.6.4-7.7-3.7-7.3-7.3l1.6-.4.8 1.8Z"/>'),
  sliders: svg('<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>'),
  close: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
  monitor: svg('<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>'),
  sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.4 1.4M17.6 17.6 19 19M5 19l1.4-1.4M17.6 6.4 19 5"/>'),
  moon: svg('<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"/>'),
  reset: svg('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>'),
  link: svg('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'),
  linkedin: svg('<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 10v7M8 7v.01M12 17v-4a2 2 0 0 1 4 0v4M12 10v7"/>'),
  xsocial: svg('<path d="M4 4l16 16M20 4 4 20" stroke-width="1.8"/>'),
  rss: svg('<path d="M5 11a8 8 0 0 1 8 8M5 5a14 14 0 0 1 14 14"/><circle cx="6" cy="18" r="1.4" fill="currentColor"/>'),
  send: svg('<path d="M21 3 10 14M21 3l-7 18-4-7-7-4 18-7Z"/>'),
  bookmark: svg('<path d="M6 3h12v18l-6-4-6 4Z"/>'),
  pin: svg('<path d="M12 21s-7-6.1-7-11.5a7 7 0 0 1 14 0C19 14.9 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/>'),
  external: svg('<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'),
};
const THEME_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><mask id="MASKID"><rect x="-4" y="-4" width="32" height="32" fill="#fff"/><circle class="moon-mask-circle" cx="24" cy="2" r="7" fill="#000"/></mask><circle class="core" cx="12" cy="12" r="5" fill="currentColor" mask="url(#MASKID)"/><g class="sun-rays" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 1.5v2M12 20.5v2M1.5 12h2M20.5 12h2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M4.6 19.4 6 18M18 6l1.4-1.4"/></g></svg>`;
/* Demo logo mark — a gradient loop with a play button (reels on repeat). Swap for the client's logo. */
const LOGO = `<svg class="logo-mark" viewBox="0 0 40 40" aria-hidden="true"><defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#E1306C"/><stop offset="1" stop-color="#FFE08A"/></linearGradient></defs><circle cx="20" cy="20" r="14" fill="none" stroke="url(#lg)" stroke-width="4.5"/><path d="M16.5 13.8v12.4a1 1 0 0 0 1.5.86l9.6-6.2a1 1 0 0 0 0-1.72L18 12.94a1 1 0 0 0-1.5.86Z" fill="url(#lg)"/></svg>`;

/* ---------- look settings (config.json → "look") ---------- */
const PRESETS = {
  calm:     { glow: 0.45, grain: 0.03, grid: 0.25, spotlight: 0.3,  shimmer: 0, motion: 'calm',   buttons: 'soft' },
  balanced: { glow: 0.7,  grain: 0.04, grid: 0.4,  spotlight: 0.45, shimmer: 1, motion: 'normal', buttons: 'bright' },
  vivid:    { glow: 1,    grain: 0.05, grid: 0.5,  spotlight: 0.55, shimmer: 1, motion: 'normal', buttons: 'bright' },
};
const lookCfg = cfg.look || {};
if (lookCfg.preset && !PRESETS[lookCfg.preset]) throw new Error(`look.preset must be one of: ${Object.keys(PRESETS).join(', ')}`);
const look = { ...PRESETS[lookCfg.preset || 'calm'], ...Object.fromEntries(Object.entries(lookCfg).filter(([k]) => !['preset', '_help', 'defaultTheme'].includes(k))) };
const clamp01 = (n, k) => { const v = Number(n); if (Number.isNaN(v) || v < 0 || v > 1) throw new Error(`look.${k} must be a number from 0 to 1`); return v; };
const motionScale = { calm: 1.6, normal: 1, off: 1 }[look.motion];
if (!motionScale) throw new Error('look.motion must be calm, normal or off');
if (!['soft', 'bright'].includes(look.buttons)) throw new Error('look.buttons must be soft or bright');
const defaultTheme = lookCfg.defaultTheme || 'system';
if (!['system', 'dark', 'light'].includes(defaultTheme)) throw new Error('look.defaultTheme must be system, dark or light');
const lookCss = `:root{--glow-strength:${clamp01(look.glow, 'glow')};--grain:${clamp01(look.grain, 'grain')};--grid:${clamp01(look.grid, 'grid')};--spot:${clamp01(look.spotlight, 'spotlight')};--shimmer:${clamp01(look.shimmer, 'shimmer')};--motion-scale:${motionScale}}`;
const htmlAttrs = `${look.motion === 'off' ? ' data-motion="off"' : ''}${look.buttons === 'soft' ? ' data-buttons="soft"' : ''} data-default-mode="${defaultTheme}" data-default-motion="${look.motion === 'off' ? 'off' : 'full'}"`;
const fallbackTheme = defaultTheme === 'light' ? 'light' : 'dark';

/* ---------- look script (runs before paint, so there is no flash) ----------
   Reads the visitor's saved choices from the customizer: mode, palette, accent, corners, motion. */
const themeScript = `(function(){var d=document.documentElement,p={},m,o,k,v,ok=/^[a-z]{2,10}$/;d.className+=' js';try{p=JSON.parse(localStorage.getItem('wb-look'))||{};o=localStorage.getItem('theme');if(!p.mode&&(o==='light'||o==='dark'))p.mode=o}catch(e){p={}}m=p.mode||'${defaultTheme}';if(m!=='light'&&m!=='dark'){m=window.matchMedia&&matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'}d.setAttribute('data-theme',m);for(k in {palette:1,accent:1,radius:1,motion:1}){v=p[k];if(v&&ok.test(v)&&v!=='cherry'&&v!=='auto'&&v!=='rounded')d.setAttribute('data-'+k,v)}})();`;

/* ---------- CSS: strip comments + whitespace, inline ---------- */
// Only spaces around { } ; , > are removed, so descendant selectors and calc() spacing survive.
const minCss = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').replace(/\s*([{};,>])\s*/g, '$1').replace(/;}/g, '}').trim();
const css = minCss(read('assets/css/site.css'));

/* ---------- JS: fingerprint ---------- */
const js = read('assets/js/main.js');
const jsFile = `main.${hash(js)}.js`;

/* ---------- reels ---------- */
const reelCard = (r, i, eager = false) => {
  const label = r.label || `Reel ${String(i + 1).padStart(2, '0')}`;
  if (r.src) {
    return `<figure class="reel" style="margin:0" data-double-tap><div class="reel-notch"></div><video data-reel muted playsinline loop preload="${r.poster ? 'none' : 'metadata'}"${r.poster ? ` poster="${r.poster}"` : ''} width="360" height="640" aria-label="${label}"><source src="${r.src}" type="video/mp4"></video></figure>`;
  }
  return `<figure class="reel" style="margin:0" data-placeholder="reel" data-double-tap><div class="reel-notch"></div><div class="reel-ph"><span class="play">${ICONS.play}</span></div><figcaption class="reel-meta"><span>${label}</span><span class="ph-tag">Placeholder</span></figcaption></figure>`;
};
const reelsHtml = cfg.reels.map((r, i) => reelCard(r, i)).join('\n');

/* ---------- JSON-LD ---------- */
const ld = (o) => JSON.stringify(o).replace(/</g, '\\u003c');
const loc = cfg.location || {};
const orgLd = { '@type': ['Organization', 'ProfessionalService'], '@id': `${cfg.siteUrl}/#org`, name: cfg.siteName, url: cfg.siteUrl, logo: `${cfg.siteUrl}/apple-touch-icon.png`, image: `${cfg.siteUrl}/og-image.png`, email: cfg.email, sameAs: [cfg.instagramUrl],
  address: { '@type': 'PostalAddress', addressLocality: loc.city || 'Indore', addressRegion: loc.region || 'Madhya Pradesh', addressCountry: loc.country || 'IN', ...(loc.streetAddress ? { streetAddress: loc.streetAddress } : {}), ...(loc.postalCode ? { postalCode: loc.postalCode } : {}) },
  areaServed: [{ '@type': 'Country', name: 'India' }, { '@type': 'Place', name: 'Worldwide' }], ...(cfg.phone ? { telephone: cfg.phone } : {}) };
const jsonld = ld({ '@context': 'https://schema.org', '@graph': [orgLd, { '@type': 'WebSite', '@id': `${cfg.siteUrl}/#site`, url: cfg.siteUrl, name: cfg.siteName, publisher: { '@id': `${cfg.siteUrl}/#org` }, inLanguage: 'en-IN' }] });
const crumbsLd = (items) => ({ '@type': 'BreadcrumbList', itemListElement: items.map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: cfg.siteUrl + path })) });

/* ---------- template ---------- */
const partial = (n) => read(`partials/${n}.html`);
const render = (tpl, vars) => tpl
  .replace(/\{\{icon:([a-z0-9]+)\}\}/g, (_, k) => { if (!ICONS[k]) throw new Error(`Unknown icon ${k}`); return ICONS[k]; })
  .replace(/\{\{cur:([a-z]+)\}\}/g, (_, k) => (vars.nav === k ? ' aria-current="page"' : ''))
  .replace(/\{\{([a-zA-Z0-9]+)\}\}/g, (m, k) => (k in vars ? vars[k] : m));
/** Escapes text written by people (blog posts) so it can never be read as HTML or as a {{template}} token. */
const esc = (v) => escapeHtml(v).replace(/\{/g, '&#123;').replace(/\}/g, '&#125;');

rmSync(DIST, { recursive: true, force: true });
mkdirSync(join(DIST, 'assets/js'), { recursive: true });
mkdirSync(join(DIST, 'assets/fonts'), { recursive: true });

const today = new Date().toISOString().slice(0, 10);
const sitemap = [];
let placeholderCount = 0;
let leftover = [];
const baseVars = {
  ...cfg, css, jsFile, themeScript, jsonld, logo: LOGO, lookCss, htmlAttrs, fallbackTheme,
  themeIconA: THEME_ICON.replace(/MASKID/g, 'moon-a'), themeIconB: THEME_ICON.replace(/MASKID/g, 'moon-b'),
  reels: reelsHtml, ctaBand: partial('cta'),
  tzBox: partial('tz-box'),
  calSkeleton: '<i></i>'.repeat(28),
  enquiryFormModal: partial('enquiry-form').replace(/__P/g, 'm'),
  enquiryFormPage: partial('enquiry-form').replace(/__P/g, 'f'),
  contactDialog: partial('contact'),
  faqPlus: `<span class="plus" aria-hidden="true">${ICONS.plus}</span>`,
  locationCity: (cfg.location || {}).city || 'Indore', locationRegion: (cfg.location || {}).region || 'Madhya Pradesh', locationCountryName: (cfg.location || {}).countryName || 'India',
  ogType: 'website', ogImage: '/og-image.png', ogImageAlt: `${cfg.siteName}: social media, content and ads`, headExtra: '',
};
const outFile = (path) => (path === '/' ? 'index.html' : path.endsWith('/') ? `${path.slice(1)}index.html` : `${path.slice(1)}.html`);
/** Wraps a page body in the shared head/header/footer and writes it to dist/. `late` is inserted after templating. */
const writePage = (name, meta, body, extra = {}, late = {}) => {
  const vars = { ...baseVars, ...meta, ...extra, robots: meta.noindex ? 'noindex' : 'index,follow,max-image-preview:large', description: esc(meta.description), title: esc(meta.title) };
  let html = render(partial('head') + partial('header') + body + partial('footer'), vars);
  for (let i = 0; i < 3 && /\{\{[a-zA-Z0-9:]+\}\}/.test(html); i++) html = render(html, vars); // partials can contain partials
  const left = html.match(/\{\{[^}]+\}\}/g)?.filter((t) => !(t in late));
  if (left?.length) leftover.push(`${name}: ${[...new Set(left)].join(', ')}`);
  for (const [k, v] of Object.entries(late)) html = html.replace(k, () => v);
  let lgN = 0; // the logo appears several times per page: give each copy its own gradient id
  html = html.replace(/<svg class="logo-mark"[\s\S]*?<\/svg>/g, (m) => { lgN += 1; return m.replace(/id="lg"/, `id="lg${lgN}"`).replace(/url\(#lg\)/g, `url(#lg${lgN})`); });
  placeholderCount += (html.match(/data-placeholder/g) || []).length;
  const out = outFile(meta.path);
  mkdirSync(dirname(join(DIST, out)), { recursive: true });
  writeFileSync(join(DIST, out), html);
  if (!meta.noindex) sitemap.push({ path: meta.path, lastmod: meta.lastmod || today });
};

/* ---------- blog ----------
   Posts are Markdown files with JSON front matter, written in /admin (Decap CMS) or by hand.
   Status: "draft" (never public) · "scheduled" (date in the future, goes live on the first build on/after that
   day, India time) · "published". `npm run dev` shows all three with a label; the real build only publishes. */
const SHOW_DRAFTS = process.env.SHOW_DRAFTS === '1';
const POSTS_DIR = process.env.BLOG_DIR ? resolve(ROOT, process.env.BLOG_DIR) : join(SRC, 'content/blog');
const blogCfg = cfg.blog || {};
const PER_PAGE = Number(blogCfg.postsPerPage) || 9;
const slugify = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
const fmtDate = (d) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const fmtShort = (d) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const todayIST = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
const IMG_OK = /\.(jpe?g|png|webp|avif|gif)$/i;
const IMG_WARN_KB = 500;
const warnings = [];
const imgTag = (src, alt, cls = '', eager = false, where = '') => {
  let dims = '';
  if (src.startsWith('/')) {
    if (!IMG_OK.test(src)) throw new Error(`${where}: image ${src} must be JPG, PNG, WebP, AVIF or GIF (SVG is not allowed for uploads)`);
    const local = join(SRC, 'static', src);
    if (!existsSync(local)) throw new Error(`${where}: image not found: ${src} (expected at src/static${src})`);
    const buf = readFileSync(local);
    if (buf.length > IMG_WARN_KB * 1024) warnings.push(`${where}: ${src} is ${Math.round(buf.length / 1024)} KB. Shrink it below ${IMG_WARN_KB} KB at squoosh.app so the page loads fast on phones.`);
    const size = imageSize(buf);
    if (size) dims = ` width="${size.w}" height="${size.h}"`;
  } else if (!/^https:\/\//i.test(src)) throw new Error(`${where}: image ${src} must be an uploaded image or an https:// address`);
  return `<img${cls ? ` class="${cls}"` : ''} src="${esc(src)}" alt="${esc(alt || '')}"${dims} ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`;
};
const categoryList = (blogCfg.categories || []).map((name) => ({ name: String(name), slug: slugify(name) }));
const catBySlug = new Map(categoryList.map((c) => [c.slug, c]));
const asList = (v) => (Array.isArray(v) ? v : typeof v === 'string' ? v.split(',') : []).map((t) => String(t).trim()).filter(Boolean);

const badPosts = [];
const allPosts = (existsSync(POSTS_DIR) ? readdirSync(POSTS_DIR) : [])
  .filter((f) => f.endsWith('.md'))
  .map((f) => { try { return readPost(f); } catch (e) {
    // In the local preview a broken post is skipped (and reported) so the rest of the site keeps working.
    // The real build stops, so a broken post can never go live half-finished.
    if (!SHOW_DRAFTS) throw e;
    badPosts.push(`${f}: ${e.message}`); return null;
  } })
  .filter(Boolean)
  .sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));
function readPost(f) {
    let parsed;
    try { parsed = parsePost(readFileSync(join(POSTS_DIR, f), 'utf8')); } catch (e) { throw new Error(`Blog post ${f}: the settings block at the top could not be read (${e.message})`); }
    const { data, body } = parsed;
    const need = ['title', 'date', 'description'].filter((k) => !data[k]);
    if (need.length) throw new Error(`Blog post ${f} is missing: ${need.join(', ')}`);
    const date = String(data.date).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`Blog post ${f}: date must look like 2026-10-16`);
    const updated = data.updated ? String(data.updated).slice(0, 10) : '';
    if (updated && !/^\d{4}-\d{2}-\d{2}$/.test(updated)) throw new Error(`Blog post ${f}: updated must look like 2026-10-16`);
    const slug = slugify(data.slug || f.replace(/\.md$/, ''));
    if (!slug) throw new Error(`Blog post ${f}: could not make a web address from its name`);
    const words = body.split(/\s+/).filter(Boolean).length;
    const catName = String(data.category || '').trim();
    const category = catName ? (catBySlug.get(slugify(catName)) || { name: catName, slug: slugify(catName) }) : null;
    const draft = data.draft === true || data.draft === 'true';
    const status = draft ? 'draft' : date > todayIST ? 'scheduled' : 'published';
    return { file: f, slug, date, updated: updated && updated > date ? updated : '', status, featured: data.featured === true || data.featured === 'true',
      title: String(data.title), description: String(data.description), author: String(data.author || cfg.siteName),
      cover: String(data.cover || ''), coverAlt: String(data.coverAlt || ''), category, tags: [...new Set(asList(data.tags).map((t) => t.slice(0, 40)))].slice(0, 8),
      body, words, readMins: Math.max(1, Math.round(words / 220)) };
}
const posts = allPosts.filter((p) => SHOW_DRAFTS || p.status === 'published');
const seen = new Set();
for (const p of posts) { if (seen.has(p.slug)) throw new Error(`Two blog posts share the address /blog/${p.slug}`); seen.add(p.slug); }
const hiddenCount = allPosts.length - posts.length;

const statusTag = (p) => (p.status === 'draft' ? '<span class="ph-tag">Draft · not public</span>' : p.status === 'scheduled' ? `<span class="ph-tag">Scheduled · goes live ${fmtShort(p.date)}</span>` : '');
const vtName = (p) => `post-${p.slug}`.slice(0, 90);
const searchText = (p) => esc([p.title, p.description, p.category?.name, ...p.tags].filter(Boolean).join(' ').toLowerCase());
const postCard = (p, i = 0, { hero = false } = {}) => `<article class="card post-card spotlight${hero ? ' post-card--hero' : ''}" data-post data-cat="${p.category ? p.category.slug : ''}" data-search="${searchText(p)}"${hero ? '' : ` data-reveal style="--d:${(i % 3) * 0.06}s"`}>
  <div class="post-card-media media-skel" style="view-transition-name:${vtName(p)}">${p.cover ? imgTag(p.cover, p.coverAlt, "", hero, `blog/${p.file}`) : `<span class="post-card-fallback" aria-hidden="true"><span>${esc(p.title.slice(0, 1))}</span></span>`}</div>
  <div class="post-card-body">
    ${statusTag(p)}
    <p class="post-meta">${p.category ? `<span class="cat-pill">${esc(p.category.name)}</span>` : ''}<time datetime="${p.date}">${fmtShort(p.date)}</time><span>${p.readMins} min read</span></p>
    <h${hero ? 2 : 3} class="post-card-title"><a class="stretched" href="/blog/${p.slug}">${esc(p.title)}</a></h${hero ? 2 : 3}>
    <p class="muted post-card-desc">${esc(p.description)}</p>
    <span class="more" aria-hidden="true">${hero ? 'Read the featured post' : 'Read post'} ${ICONS.arrow}</span>
  </div>
</article>`;

const usedCats = categoryList.filter((c) => posts.some((p) => p.category?.slug === c.slug))
  .concat([...new Map(posts.filter((p) => p.category && !catBySlug.has(p.category.slug)).map((p) => [p.category.slug, p.category])).values()]);
const chips = (active = '') => usedCats.length ? `<nav class="chips" aria-label="Blog categories">
  <a class="chip-link" href="/blog/" data-filter-cat=""${active ? '' : ' aria-current="page"'}>All</a>
  ${usedCats.map((c) => `<a class="chip-link" href="/blog/category/${c.slug}/" data-filter-cat="${c.slug}"${active === c.slug ? ' aria-current="page"' : ''}>${esc(c.name)}</a>`).join('\n  ')}
</nav>` : '';
const toolbar = (active) => `<div class="blog-toolbar">
  <div class="search-field">
    ${ICONS.search}
    <label class="sr-only" for="blog-search">Search posts</label>
    <input id="blog-search" type="search" placeholder="Search posts, topics or tags" autocomplete="off" enterkeyhint="search" data-blog-search>
  </div>
  ${chips(active)}
</div>`;
const emptyFilter = `<div class="card empty-state empty-filter" data-blog-empty hidden role="status">
  <h3>No posts match that.</h3>
  <p class="muted">Try a shorter word, or clear the search to see every post.</p>
  <button class="btn btn-ghost btn-sm" type="button" data-blog-clear>Clear search</button>
</div>`;
const gridBlock = (list) => `<div class="post-grid" data-blog-grid data-per-page="${PER_PAGE}">${list.map((p, i) => postCard(p, i)).join('\n')}</div>
${emptyFilter}
<div class="load-more" data-load-more-wrap hidden><button class="btn btn-ghost" type="button" data-load-more>Show more posts</button><p class="muted" data-load-count aria-live="polite"></p></div>`;
const featuredPost = posts.find((p) => p.featured) || null;
const blogList = posts.length
  ? `${featuredPost ? `<div class="featured-wrap" data-reveal><p class="kicker">Featured</p>${postCard(featuredPost, 0, { hero: true })}</div>` : ''}
${toolbar('')}
${gridBlock(posts.filter((p) => p !== featuredPost))}`
  : `<div class="card empty-state"><span class="empty-icon" aria-hidden="true">${ICONS.pen}</span><h2>First posts coming soon.</h2><p class="muted">We're writing practical guides on reels, content and growing on Instagram. Follow along in the meantime.</p><a class="btn btn-ghost" href="${cfg.instagramUrl}" target="_blank" rel="noopener">${ICONS.instagram} Follow on Instagram</a></div>`;
const rssLink = `<link rel="alternate" type="application/rss+xml" title="${esc(cfg.siteName)} blog" href="/blog/feed.xml">`;
baseVars.headExtra = rssLink;

/* related posts: same category first, then shared tags, then newest */
const related = (p) => posts.filter((q) => q !== p)
  .map((q) => ({ q, score: (q.category && p.category && q.category.slug === p.category.slug ? 3 : 0) + q.tags.filter((t) => p.tags.includes(t)).length }))
  .sort((a, b) => b.score - a.score || b.q.date.localeCompare(a.q.date)).slice(0, 3).map((x) => x.q);

for (const p of posts) {
  const where = `blog/${p.file}`;
  const bodyHtml = markdownToHtml(p.body, { image: (src, alt) => imgTag(src, alt, '', false, where) }).replace(/\{/g, '&#123;').replace(/\}/g, '&#125;');
  const path = `/blog/${p.slug}`;
  const url = cfg.siteUrl + path;
  const coverAbs = p.cover ? (p.cover.startsWith('/') ? cfg.siteUrl + p.cover : p.cover) : `${cfg.siteUrl}/og-image.png`;
  const crumbs = [['Home', '/'], ['Blog', '/blog/'], ...(p.category ? [[p.category.name, `/blog/category/${p.category.slug}/`]] : []), [p.title, path]];
  const articleLd = ld({ '@context': 'https://schema.org', '@graph': [{
    '@type': 'BlogPosting', headline: p.title.slice(0, 110), description: p.description, image: coverAbs,
    datePublished: p.date, dateModified: p.updated || p.date, wordCount: p.words, inLanguage: 'en-IN',
    author: { '@type': 'Person', name: p.author }, publisher: { '@id': `${cfg.siteUrl}/#org` },
    mainEntityOfPage: url, ...(p.category ? { articleSection: p.category.name } : {}), ...(p.tags.length ? { keywords: p.tags.join(', ') } : {}),
  }, crumbsLd(crumbs), orgLd] });
  const headExtra = [rssLink,
    `<meta property="article:published_time" content="${p.date}">`,
    `<meta property="article:modified_time" content="${p.updated || p.date}">`,
    `<meta property="article:author" content="${esc(p.author)}">`,
    p.category ? `<meta property="article:section" content="${esc(p.category.name)}">` : '',
    ...p.tags.map((t) => `<meta property="article:tag" content="${esc(t)}">`),
    p.cover && p.cover.startsWith('/') ? `<link rel="preload" as="image" href="${esc(p.cover)}" fetchpriority="high">` : '',
  ].filter(Boolean).join('\n');
  const rel = related(p);
  const share = encodeURIComponent(url);
  const shareText = encodeURIComponent(p.title);
  writePage(where, { path, nav: 'blog', title: `${p.title} | ${cfg.siteName}`, description: p.description, noindex: p.status !== 'published', lastmod: p.updated || p.date }, partial('post'), {
    jsonld: articleLd, ogType: 'article', ogImage: p.cover && p.cover.startsWith('/') ? p.cover : '/og-image.png', ogImageAlt: esc(p.coverAlt || p.title), headExtra,
    postTitle: esc(p.title), postDescription: esc(p.description), postAuthor: esc(p.author),
    postDateIso: p.date, postDateNice: fmtDate(p.date), postReadMins: String(p.readMins),
    postUpdated: p.updated ? `<span>· Updated <time datetime="${p.updated}">${fmtDate(p.updated)}</time></span>` : '',
    postDraftTag: statusTag(p),
    postCrumbs: `<nav class="crumbs" aria-label="Breadcrumb"><ol>${crumbs.slice(0, -1).map(([n, h]) => `<li><a href="${h}">${esc(n)}</a></li>`).join('')}</ol></nav>`,
    postCategory: p.category ? `<a class="cat-pill" href="/blog/category/${p.category.slug}/">${esc(p.category.name)}</a>` : '',
    postCover: p.cover ? `<figure class="post-cover media-skel" style="view-transition-name:${vtName(p)}">${imgTag(p.cover, p.coverAlt, '', true, where)}</figure>` : `<div class="post-cover post-cover--none" style="view-transition-name:${vtName(p)}" aria-hidden="true"></div>`,
    postTags: p.tags.length ? `<ul class="tag-list" aria-label="Tags">${p.tags.map((t) => `<li><a class="tag" href="/blog/?q=${encodeURIComponent(t)}">#${esc(t)}</a></li>`).join('')}</ul>` : '',
    postShare: `<div class="share" aria-label="Share this post">
      <span class="share-label">Share</span>
      <a class="icon-btn" href="https://wa.me/?text=${shareText}%20${share}" target="_blank" rel="noopener" aria-label="Share on WhatsApp">${ICONS.whatsapp}</a>
      <a class="icon-btn" href="https://www.linkedin.com/sharing/share-offsite/?url=${share}" target="_blank" rel="noopener" aria-label="Share on LinkedIn">${ICONS.linkedin}</a>
      <a class="icon-btn" href="https://x.com/intent/post?url=${share}&amp;text=${shareText}" target="_blank" rel="noopener" aria-label="Share on X">${ICONS.xsocial}</a>
      <button class="icon-btn" type="button" data-copy-link="${esc(url)}" aria-label="Copy link">${ICONS.link}</button>
    </div>`,
    postMore: rel.length ? `<section class="post-more" aria-labelledby="more-title"><h2 id="more-title">Keep reading</h2><div class="post-grid">${rel.map((q, i) => postCard(q, i)).join('')}</div></section>` : '',
  }, { '<!--POST_BODY-->': bodyHtml });
}

/* category pages: /blog/category/<name>/ (only for categories that have posts) */
for (const c of usedCats) {
  const list = posts.filter((p) => p.category?.slug === c.slug);
  const path = `/blog/category/${c.slug}/`;
  writePage(`blog/category/${c.slug}`, { path, nav: 'blog', title: `${c.name}: articles | ${cfg.siteName} blog`, description: `Articles about ${c.name.toLowerCase()} from the ${cfg.siteName} team: practical tips for brands growing on social media.`,
    noindex: !list.some((p) => p.status === 'published'), lastmod: list[0].updated || list[0].date }, `
<section class="page-hero page-hero--blog">
  <div class="aurora" aria-hidden="true"><span class="a1"></span><span class="a2"></span></div>
  <div class="grid-lines" aria-hidden="true"></div>
  <div class="container hero-inner">
    <nav class="crumbs" aria-label="Breadcrumb"><ol><li><a href="/">Home</a></li><li><a href="/blog/">Blog</a></li></ol></nav>
    <h1>${esc(c.name)}</h1>
    <p class="lead">${list.length} ${list.length === 1 ? 'article' : 'articles'} on ${esc(c.name.toLowerCase())}.</p>
  </div>
</section>
<section class="section blog-section" aria-label="Posts">
  <div class="container">
    ${toolbar(c.slug)}
    ${gridBlock(list)}
  </div>
</section>
{{ctaBand}}`, { jsonld: ld({ '@context': 'https://schema.org', '@graph': [{ '@type': 'CollectionPage', name: c.name, url: cfg.siteUrl + path }, crumbsLd([['Home', '/'], ['Blog', '/blog/'], [c.name, path]])] }) });
}

/* ---------- pages ---------- */
const pages = readdirSync(join(SRC, 'pages')).filter((f) => f.endsWith('.html'));
const blogLd = ld({ '@context': 'https://schema.org', '@graph': [{ '@type': 'Blog', '@id': `${cfg.siteUrl}/blog/#blog`, name: `${cfg.siteName} blog`, url: `${cfg.siteUrl}/blog/`, publisher: { '@id': `${cfg.siteUrl}/#org` },
  blogPost: posts.filter((p) => p.status === 'published').slice(0, 20).map((p) => ({ '@type': 'BlogPosting', headline: p.title, url: `${cfg.siteUrl}/blog/${p.slug}`, datePublished: p.date })) }, crumbsLd([['Home', '/'], ['Blog', '/blog/']]), orgLd] });
for (const f of pages) {
  const raw = read(`pages/${f}`);
  const m = raw.match(/^<!--meta\s*([\s\S]*?)-->/);
  if (!m) throw new Error(`${f}: missing <!--meta {...}--> header`);
  const meta = JSON.parse(m[1]);
  writePage(f, meta, raw.slice(m[0].length), { blogList, ...(meta.path === '/blog/' ? { jsonld: blogLd } : {}) });
}
if (leftover.length) { console.error('Unresolved tokens:\n' + leftover.join('\n')); process.exit(1); }

writeFileSync(join(DIST, 'assets/js', jsFile), js);
for (const f of readdirSync(join(SRC, 'assets/fonts'))) copyFileSync(join(SRC, 'assets/fonts', f), join(DIST, 'assets/fonts', f));

/* static files copied as-is (favicons, og image, reels, photos) */
const copyDir = (from, to) => {
  if (!existsSync(from)) return;
  mkdirSync(to, { recursive: true });
  for (const f of readdirSync(from)) {
    const s = join(from, f), d = join(to, f);
    statSync(s).isDirectory() ? copyDir(s, d) : copyFileSync(s, d);
  }
};
copyDir(join(SRC, 'static'), DIST);

/* blog editor (Decap CMS) config + preview styles */
const cms = cfg.cms || {};
const y = (v) => JSON.stringify(v); // JSON strings are valid YAML
mkdirSync(join(DIST, 'admin'), { recursive: true });
writeFileSync(join(DIST, 'admin/config.yml'), `# Generated by build.mjs from src/config.json → "cms". Edit there, not here.
backend:
  name: github
  repo: ${y(cms.repo || '')}
  branch: ${y(cms.branch || 'main')}
  base_url: ${y(cfg.siteUrl)}
  auth_endpoint: api/auth
  commit_messages:
    create: 'Blog: new post "{{slug}}"'
    update: 'Blog: update "{{slug}}"'
    delete: 'Blog: delete "{{slug}}"'
    uploadMedia: 'Blog: upload "{{path}}"'
    deleteMedia: 'Blog: delete "{{path}}"'
# Lets you edit on your own computer with "npx decap-server" (ignored on the live site)
local_backend: true
site_url: ${y(cfg.siteUrl)}
display_url: ${y(cfg.siteUrl)}
logo_url: /favicon.svg
media_folder: src/static/assets/blog
public_folder: /assets/blog
collections:
  - name: blog
    label: Blog posts
    label_singular: Blog post
    description: "Posts appear on the website about a minute after you press Publish. Tick Draft to save without showing it. A future date schedules the post: it goes live on that day's automatic rebuild."
    folder: src/content/blog
    create: true
    delete: true
    extension: md
    format: json-frontmatter
    frontmatter_delimiter: ["---", "---"]
    slug: "{{slug}}"
    preview_path: "blog/{{slug}}"
    sortable_fields: ["date", "title", "commit_date"]
    summary: "{{title}} · {{draft | ternary('Draft', 'Live or scheduled')}} · {{date | date('DD MMM YYYY')}} · last edited {{commit_date | date('DD MMM YYYY')}}"
    view_filters:
      - { label: Drafts, field: draft, pattern: true }
      - { label: Not drafts, field: draft, pattern: false }
      - { label: Featured, field: featured, pattern: true }
    view_groups:
      - { label: Category, field: category }
    fields:
      - { label: Title, name: title, widget: string, pattern: ["^.{8,110}$", "Between 8 and 110 characters"], hint: "Pick it before the first save: it also becomes the web address." }
      - { label: Publish date, name: date, widget: datetime, format: "YYYY-MM-DD", date_format: "DD MMM YYYY", time_format: false, picker_utc: true, hint: "Today or earlier = live now. A future date schedules the post for that day (India time)." }
      - { label: Short description, name: description, widget: text, pattern: ["^[\\\\s\\\\S]{20,200}$", "Between 20 and 200 characters"], hint: "1–2 sentences. Shown on the blog list, in Google and in WhatsApp/Instagram link previews." }
      - { label: Category, name: category, widget: select, options: ${y(categoryList.map((c) => c.name))}, required: ${categoryList.length ? 'true' : 'false'} }
      - { label: Tags, name: tags, widget: list, required: false, max: 8, hint: "Optional. A few words people might search for, e.g. reels, hooks, captions." }
      - { label: Author, name: author, widget: string, default: ${y(cfg.siteName)} }
      - { label: Cover image, name: cover, widget: image, required: false, choose_url: false, hint: "Landscape 16:9, about 1600×900. JPG, PNG or WebP under 500 KB (shrink it at squoosh.app)." }
      - { label: Cover image description, name: coverAlt, widget: string, required: false, hint: "Describe the image for people who can't see it. Also used in link previews." }
      - { label: "Feature at the top of the blog", name: featured, widget: boolean, default: false, required: false, hint: "The newest featured post gets the large banner on the blog page." }
      - { label: "Draft (hide from website)", name: draft, widget: boolean, default: false }
      - { label: "Last updated (optional)", name: updated, widget: datetime, format: "YYYY-MM-DD", date_format: "DD MMM YYYY", time_format: false, picker_utc: true, required: false, hint: "Set this when you make a real change to an older post. Shown on the post and to Google." }
      - { label: Post, name: body, widget: markdown, buttons: ["bold", "italic", "link", "heading-two", "heading-three", "quote", "bulleted-list", "numbered-list", "code"], editor_components: ["image"], modes: ["rich_text", "raw"] }
`);
writeFileSync(join(DIST, 'admin/preview.css'), css);

/* sitemap + robots */
writeFileSync(join(DIST, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemap.map((p) => `  <url><loc>${cfg.siteUrl}${p.path}</loc><lastmod>${p.lastmod}</lastmod></url>`).join('\n')}\n</urlset>\n`);

/* RSS feed (published posts only) */
const xml = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const feedPosts = posts.filter((p) => p.status === 'published').slice(0, 30);
mkdirSync(join(DIST, 'blog'), { recursive: true });
writeFileSync(join(DIST, 'blog/feed.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>${xml(cfg.siteName)} blog</title>
  <link>${xml(cfg.siteUrl)}/blog/</link>
  <atom:link href="${xml(cfg.siteUrl)}/blog/feed.xml" rel="self" type="application/rss+xml"/>
  <description>Practical social media, content and Instagram growth tips from ${xml(cfg.siteName)}.</description>
  <language>en-IN</language>
${feedPosts.map((p) => `  <item>
    <title>${xml(p.title)}</title>
    <link>${xml(cfg.siteUrl)}/blog/${p.slug}</link>
    <guid isPermaLink="true">${xml(cfg.siteUrl)}/blog/${p.slug}</guid>
    <pubDate>${new Date(p.date + 'T09:00:00+05:30').toUTCString()}</pubDate>
    <description>${xml(p.description)}</description>${p.category ? `\n    <category>${xml(p.category.name)}</category>` : ''}
  </item>`).join('\n')}
</channel>
</rss>
`);
writeFileSync(join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /admin/\n\nSitemap: ${cfg.siteUrl}/sitemap.xml\n`);

/* Cloudflare Pages headers. CSP starts as Report-Only: switch to enforcing after
   checking the preview console shows no violations with Cal.com + Web3Forms live. */
const themeHash = createHash('sha256').update(themeScript).digest('base64');
const csp = [
  "default-src 'self'",
  `script-src 'self' 'sha256-${themeHash}' https://app.cal.com https://static.cloudflareinsights.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "media-src 'self' https://*.b-cdn.net",
  "font-src 'self'",
  "frame-src https://cal.com https://app.cal.com",
  "connect-src 'self' https://api.web3forms.com https://app.cal.com https://cal.com https://cloudflareinsights.com",
  "form-action 'self' https://api.web3forms.com",
  "base-uri 'self'",
  "frame-ancestors 'none'",
].join('; ');
writeFileSync(join(DIST, '_headers'), `/*
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  X-Frame-Options: DENY
  Content-Security-Policy-Report-Only: ${csp}

/assets/js/*
  Cache-Control: public, max-age=31536000, immutable

/assets/fonts/*
  Cache-Control: public, max-age=31536000, immutable

/assets/reels/*
  Cache-Control: public, max-age=2592000

/assets/blog/*
  Cache-Control: public, max-age=2592000
  Content-Security-Policy: default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox
  X-Content-Type-Options: nosniff

/blog/feed.xml
  Content-Type: application/rss+xml; charset=utf-8

/admin/*
  ! Content-Security-Policy-Report-Only
  X-Robots-Tag: noindex
  Cache-Control: no-store
`);

/* report */
const kb = (p) => (statSync(join(DIST, p)).size / 1024).toFixed(1);
console.log(`Built ${pages.length} pages + ${posts.length} blog post${posts.length === 1 ? '' : 's'} + ${usedCats.length} categor${usedCats.length === 1 ? 'y' : 'ies'}${SHOW_DRAFTS ? ' (drafts and scheduled shown)' : ''} → dist/`);
if (!SHOW_DRAFTS && hiddenCount) console.log(`  ${hiddenCount} post${hiddenCount === 1 ? '' : 's'} not public yet (draft or scheduled)`);
for (const w of new Set(warnings)) console.warn(`  ⚠ ${w}`);
for (const b of badPosts) console.error(`  ✖ Skipped a post that has a problem: ${b}`);
for (const f of readdirSync(DIST).filter((f) => f.endsWith('.html'))) console.log(`  ${f.padEnd(16)} ${kb(f)} KB`);
console.log(`  ${('js/' + jsFile).padEnd(16)} ${kb('assets/js/' + jsFile)} KB`);
console.log(`Look: ${lookCfg.preset || 'calm'} (glow ${look.glow}, motion ${look.motion}, buttons ${look.buttons}, default theme ${defaultTheme})`);
console.log(`Placeholders still on the site: ${placeholderCount} (search "data-placeholder" in src/pages)`);
const replaceLeft = JSON.stringify(cfg).match(/REPLACE[^"]*/g);
if (replaceLeft) console.log(`Config values still to replace: ${replaceLeft.length} (src/config.json)`);
