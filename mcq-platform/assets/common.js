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

  function themeButton() {
    const btn = h('button', { class: 'btn ghost icon', type: 'button', title: 'الوضع الليلي / النهاري', 'aria-label': 'تبديل الوضع الليلي' });
    const paint = () => { btn.textContent = currentTheme() === 'dark' ? '☀️' : '🌙'; };
    btn.addEventListener('click', () => {
      const next = currentTheme() === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem('mcq-theme', next); } catch (e) { /* storage blocked */ }
      paint();
    });
    paint();
    return btn;
  }

  function brand(name) {
    const text = (name || APP.settings.platform_name || '').trim();
    return h('div', { class: 'brand' }, h('span', { class: 'brand-mark', 'aria-hidden': 'true' }, text.charAt(0) || 'م'), h('span', {}, text));
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

  function whatsappLink(text) {
    const num = (APP.settings.contact_whatsapp || '').replace(/\D/g, '');
    if (!num) return null;
    return 'https://wa.me/' + num + (text ? '?text=' + encodeURIComponent(text) : '');
  }

  const LETTERS_AR = ['أ', 'ب', 'ج', 'د', 'هـ', 'و', 'ز', 'ح', 'ط', 'ي'];
  const LETTERS_EN = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
  // English letters for English questions, Arabic letters for Arabic ones.
  function optionLetter(i, sample) {
    return /[؀-ۿ]/.test(sample || '') ? LETTERS_AR[i] : LETTERS_EN[i];
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
    APP, h, append, mount, api, ApiError, toast, themeButton, brand, modal,
    fmtDate, fmtDateTime, isoDate, whatsappLink, optionLetter, textDir, confetti, randomPassword, copyText,
  };
})();
