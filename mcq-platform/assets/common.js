// Shared helpers for the student app and the teacher dashboard.
(function () {
  'use strict';

  const APP = window.APP || { csrf: '', settings: {} };

  // Builds DOM nodes without innerHTML, so question text is always shown as plain text.
  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs || {})) {
      if (value === false || value === null || value === undefined) continue;
      if (key === 'class') el.className = value;
      else if (key === 'style' && typeof value === 'object') Object.assign(el.style, value);
      else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2), value);
      else if (key === 'value') el.value = value;
      else if (key === 'checked' || key === 'disabled' || key === 'selected') el[key] = !!value;
      else el.setAttribute(key, value === true ? '' : value);
    }
    append(el, children);
    return el;
  }

  function append(el, children) {
    for (const child of children.flat(Infinity)) {
      if (child === null || child === undefined || child === false) continue;
      el.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
    }
    return el;
  }

  function mount(...children) {
    const app = document.getElementById('app');
    app.className = '';
    app.replaceChildren();
    append(app, children);
    window.scrollTo(0, 0);
  }

  class ApiError extends Error {
    constructor(message, code, status) {
      super(message);
      this.code = code;
      this.status = status;
    }
  }

  async function api(action, body) {
    let res;
    try {
      res = await fetch('api.php?action=' + encodeURIComponent(action), {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-CSRF': APP.csrf },
        body: JSON.stringify(body || {}),
      });
    } catch (e) {
      throw new ApiError('تعذّر الاتصال بالخادم. تأكد من الإنترنت وحاول مرة أخرى.', 'network', 0);
    }
    let data = null;
    try { data = await res.json(); } catch (e) { /* not JSON */ }
    if (!data) throw new ApiError('استجابة غير متوقعة من الخادم.', 'bad_response', res.status);
    if (!data.ok) throw new ApiError(data.error || 'حدث خطأ.', data.code || 'error', res.status);
    return data;
  }

  let toastTimer;
  function toast(message, kind) {
    const el = document.getElementById('toast');
    el.textContent = message;
    el.className = 'show' + (kind === 'bad' ? ' bad' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.className = kind === 'bad' ? 'bad' : ''; }, 3200);
  }

  function currentTheme() {
    const set = document.documentElement.dataset.theme;
    if (set) return set;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  // Line icons (24px grid, drawn with the current text color). Names describe the picture.
  const ICONS = {
    home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    flag: '<path d="M5 22V4"/><path d="M5 4h12l-2 4 2 4H5"/>',
    chart: '<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-6"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    forward: '<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>',
    back: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    up: '<path d="m6 15 6-6 6 6"/>',
    down: '<path d="m6 9 6 6 6-6"/>',
    timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2"/><path d="M10 2h4"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    eyeOff: '<path d="M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3 3.8"/><path d="M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/><path d="m2 2 20 20"/>',
    flame: '<path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-6 0 3 2 4 3 4-1-3-1-7 0-10z"/>',
    star: '<path d="m12 2 3 6.3 6.9.9-5 4.8 1.2 6.9L12 17.6 5.9 20.9 7.1 14l-5-4.8 6.9-.9z"/>',
    book: '<path d="M2 4h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H2z"/><path d="M22 4h-7a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h8z"/>',
    pulse: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    bars: '<path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/>',
    leaf: '<path d="M11 20A7 7 0 0 1 4 13c0-6 7-10 16-10 0 9-4 16-9 17z"/><path d="M4 21c4-4 7-6 11-9"/>',
    globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15 15 0 0 1 0 20"/><path d="M12 2a15 15 0 0 0 0 20"/>',
    flask: '<path d="M9 3h6"/><path d="M10 3v6L4.5 18.5A2 2 0 0 0 6.2 21h11.6a2 2 0 0 0 1.7-2.5L14 9V3"/><path d="M7 15h10"/>',
    heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    marker: '<path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/>',
    strike: '<path d="M4 12h16"/><path d="M8 6.5A4 4 0 0 1 12 5c2.2 0 4 1.3 4 3"/><path d="M16 17.5A4 4 0 0 1 12 19c-2.2 0-4-1.3-4-3"/>',
    chat: '<path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20.5l1.6-5.2A8.5 8.5 0 1 1 21 11.5z"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.9 4.9 1.4 1.4"/><path d="m17.7 17.7 1.4 1.4"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m4.9 19.1 1.4-1.4"/><path d="m17.7 6.3 1.4-1.4"/>',
    target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    hourglass: '<path d="M6 2h12"/><path d="M6 22h12"/><path d="M7 2v4a5 5 0 0 0 10 0V2"/><path d="M7 22v-4a5 5 0 0 1 10 0v4"/>',
    list: '<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>',
    sparkle: '<path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4z"/>',
  };

  // opts.solid fills the shape (a filled flag or flame); opts.stroke sets the line width.
  function icon(name, size, opts) {
    const o = opts || {};
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    const s = String(size || 20);
    svg.setAttribute('width', s);
    svg.setAttribute('height', s);
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', o.solid ? 'currentColor' : 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', String(o.stroke || 2));
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('class', 'icon');
    svg.innerHTML = ICONS[name] || ''; // static path data from the table above, never user input
    return svg;
  }

  function toggleTheme() {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('mcq-theme', next); } catch (e) { /* storage blocked */ }
    return next;
  }

  function themeButton() {
    const btn = h('button', { class: 'btn ghost icon', type: 'button', title: 'الوضع الليلي / النهاري', 'aria-label': 'تبديل الوضع الليلي' });
    const paint = () => { btn.replaceChildren(icon(currentTheme() === 'dark' ? 'sun' : 'moon', 20)); };
    btn.addEventListener('click', () => { toggleTheme(); paint(); });
    paint();
    return btn;
  }

  // The platform's logo when brand files exist (CSS swaps in the dark-mode version),
  // otherwise the first letter of the name.
  function logoMark(size) {
    const B = APP.brand || {};
    if (!B.mark) return h('span', { class: 'brand-mark', 'aria-hidden': 'true' }, (APP.settings.platform_name || 'م').trim().charAt(0));
    return h('span', { class: 'brand-logo', style: { height: (size || 36) + 'px' }, 'aria-hidden': 'true' },
      h('img', { class: 'on-light', src: B.mark, alt: '' }),
      h('img', { class: 'on-dark', src: B.mark_dark || B.mark, alt: '' }));
  }

  function fullLogo() {
    const B = APP.brand || {};
    if (!B.logo) return null;
    return h('div', { class: 'full-logo' },
      h('img', { class: 'on-light', src: B.logo, alt: APP.settings.platform_name }),
      h('img', { class: 'on-dark', src: B.logo_dark || B.logo, alt: '' }));
  }

  function brand(name) {
    const text = (name || APP.settings.platform_name || '').trim();
    return h('div', { class: 'brand' }, logoMark(36), h('span', {}, text));
  }

  // Resolves with true/false (confirm) or the form element (custom content).
  function modal({ title, body, confirmText = 'تأكيد', cancelText = 'إلغاء', danger = false, wide = false, onConfirm }) {
    return new Promise((resolve) => {
      const close = (value) => { backdrop.remove(); document.removeEventListener('keydown', onKey); resolve(value); };
      const onKey = (e) => { if (e.key === 'Escape') close(false); };
      const confirmBtn = h('button', { class: 'btn ' + (danger ? 'danger' : 'primary'), type: 'submit' }, confirmText);
      const form = h('form', { class: 'modal' + (wide ? ' wide' : ''), novalidate: true },
        title ? h('h2', {}, title) : null,
        body,
        h('div', { class: 'modal-actions' },
          cancelText ? h('button', { class: 'btn', type: 'button', onclick: () => close(false) }, cancelText) : null,
          confirmBtn));
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!onConfirm) return close(true);
        confirmBtn.disabled = true;
        try {
          const result = await onConfirm(form);
          if (result !== false) close(result === undefined ? true : result);
        } catch (err) {
          toast(err.message, 'bad');
        } finally {
          confirmBtn.disabled = false;
        }
      });
      const backdrop = h('div', { class: 'modal-backdrop', onclick: (e) => { if (e.target === backdrop) close(false); } }, form);
      document.body.appendChild(backdrop);
      document.addEventListener('keydown', onKey);
      const first = form.querySelector('input, textarea, select');
      if (first) first.focus();
      else confirmBtn.focus({ preventScroll: true }); // long content (e.g. an answer review) stays at its top
    });
  }

  const dateFmt = new Intl.DateTimeFormat('ar-EG-u-nu-latn', { day: 'numeric', month: 'long', year: 'numeric' });
  const dateTimeFmt = new Intl.DateTimeFormat('ar-EG-u-nu-latn', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  const fmtDate = (ts) => (ts ? dateFmt.format(new Date(ts * 1000)) : '—');
  const fmtDateTime = (ts) => (ts ? dateTimeFmt.format(new Date(ts * 1000)) : '—');
  const isoDate = (ts) => {
    const d = new Date(ts * 1000);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };

  // Phone number in the international form wa.me needs. Local Egyptian (01…) and Saudi (05…)
  // mobiles get their country code; anything else is used as written.
  function waNumber(raw) {
    let d = String(raw || '').replace(/[\u0660-\u0669]/g, (c) => String(c.charCodeAt(0) - 0x0660)).replace(/\D/g, '');
    if (d.startsWith('00')) d = d.slice(2);
    if (/^01\d{9}$/.test(d)) d = '2' + d;
    else if (/^05\d{8}$/.test(d)) d = '966' + d.slice(1);
    return d.length >= 10 ? d : '';
  }

  function waLink(raw, text) {
    const num = waNumber(raw);
    return num ? 'https://wa.me/' + num + (text ? '?text=' + encodeURIComponent(text) : '') : null;
  }

  function whatsappLink(text) {
    return waLink(APP.settings.contact_whatsapp, text);
  }

  const LETTERS_AR = ['أ', 'ب', 'ج', 'د', 'هـ', 'و', 'ز', 'ح', 'ط', 'ي'];
  const LETTERS_EN = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
  // English letters for English questions, Arabic letters for Arabic ones.
  function optionLetter(i, sample) {
    return /[؀-ۿ]/.test(sample || '') ? LETTERS_AR[i] : LETTERS_EN[i];
  }

  const mediaUrl = (name) => 'media.php?f=' + encodeURIComponent(name);

  // Full-size view of an image; closes on click, tap or Escape.
  function lightbox(src) {
    const close = () => { box.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    const box = h('div', { class: 'lightbox', role: 'dialog', 'aria-label': 'عرض الصورة', onclick: close },
      h('img', { src, alt: '' }),
      h('button', { class: 'btn', type: 'button', 'aria-label': 'إغلاق' }, '✕'));
    document.body.appendChild(box);
    document.addEventListener('keydown', onKey);
  }

  function questionImage(name) {
    if (!name) return null;
    const src = mediaUrl(name);
    return h('button', { type: 'button', class: 'q-img', title: 'اضغط لتكبير الصورة', onclick: () => lightbox(src) },
      h('img', { src, alt: 'صورة السؤال', loading: 'lazy', draggable: 'false' }));
  }

  // English questions read left-to-right, Arabic ones right-to-left.
  function textDir(text) {
    return /[\u0600-\u06FF]/.test(text || '') ? 'rtl' : 'ltr';
  }

  function confetti() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const canvas = h('canvas', { class: 'confetti' });
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    ctx.scale(dpr, dpr);
    const colors = ['#3b5bdb', '#14915a', '#f59f00', '#e64980', '#15aabf', '#ffd43b'];
    const pieces = Array.from({ length: 160 }, () => ({
      x: innerWidth / 2 + (Math.random() - 0.5) * 120,
      y: innerHeight * 0.35,
      vx: (Math.random() - 0.5) * 14,
      vy: -Math.random() * 14 - 4,
      size: 6 + Math.random() * 6,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));
    const start = performance.now();
    (function frame(now) {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      for (const p of pieces) {
        p.vy += 0.35;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size / 1.6);
        ctx.restore();
      }
      if (now - start < 3500) requestAnimationFrame(frame);
      else canvas.remove();
    })(start);
  }

  function randomPassword(len = 8) {
    const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
    const bytes = crypto.getRandomValues(new Uint8Array(len));
    return Array.from(bytes, (b) => chars[b % chars.length]).join('');
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      toast('تم النسخ');
    } catch (e) {
      window.prompt('انسخ النص:', text);
    }
  }

  window.UI = {
    APP, h, append, mount, api, ApiError, toast, themeButton, toggleTheme, currentTheme, icon, logoMark, fullLogo, brand, modal,
    fmtDate, fmtDateTime, isoDate, whatsappLink, waNumber, waLink, optionLetter, textDir, confetti, mediaUrl, lightbox, questionImage, randomPassword, copyText,
  };
})();
