/* What's Beyond — one small script. No libraries. */
(() => {
  const doc = document.documentElement;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } },
    remove(k) { try { localStorage.removeItem(k); } catch (e) { /* private mode */ } }
  };

  /* ---------- Look preferences: mode, palette, accent, corners, motion ----------
     The <head> script applies saved choices before paint; this keeps them in sync afterwards. */
  const KEY = 'wb-look';
  const DEFAULTS = { mode: doc.dataset.defaultMode || 'system', palette: 'cherry', accent: 'auto', radius: 'rounded', motion: doc.dataset.defaultMotion || 'full' };
  const ALLOWED = { mode: ['system', 'light', 'dark'], palette: ['cherry', 'grape', 'sunset'], accent: ['auto', 'pink', 'violet', 'coral', 'teal'], radius: ['rounded', 'soft', 'sharp'], motion: ['full', 'calm', 'off'] };
  const loadPrefs = () => {
    let saved = {};
    try { saved = JSON.parse(store.get(KEY) || '{}') || {}; } catch (e) { saved = {}; }
    const old = store.get('theme');
    if (!saved.mode && (old === 'light' || old === 'dark')) saved.mode = old;
    const out = { ...DEFAULTS };
    for (const k of Object.keys(ALLOWED)) if (ALLOWED[k].includes(saved[k])) out[k] = saved[k];
    return out;
  };
  let prefs = loadPrefs();
  const sysLight = matchMedia('(prefers-color-scheme: light)');
  const resolveMode = (m) => (m === 'light' || m === 'dark' ? m : sysLight.matches ? 'light' : 'dark');
  const attr = (name, value, skip) => { if (value === skip) doc.removeAttribute(name); else doc.setAttribute(name, value); };
  const toggles = document.querySelectorAll('.theme-toggle');
  const panel = document.getElementById('look-panel');
  const themeMeta = document.querySelectorAll('meta[name="theme-color"]');

  const apply = () => {
    const mode = resolveMode(prefs.mode);
    doc.dataset.theme = mode;
    attr('data-palette', prefs.palette, 'cherry');
    attr('data-accent', prefs.accent, 'auto');
    attr('data-radius', prefs.radius, 'rounded');
    doc.setAttribute('data-motion', prefs.motion);
    toggles.forEach((b) => {
      b.setAttribute('aria-label', mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
      b.setAttribute('aria-pressed', String(mode === 'dark'));
    });
    const bg = getComputedStyle(doc).getPropertyValue('--bg').trim();
    themeMeta.forEach((m) => { m.removeAttribute('media'); m.setAttribute('content', bg); });
    if (panel) {
      panel.querySelectorAll('[data-preview]').forEach((el) => { el.dataset.theme = mode; });
      for (const k of Object.keys(ALLOWED)) { const r = panel.querySelector(`input[name="${k}"][value="${prefs[k]}"]`); if (r) r.checked = true; }
    }
    window.dispatchEvent(new CustomEvent('themechange', { detail: mode }));
  };
  const save = () => {
    const diff = {};
    for (const k of Object.keys(DEFAULTS)) if (prefs[k] !== DEFAULTS[k]) diff[k] = prefs[k];
    if (Object.keys(diff).length) store.set(KEY, JSON.stringify(diff)); else store.remove(KEY);
    store.remove('theme');
  };
  const motionOk = () => !reduceMotion && prefs.motion !== 'off';

  /* Theme changes reveal as a circle from the control you pressed (View Transitions), or cross-fade. */
  const withTransition = (change, from) => {
    if (!motionOk()) { change(); return; }
    if (document.startViewTransition && from) {
      const r = from.getBoundingClientRect();
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      const end = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
      doc.dataset.vt = 'theme';
      const t = document.startViewTransition(change);
      t.ready.then(() => {
        doc.animate({ clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${end}px at ${x}px ${y}px)`] },
          { duration: 650, easing: 'cubic-bezier(.22,1,.36,1)', pseudoElement: '::view-transition-new(root)' });
      }).catch(() => {});
      t.finished.finally(() => { delete doc.dataset.vt; });
      return;
    }
    doc.classList.add('theme-fade');
    change();
    setTimeout(() => doc.classList.remove('theme-fade'), 500);
  };
  const setPref = (k, v, from) => {
    if (!ALLOWED[k] || !ALLOWED[k].includes(v) || prefs[k] === v) return;
    const big = k === 'mode' || k === 'palette';
    const run = () => { prefs = { ...prefs, [k]: v }; apply(); save(); };
    big ? withTransition(run, from) : (doc.classList.add('theme-fade'), run(), setTimeout(() => doc.classList.remove('theme-fade'), 500));
  };
  apply();
  toggles.forEach((b) => b.addEventListener('click', () => setPref('mode', doc.dataset.theme === 'dark' ? 'light' : 'dark', b)));
  sysLight.addEventListener?.('change', () => { if (prefs.mode === 'system') withTransition(apply, null); });
  window.addEventListener('storage', (e) => { if (e.key === KEY) { prefs = loadPrefs(); apply(); } });

  /* Customizer panel */
  if (panel) {
    const openers = document.querySelectorAll('[data-open-look]');
    let lastOpener = null;
    const open = (btn) => {
      lastOpener = btn;
      document.querySelector('.nav.is-open') && menuClose?.();
      apply();
      if (typeof panel.showModal === 'function') panel.showModal(); else panel.setAttribute('open', '');
      panel.querySelector('input:checked')?.focus();
    };
    openers.forEach((b) => b.addEventListener('click', () => open(b)));
    panel.addEventListener('close', () => { (lastOpener && lastOpener.offsetParent ? lastOpener : document.querySelector('.look-btn'))?.focus?.(); });
    panel.addEventListener('click', (e) => { if (e.target === panel) panel.close(); });
    panel.addEventListener('change', (e) => {
      const input = e.target;
      if (input.type === 'radio') setPref(input.name, input.value, input.closest('label'));
    });
    panel.querySelector('[data-look-reset]')?.addEventListener('click', (e) => {
      withTransition(() => { prefs = { ...DEFAULTS }; save(); apply(); }, e.currentTarget);
      flash('Look reset to default');
    });
  }

  /* Small confirmation message */
  function flash(text) { window.wbNotify ? window.wbNotify(text, 'success') : null; }

  /* Header border on scroll + story-bar progress fallback */
  const header = document.querySelector('.site-header');
  const progress = document.querySelector('.story-progress span');
  const needsProgressJs = progress && !(window.CSS && CSS.supports('animation-timeline: scroll()'));
  if (header) {
    let ticking = false;
    const onScroll = () => {
      ticking = false;
      header.classList.toggle('is-scrolled', window.scrollY > 8);
      if (needsProgressJs) {
        const max = document.documentElement.scrollHeight - innerHeight;
        progress.style.setProperty('--progress', max > 0 ? Math.min(1, scrollY / max).toFixed(4) : 0);
      }
    };
    onScroll();
    window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  }

  /* Mobile menu */
  const menuBtn = document.querySelector('.menu-btn');
  const nav = document.getElementById('site-nav');
  let menuClose = null;
  if (menuBtn && nav) {
    menuClose = () => { nav.classList.remove('is-open'); menuBtn.setAttribute('aria-expanded', 'false'); document.body.classList.remove('menu-open'); };
    menuBtn.addEventListener('click', () => {
      const open = !nav.classList.contains('is-open');
      if (!open) { menuClose(); return; }
      nav.classList.add('is-open');
      menuBtn.setAttribute('aria-expanded', 'true');
      document.body.classList.add('menu-open');
      nav.querySelector('a')?.focus({ preventScroll: true });
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && nav.classList.contains('is-open')) { menuClose(); menuBtn.focus(); } });
    nav.addEventListener('click', (e) => { if (e.target.closest('a')) menuClose(); });
    matchMedia('(min-width: 961px)').addEventListener?.('change', (e) => { if (e.matches) menuClose(); });
  }

  /* Scroll reveal */
  const revealEls = document.querySelectorAll('[data-reveal]');
  if ('IntersectionObserver' in window && !reduceMotion) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('in'));
  }

  /* Spotlight cards — CSS variables only, one rAF per frame */
  if (matchMedia('(hover: hover)').matches) {
    let raf = 0, last;
    document.addEventListener('pointermove', (e) => {
      last = e;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const card = last.target.closest?.('.spotlight');
        if (!card) return;
        const r = card.getBoundingClientRect();
        card.style.setProperty('--mx', `${last.clientX - r.left}px`);
        card.style.setProperty('--my', `${last.clientY - r.top}px`);
      });
    }, { passive: true });
  }

  /* Counters (only for real, confirmed numbers: data-count="120") */
  const counters = document.querySelectorAll('[data-count]');
  if (counters.length && 'IntersectionObserver' in window) {
    const run = (el) => {
      const end = parseFloat(el.dataset.count); const suffix = el.dataset.suffix || '';
      if (reduceMotion || isNaN(end)) { el.textContent = (isNaN(end) ? el.textContent : end) + suffix; return; }
      const t0 = performance.now(), dur = 1400;
      const tick = (t) => {
        const p = Math.min(1, (t - t0) / dur); const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(end * eased) + suffix;
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
    const cio = new IntersectionObserver((ents) => ents.forEach((en) => { if (en.isIntersecting) { run(en.target); cio.unobserve(en.target); } }), { threshold: 0.6 });
    counters.forEach((c) => cio.observe(c));
  }

  /* Reels — only on-screen reels play; nothing plays with reduced motion */
  const videos = document.querySelectorAll('video[data-reel]');
  if (videos.length && 'IntersectionObserver' in window) {
    const vio = new IntersectionObserver((ents) => {
      ents.forEach((en) => {
        const v = en.target;
        if (en.isIntersecting && !reduceMotion) { v.play().catch(() => {}); } else { v.pause(); }
      });
    }, { threshold: 0.55 });
    videos.forEach((v) => vio.observe(v));
  }

  /* ---------- Notifications (accessible toasts) ---------- */
  const noticeHost = document.querySelector('[data-notices]');
  function notify(text, kind = 'info') {
    if (!noticeHost) return;
    const el = document.createElement('div');
    el.className = `notice notice--${kind}`;
    el.setAttribute('role', kind === 'error' ? 'alert' : 'status');
    el.innerHTML = `<span class="notice-dot" aria-hidden="true"></span><span></span><button type="button" class="notice-x" aria-label="Dismiss">×</button>`;
    el.children[1].textContent = text;
    el.querySelector('.notice-x').addEventListener('click', () => el.remove());
    noticeHost.appendChild(el);
    setTimeout(() => { el.classList.add('is-out'); setTimeout(() => el.remove(), 400); }, kind === 'error' ? 7000 : 4200);
  }
  window.wbNotify = notify;

  /* ---------- Time zones: India (IST) is home, visitors see their own zone ---------- */
  const HOME_TZ = 'Asia/Kolkata';
  let visitorTz = HOME_TZ;
  try { visitorTz = Intl.DateTimeFormat().resolvedOptions().timeZone || HOME_TZ; } catch (e) { /* old browser */ }
  if (visitorTz === 'Asia/Calcutta') visitorTz = HOME_TZ; // older name for the same zone
  const timeIn = (tz) => { try { return new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: tz }).format(new Date()); } catch (e) { return ''; } };
  const tzName = (tz) => { try { return new Intl.DateTimeFormat('en', { timeZone: tz, timeZoneName: 'long' }).formatToParts(new Date()).find((p) => p.type === 'timeZoneName')?.value || tz; } catch (e) { return tz; } };
  const fillTz = () => {
    const sameAsUs = visitorTz === HOME_TZ || visitorTz === 'Asia/Calcutta';
    document.querySelectorAll('[data-tz-text]').forEach((p) => {
      p.textContent = '';
      const b = (t) => { const x = document.createElement('b'); x.textContent = t; return x; };
      if (sameAsUs) {
        p.append('Times are shown in ', b('India Standard Time (IST, UTC+5:30)'), `, the same as us in Indore. It's ${timeIn(HOME_TZ)} now.`);
      } else {
        p.append('Times are shown in ', b(`your time zone: ${tzName(visitorTz)}`), ` (${visitorTz.replace(/_/g, ' ')}, ${timeIn(visitorTz)} now). We're in Indore, India, where it's `, b(`${timeIn(HOME_TZ)} IST`), '. You can change the time zone in the calendar.');
      }
    });
    document.querySelectorAll('[data-tz-hint]').forEach((h) => { h.textContent = sameAsUs ? 'India time (IST).' : `Your time zone (${visitorTz.replace(/_/g, ' ')}).`; });
    document.querySelectorAll('[data-visitor-tz]').forEach((i) => { i.value = visitorTz; });
    document.querySelectorAll('[data-page-url]').forEach((i) => { i.value = location.pathname; });
    document.querySelectorAll('[data-ist-clock]').forEach((c) => { c.textContent = `It's ${timeIn(HOME_TZ)} here (IST, UTC+5:30)`; });
  };
  fillTz();
  setInterval(fillTz, 30000);

  /* ---------- Cal.com: loads only when a calendar is opened or scrolled near ---------- */
  const calConnected = (link) => link && !link.startsWith('REPLACE');
  const calLoader = () => {
    if (window.Cal) return window.Cal;
    /* Official Cal.com embed loader */
    (function (C, A, L) { let p = function (a, ar) { a.q.push(ar); }; let d = C.document; C.Cal = C.Cal || function () { let cal = C.Cal; let ar = arguments; if (!cal.loaded) { cal.ns = {}; cal.q = cal.q || []; d.head.appendChild(d.createElement("script")).src = A; cal.loaded = true; } if (ar[0] === L) { const api = function () { p(api, arguments); }; const namespace = ar[1]; api.q = api.q || []; if (typeof namespace === "string") { cal.ns[namespace] = cal.ns[namespace] || api; p(cal.ns[namespace], ar); p(cal, ["initNamespace", namespace]); } else p(cal, ar); return; } p(cal, ar); }; })(window, "https://app.cal.com/embed/embed.js", "init");
    window.addEventListener('themechange', (e) => { Object.values(window.Cal.ns || {}).forEach((ns) => ns('ui', { theme: e.detail })); });
    return window.Cal;
  };
  const mountCal = (host) => {
    const wrap = host.closest('.cal-shell, .tab-pane') || host.parentElement;
    const loading = wrap.querySelector('[data-cal-loading]');
    const missing = wrap.querySelector('[data-cal-missing]');
    const link = host.dataset.calLink;
    if (!calConnected(link)) { loading?.setAttribute('hidden', ''); host.hidden = true; if (missing) missing.hidden = false; return false; }
    if (host.dataset.mounted) return true;
    host.dataset.mounted = '1';
    const ns = `wb${host.dataset.calNs || 'x'}`;
    const Cal = calLoader();
    Cal('init', ns, { origin: 'https://cal.com' });
    Cal.ns[ns]('inline', { elementOrSelector: host, calLink: link, config: { layout: 'month_view', theme: doc.dataset.theme } });
    Cal.ns[ns]('ui', { theme: doc.dataset.theme, hideEventTypeDetails: false, layout: 'month_view', cssVarsPerTheme: { light: { 'cal-brand': '#8A1538' }, dark: { 'cal-brand': '#FFE08A' } } });
    host.hidden = false;
    setTimeout(() => loading?.setAttribute('hidden', ''), 1200);
    return true;
  };
  const pageCal = document.getElementById('cal-inline');
  if (pageCal) {
    if (!calConnected(pageCal.dataset.calLink)) mountCal(pageCal);
    document.querySelectorAll('[data-load-cal]').forEach((b) => b.addEventListener('click', () => mountCal(pageCal)));
    if ('IntersectionObserver' in window) {
      const calIo = new IntersectionObserver((ents) => { if (ents.some((e) => e.isIntersecting)) { mountCal(pageCal); calIo.disconnect(); } }, { rootMargin: '200px' });
      calIo.observe(pageCal.parentElement);
    }
  }

  /* ---------- "Let's talk" panel: book a call or send an enquiry without leaving the page ---------- */
  const contact = document.getElementById('contact-panel');
  const onBookPage = /\/book(\.html)?$/.test(location.pathname.replace(/\/$/, ''));
  if (contact) {
    const tabs = [...contact.querySelectorAll('[role="tab"]')];
    let opener = null;
    const selectTab = (name, focus = false) => {
      tabs.forEach((t) => {
        const on = t.id === `tab-${name}`;
        t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1;
        document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
        if (on && focus) t.focus();
      });
      if (name === 'call') mountCal(contact.querySelector('[data-cal-host]'));
    };
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => selectTab(t.id.replace('tab-', '')));
      t.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
        selectTab(next.id.replace('tab-', ''), true);
      });
    });
    contact.querySelectorAll('[data-switch-tab]').forEach((b) => b.addEventListener('click', () => selectTab(b.dataset.switchTab, true)));
    const openContact = (tab, from) => {
      opener = from || document.activeElement;
      menuClose?.();
      const calOk = calConnected(contact.querySelector('[data-cal-host]')?.dataset.calLink);
      selectTab(tab === 'enquiry' || !calOk ? 'enquiry' : 'call');
      if (typeof contact.showModal === 'function') contact.showModal(); else contact.setAttribute('open', '');
      document.body.classList.add('modal-open');
      const first = contact.querySelector('[role="tab"][aria-selected="true"]');
      setTimeout(() => (tab === 'enquiry' || !calOk ? contact.querySelector('#pane-enquiry input[name="name"]') : first)?.focus({ preventScroll: true }), 60);
    };
    const closeContact = () => { if (contact.open) contact.close(); };
    contact.addEventListener('close', () => { document.body.classList.remove('modal-open'); opener?.focus?.({ preventScroll: true }); });
    contact.addEventListener('click', (e) => { if (e.target === contact) closeContact(); });
    contact.querySelector('[data-close-contact]').addEventListener('click', closeContact);
    document.addEventListener('click', (e) => {
      const a = e.target.closest('[data-contact], a[href="/book"], a[href="/book#enquiry"], a[href="/book#call"], a[href$="book.html"], a[href$="book.html#enquiry"], a[href$="book.html#call"]');
      if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      if (onBookPage && !a.hasAttribute('data-contact-force')) {
        // already on the booking page: scroll to the right block instead of opening a pop-up
        const target = document.getElementById(a.dataset.contact === 'enquiry' || /#enquiry/.test(a.getAttribute('href') || '') ? 'enquiry' : 'call');
        if (target) { e.preventDefault(); target.scrollIntoView({ behavior: motionOk() ? 'smooth' : 'auto', block: 'start' }); }
        return;
      }
      e.preventDefault();
      openContact(a.dataset.contact || (/#enquiry$/.test(a.getAttribute('href') || '') ? 'enquiry' : 'call'), a);
    });
    if (location.hash === '#talk') openContact('call');
  }

  /* ---------- Enquiry forms (pop-up and Book page). Web3Forms; without JS the form posts normally ---------- */
  document.querySelectorAll('form[data-enquiry]').forEach((form) => {
    const status = form.querySelector('.form-status');
    const btn = form.querySelector('button[type="submit"]');
    const sent = form.nextElementSibling?.matches('[data-sent]') ? form.nextElementSibling : null;
    const errEl = (field) => form.querySelector(`#${field.id}-error`) || field.closest('.field')?.querySelector('.error');
    const showError = (field, msg) => {
      const group = field.type === 'radio' ? form.querySelectorAll(`input[name="${field.name}"]`) : [field];
      group.forEach((f) => f.setAttribute('aria-invalid', msg ? 'true' : 'false'));
      field.closest('.field')?.classList.toggle('has-error', !!msg);
      const err = errEl(field); if (err) err.textContent = msg || '';
    };
    const validate = (field) => {
      if (field.type === 'checkbox') { const ok = field.checked || !field.required; showError(field, ok ? '' : 'Please tick this so we can reply to you.'); return ok; }
      if (field.type === 'radio') { const ok = !!form.querySelector(`input[name="${field.name}"]:checked`); showError(field, ok ? '' : 'Pick the closest option. "Not sure yet" is fine.'); return ok; }
      const v = field.value.trim();
      if (field.required && !v) { showError(field, field.name === 'name' ? 'Please tell us your name.' : 'This field is required.'); return false; }
      if (field.type === 'email' && v && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) { showError(field, 'Please enter a valid email, like name@example.com.'); return false; }
      if (field.type === 'tel' && v) { const digits = v.replace(/\D/g, ''); if (digits.length < 6 || digits.length > 15 || /[^\d\s()+.-]/.test(v)) { showError(field, 'Please check the number: digits only, 6 to 15 of them.'); return false; } }
      showError(field, ''); return true;
    };
    const fields = () => {
      const list = [...form.querySelectorAll('input[name="name"], input[name="email"], input[type="tel"], input[type="checkbox"][required]')];
      const radio = form.querySelector('input[type="radio"][required]');
      if (radio) list.splice(2, 0, radio);
      return list;
    };
    form.querySelectorAll('input, textarea, select').forEach((f) => {
      f.addEventListener('blur', () => { if ((f.value && f.type !== 'radio' && f.type !== 'checkbox') || f.getAttribute('aria-invalid') === 'true') validate(f.type === 'radio' ? form.querySelector(`input[name="${f.name}"]`) : f); });
      f.addEventListener('change', () => { if (f.getAttribute('aria-invalid') === 'true' || f.type === 'radio' || f.type === 'checkbox') validate(f.type === 'radio' ? form.querySelector(`input[name="${f.name}"]`) : f); });
    });
    sent?.querySelector('[data-sent-again]')?.addEventListener('click', () => { form.reset(); fillTz(); sent.hidden = true; form.hidden = false; form.querySelector('input[name="name"]').focus(); });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      status.className = 'form-status'; status.textContent = '';
      const bad = fields().filter((f) => !validate(f));
      if (bad.length) {
        (bad[0].type === 'radio' ? form.querySelector(`input[name="${bad[0].name}"]`) : bad[0]).focus();
        notify(bad.length === 1 ? 'One field needs a quick fix.' : `${bad.length} fields need a quick fix.`, 'error');
        return; // nothing typed is lost
      }
      const key = form.querySelector('[name="access_key"]').value;
      if (key.startsWith('REPLACE')) {
        status.className = 'form-status is-err';
        status.textContent = `The form isn't connected yet, so this wasn't sent. Please email us instead. Your text is still here to copy.`;
        notify('Not sent: the enquiry form isn\'t connected yet.', 'error');
        return;
      }
      const phone = form.querySelector('input[name="phone"]'); const cc = form.querySelector('select[name="phone_country"]');
      const data = new FormData(form);
      if (phone && phone.value.trim() && cc && cc.value !== 'other') data.set('phone', `${cc.value} ${phone.value.trim()}`);
      btn.setAttribute('aria-busy', 'true'); const label = btn.querySelector('.label'); const old = label.textContent; label.textContent = 'Sending…';
      try {
        const res = await fetch(form.action, { method: 'POST', headers: { Accept: 'application/json' }, body: data });
        const out = await res.json().catch(() => ({}));
        if (!(res.ok && out.success !== false)) throw new Error(out.message || 'Send failed');
        const first = (form.querySelector('input[name="name"]').value.trim().split(/\s+/)[0] || '').slice(0, 40);
        form.reset(); fillTz();
        if (sent) {
          const t = sent.querySelector('[data-sent-title]'); t.textContent = first ? `Thanks, ${first}. Your enquiry is in.` : 'Your enquiry is in.';
          form.hidden = true; sent.hidden = false; sent.focus();
        } else { status.className = 'form-status is-ok'; status.textContent = 'Thank you! Your enquiry is in. We reply within one working day (India time).'; }
        notify('Enquiry sent. We\'ll reply within one working day.', 'success');
      } catch (err) {
        status.className = 'form-status is-err';
        status.textContent = 'That didn\'t send, and nothing was lost: your details are still here. Check your connection and try again, or email us.';
        notify('Not sent. Please try again.', 'error');
      } finally {
        btn.removeAttribute('aria-busy'); label.textContent = old;
      }
    });
  });

  /* ---------- Depth: gentle tilt on project cards and the hero phone (mouse only, full motion) ---------- */
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    const tiltable = [...document.querySelectorAll('[data-tilt], .hero-stage')];
    tiltable.forEach((el) => {
      let raf = 0;
      el.addEventListener('pointermove', (e) => {
        if (!motionOk() || prefs.motion === 'calm') return;
        if (raf) return;
        raf = requestAnimationFrame(() => {
          raf = 0;
          const r = el.getBoundingClientRect();
          const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
          const max = el.classList.contains('hero-stage') ? 7 : 4;
          el.style.setProperty('--rx', `${(-y * max).toFixed(2)}deg`);
          el.style.setProperty('--ry', `${(x * max).toFixed(2)}deg`);
          el.classList.add('is-tilting');
        });
      });
      el.addEventListener('pointerleave', () => { el.classList.remove('is-tilting'); el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); });
    });
  }

  /* Images: shimmer until loaded */
  document.querySelectorAll('.media-skel').forEach((box) => {
    const img = box.querySelector('img');
    if (!img) { box.classList.add('is-loaded'); return; }
    const done = () => box.classList.add('is-loaded');
    if (img.complete) done(); else { img.addEventListener('load', done, { once: true }); img.addEventListener('error', done, { once: true }); }
  });

  /* Double-tap (or double-click) to like, like on Instagram */
  const HEART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M19.5 12.6 12 20l-7.5-7.4A5 5 0 1 1 12 6a5 5 0 1 1 7.5 6.6Z"/></svg>';
  const burst = (host, x, y) => {
    if (reduceMotion) return;
    const r = host.getBoundingClientRect();
    const h = document.createElement('span');
    h.className = 'heart-burst'; h.innerHTML = HEART;
    h.style.left = `${x - r.left}px`; h.style.top = `${y - r.top}px`;
    host.appendChild(h);
    h.addEventListener('animationend', () => h.remove());
  };
  document.querySelectorAll('[data-double-tap]').forEach((el) => {
    let last = -1e9, touchBurst = -1e9;
    el.addEventListener('dblclick', (e) => { e.preventDefault(); if (performance.now() - touchBurst > 600) burst(el, e.clientX, e.clientY); });
    el.addEventListener('pointerup', (e) => {
      if (e.pointerType !== 'touch') return;
      const now = performance.now();
      if (now - last < 400) { burst(el, e.clientX, e.clientY); last = -1e9; touchBurst = now; } else last = now;
    });
  });

  /* Magnetic main button (mouse only, motion allowed) */
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    document.querySelectorAll('.magnetic').forEach((btn) => {
      btn.addEventListener('pointermove', (e) => {
        if (!motionOk() || prefs.motion === 'calm') return;
        const r = btn.getBoundingClientRect();
        const dx = (e.clientX - r.left - r.width / 2) / r.width, dy = (e.clientY - r.top - r.height / 2) / r.height;
        btn.style.transform = `translate(${(dx * 10).toFixed(1)}px, ${(dy * 8).toFixed(1)}px)`;
      });
      btn.addEventListener('pointerleave', () => { btn.style.transform = ''; });
    });
  }

  /* Blog: search + "Show more posts" (all cards are in the HTML, so search engines and no-JS visitors see every post) */
  const grid = document.querySelector('[data-blog-grid]');
  if (grid) {
    const cards = [...grid.querySelectorAll('[data-post]')];
    const featured = document.querySelector('.featured-wrap');
    const featuredCard = featured?.querySelector('[data-post]');
    const input = document.querySelector('[data-blog-search]');
    const empty = document.querySelector('[data-blog-empty]');
    const moreWrap = document.querySelector('[data-load-more-wrap]');
    const moreBtn = document.querySelector('[data-load-more]');
    const countEl = document.querySelector('[data-load-count]');
    const per = Number(grid.dataset.perPage) || 9;
    let shown = per, q = '';
    const params = new URLSearchParams(location.search);
    if (input && params.get('q')) { input.value = params.get('q').slice(0, 60); q = input.value.trim().toLowerCase(); }
    const match = (el) => !q || q.split(/\s+/).every((w) => el.dataset.search.includes(w));
    const render = (animateFrom = -1) => {
      const hits = cards.filter(match);
      cards.forEach((c) => { c.hidden = true; c.classList.remove('is-entering'); });
      hits.forEach((c, i) => {
        if (i < shown) {
          c.hidden = false;
          if (i >= animateFrom && animateFrom >= 0 && motionOk()) { c.style.setProperty('--d', `${(i - animateFrom) * 0.05}s`); c.classList.add('is-entering'); c.classList.add('in'); }
        }
      });
      const featuredHit = featuredCard ? match(featuredCard) : false;
      if (featured) featured.hidden = !!q && !featuredHit;
      if (empty) empty.hidden = hits.length > 0 || featuredHit;
      if (moreWrap) moreWrap.hidden = hits.length <= shown;
      if (countEl) countEl.textContent = hits.length > shown ? `Showing ${Math.min(shown, hits.length)} of ${hits.length} posts` : '';
    };
    let timer;
    input?.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        q = input.value.trim().toLowerCase(); shown = per; render();
        const url = new URL(location.href);
        if (q) url.searchParams.set('q', input.value.trim()); else url.searchParams.delete('q');
        history.replaceState(null, '', url);
      }, 140);
    });
    input?.addEventListener('keydown', (e) => { if (e.key === 'Escape' && input.value) { input.value = ''; input.dispatchEvent(new Event('input')); } });
    document.querySelector('[data-blog-clear]')?.addEventListener('click', () => { if (input) { input.value = ''; input.dispatchEvent(new Event('input')); input.focus(); } });
    moreBtn?.addEventListener('click', () => {
      const from = shown; shown += per; render(from);
      const next = cards.filter(match)[from]; next?.querySelector('a')?.focus({ preventScroll: true });
    });
    render();
  }

  /* Copy link */
  document.querySelectorAll('[data-copy-link]').forEach((b) => b.addEventListener('click', async () => {
    const url = b.dataset.copyLink;
    try { await navigator.clipboard.writeText(url); flash('Link copied'); }
    catch (e) { window.prompt('Copy this link:', url); }
  }));

  /* Footer year */
  document.querySelectorAll('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });
})();
