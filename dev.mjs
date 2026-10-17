// Local preview with auto-rebuild and auto-refresh. Run: npm run dev  (or: node dev.mjs)
// Drafts are shown here (with a Draft label) but never in the real build.
// Zero dependencies. Serves dist/ with clean URLs (/services → services.html), like Cloudflare Pages.
import http from 'node:http';
import { readFileSync, existsSync, statSync, watch } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const DIST = join(ROOT, 'dist');
const PORT = Number(process.env.PORT) || 5173;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.avif': 'image/avif', '.mp4': 'video/mp4', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.xml': 'application/xml', '.yml': 'text/yaml; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
};

const build = () => {
  const r = spawnSync(process.execPath, [join(ROOT, 'build.mjs')], { stdio: 'inherit', env: { ...process.env, SHOW_DRAFTS: '1' } });
  return r.status === 0;
};

// Auto-refresh: browsers listen on /__reload and reload after each successful build.
const clients = new Set();
const reloadSnippet = `<script>new EventSource('/__reload').onmessage=()=>location.reload()</script>`;

http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/__reload') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.write('retry: 1000\n\n');
    clients.add(res); req.on('close', () => clients.delete(res));
    return;
  }
  let file = url === '/' ? join(DIST, 'index.html') : join(DIST, url);
  if (url.endsWith('/') && existsSync(join(file, 'index.html'))) file = join(file, 'index.html');
  else if (!extname(url) && existsSync(file + '.html')) file += '.html';
  else if (!extname(url) && existsSync(join(file, 'index.html'))) { res.writeHead(301, { Location: url + '/' }); return res.end(); }
  let status = 200;
  if (!file.startsWith(DIST) || !existsSync(file) || statSync(file).isDirectory()) { file = join(DIST, '404.html'); status = 404; }
  if (!existsSync(file)) {
    // The last build failed, so dist/ is incomplete. Say so instead of crashing the preview.
    res.writeHead(503, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    return res.end(`<!doctype html><meta charset="utf-8"><title>Build failed</title><body style="font-family:system-ui;padding:32px;max-width:640px"><h1>The site didn't build</h1><p>Look at the terminal running <code>npm run dev</code> for the reason, fix it and save. This page refreshes by itself.</p>${reloadSnippet}</body>`);
  }
  let body = readFileSync(file);
  const type = TYPES[extname(file)] || 'application/octet-stream';
  if (type.startsWith('text/html')) body = body.toString().replace('</body>', `${reloadSnippet}</body>`);
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
}).listen(PORT, () => {
  console.log(`\n  What's Beyond preview → http://localhost:${PORT}\n  Edit anything in src/ or build.mjs and the page refreshes. Ctrl+C to stop.\n`);
});

build();

// Rebuild on save (debounced so one save = one build)
let timer;
const onChange = (_, name) => {
  if (name && /(^|[\\/])\.|~$/.test(name)) return; // ignore temp/hidden files
  clearTimeout(timer);
  timer = setTimeout(() => {
    console.log(`\n↻ ${name || 'change'} — rebuilding…`);
    if (build()) clients.forEach((c) => c.write('data: reload\n\n'));
  }, 150);
};
watch(join(ROOT, 'src'), { recursive: true }, onChange);
watch(join(ROOT, 'build.mjs'), onChange);
watch(join(ROOT, 'lib'), { recursive: true }, onChange);
