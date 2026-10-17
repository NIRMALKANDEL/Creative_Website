// Small, safe Markdown → HTML converter for blog posts (no dependencies).
// Supports: headings, paragraphs, line breaks, **bold**, *italic*, `code`, links, images,
// bullet and numbered lists, > quotes, --- rules, ``` code blocks.
// All raw HTML is escaped, so nothing typed in the editor can break the page.

export const escapeHtml = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const safeUrl = (u) => {
  const url = u.trim().replace(/^<|>$/g, '');
  return /^(https?:\/\/|\/|#|mailto:|tel:)/i.test(url) ? url : '#';
};

/**
 * @param {string} md
 * @param {{ image?: (src: string, alt: string) => string }} opts  hook to render images (sizes, lazy loading)
 */
export function markdownToHtml(md, opts = {}) {
  const imageHtml = opts.image || ((src, alt) => `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async">`);

  const inline = (text) => {
    // protect inline code first
    const codes = [];
    let s = text.replace(/`([^`]+)`/g, (_, c) => `\u0000${codes.push(c) - 1}\u0000`);
    s = escapeHtml(s);
    s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;[^&]*&quot;)?\)/g, (_, alt, src) => imageHtml(safeUrl(src.replace(/&amp;/g, '&')), alt.replace(/&quot;/g, '"').replace(/&amp;/g, '&')));
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+&quot;[^&]*&quot;)?\)/g, (_, t, href) => {
      const url = safeUrl(href.replace(/&amp;/g, '&'));
      const ext = /^https?:\/\//i.test(url);
      return `<a href="${escapeHtml(url)}"${ext ? ' target="_blank" rel="noopener"' : ''}>${t}</a>`;
    });
    s = s.replace(/\*\*([^*]+)\*\*|__([^_]+)__/g, (_, a, b) => `<strong>${a || b}</strong>`);
    s = s.replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\w)/g, '$1<em>$2</em>').replace(/(^|[^_\w])_([^_\s][^_]*?)_(?!\w)/g, '$1<em>$2</em>');
    s = s.replace(/ {2,}\n|\\\n/g, '<br>').replace(/\n/g, ' ');
    return s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${escapeHtml(codes[+i])}</code>`);
  };

  const lines = md.replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let i = 0;
  const isBlockStart = (l) => /^(#{1,6}\s|>|```|\s*([-*+]|\d+[.)])\s|(-{3,}|\*{3,}|_{3,})\s*$)/.test(l);

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    if (/^```/.test(line)) {
      const buf = []; i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++;
      out.push(`<pre><code>${escapeHtml(buf.join('\n'))}</code></pre>`);
      continue;
    }
    const h = line.match(/^(#{1,6})\s+(.*?)\s*#*$/);
    if (h) {
      // The post title is the page's only h1, so # and ## both become h2.
      const level = Math.min(4, Math.max(2, h[1].length));
      out.push(`<h${level}>${inline(h[2])}</h${level}>`); i++; continue;
    }
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { out.push('<hr>'); i++; continue; }
    if (/^>/.test(line)) {
      const buf = [];
      while (i < lines.length && /^>/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ''));
      out.push(`<blockquote>${markdownToHtml(buf.join('\n'), opts)}</blockquote>`);
      continue;
    }
    const li = line.match(/^\s*([-*+]|\d+[.)])\s+/);
    if (li) {
      const ordered = /\d/.test(li[1]);
      const items = [];
      while (i < lines.length) {
        const m = lines[i].match(/^\s*([-*+]|\d+[.)])\s+(.*)$/);
        if (m && /\d/.test(m[1]) === ordered) { items.push(m[2]); i++; continue; }
        if (lines[i].trim() && /^\s{2,}/.test(lines[i]) && items.length) { items[items.length - 1] += '\n' + lines[i].trim(); i++; continue; }
        break;
      }
      const tag = ordered ? 'ol' : 'ul';
      out.push(`<${tag}>${items.map((t) => `<li>${inline(t)}</li>`).join('')}</${tag}>`);
      continue;
    }
    const buf = [];
    while (i < lines.length && lines[i].trim() && !(buf.length && isBlockStart(lines[i]))) buf.push(lines[i++]);
    const para = buf.join('\n');
    const lone = para.trim().match(/^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)$/);
    if (lone) {
      out.push(`<figure>${imageHtml(safeUrl(lone[2]), lone[1])}${lone[1] ? `<figcaption>${escapeHtml(lone[1])}</figcaption>` : ''}</figure>`);
    } else {
      out.push(`<p>${inline(para)}</p>`);
    }
  }
  return out.join('\n');
}

/** Read width/height from PNG, JPEG, GIF or WebP bytes so images reserve their space (no layout jump). */
export function imageSize(buf) {
  try {
    if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
    if (buf.length > 10 && buf.toString('ascii', 0, 3) === 'GIF') return { w: buf.readUInt16LE(6), h: buf.readUInt16LE(8) };
    if (buf.length > 30 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
      const kind = buf.toString('ascii', 12, 16);
      if (kind === 'VP8X') return { w: 1 + buf.readUIntLE(24, 3), h: 1 + buf.readUIntLE(27, 3) };
      if (kind === 'VP8 ') return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
      if (kind === 'VP8L') { const b = buf.readUInt32LE(21); return { w: 1 + (b & 0x3fff), h: 1 + ((b >> 14) & 0x3fff) }; }
    }
    if (buf[0] === 0xff && buf[1] === 0xd8) {
      let o = 2;
      while (o < buf.length) {
        if (buf[o] !== 0xff) { o++; continue; }
        const marker = buf[o + 1];
        const len = buf.readUInt16BE(o + 2);
        if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { w: buf.readUInt16BE(o + 7), h: buf.readUInt16BE(o + 5) };
        o += 2 + len;
      }
    }
  } catch (e) { /* unknown or broken image */ }
  return null;
}

/** Parse a post file: front matter (JSON or simple YAML) between --- lines, then Markdown body. */
export function parsePost(raw) {
  const text = raw.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  let data = {}, body = text;
  const fm = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (fm) {
    body = fm[2];
    const head = fm[1].trim();
    if (head.startsWith('{')) data = JSON.parse(head);
    else if (head.startsWith('"')) data = JSON.parse(`{${head}}`); // Decap's json-frontmatter with --- delimiters omits the outer braces
    else {
      for (const l of head.split('\n')) {
        const m = l.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
        if (!m) continue;
        let v = m[2].trim();
        if (/^(["']).*\1$/.test(v)) v = v.slice(1, -1).replace(/\\"/g, '"').replace(/''/g, "'");
        else if (v === 'true' || v === 'false') v = v === 'true';
        data[m[1]] = v;
      }
    }
  } else if (text.startsWith('{')) {
    // Decap "json-frontmatter" with default { } delimiters
    let depth = 0, end = -1, inStr = false, esc = false;
    for (let k = 0; k < text.length; k++) {
      const c = text[k];
      if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
      if (c === '"') inStr = true; else if (c === '{') depth++; else if (c === '}' && --depth === 0) { end = k; break; }
    }
    data = JSON.parse(text.slice(0, end + 1));
    body = text.slice(end + 1);
  }
  return { data, body: (data.body ?? body).trim() };
}
