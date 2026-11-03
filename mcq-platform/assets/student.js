// Student app: login, home (daily goal, streak, mock exam, quiz tiles), question player with
// flag / highlight / strike-out, timed mock exam, results with scores per file, flagged
// questions, progress and account pages.
(function () {
  'use strict';

  const { APP, h, mount, api, toast, themeButton, toggleTheme, currentTheme, icon, logoMark, fullLogo, modal, fmtDate, whatsappLink, optionLetter, textDir, confetti } = window.UI;
  const S = APP.settings;
  let me = null;
  let daily = null;       // today's goal, streak and week, refreshed by the home page and every answer
  let flagsCount = 0;
  let reviewQuizId = 0;

  // ---------- Errors that end the session ----------

  function handleError(err) {
    if (err.code === 'auth' || err.code === 'other_device' || err.code === 'csrf') {
      me = null;
      if (err.code === 'csrf') location.reload();
      else showLogin(err.code === 'other_device' ? err.message : '');
      return true;
    }
    if (err.code === 'expired' || err.code === 'suspended') {
      showBlocked(err.code, err.message);
      return true;
    }
    toast(err.message, 'bad');
    return false;
  }

  async function call(action, body) {
    try {
      return await api(action, body);
    } catch (err) {
      handleError(err);
      throw err;
    }
  }

  // ---------- Login and blocked screens ----------

  function authPage(...content) {
    document.body.classList.remove('has-tabbar');
    mount(h('div', { class: 'auth' }, content));
  }

  function showLogin(notice) {
    stopMockTimer();
    const error = h('div', { class: 'alert bad hidden', role: 'alert' });
    const user = h('input', { class: 'input', id: 'login-user', name: 'username', autocomplete: 'username', required: true, dir: 'ltr' });
    const pass = h('input', { class: 'input', id: 'login-pass', name: 'password', type: 'password', autocomplete: 'current-password', required: true, dir: 'ltr' });
    const submit = h('button', { class: 'btn primary block lg', type: 'submit' }, 'دخول');
    const form = h('form', {
      onsubmit: async (e) => {
        e.preventDefault();
        error.classList.add('hidden');
        submit.disabled = true;
        try {
          const res = await api('student.login', { username: user.value, password: pass.value });
          me = res.me;
          showHome();
        } catch (err) {
          if (err.code === 'expired' || err.code === 'suspended') return showBlocked(err.code, err.message);
          error.textContent = err.message;
          error.classList.remove('hidden');
        } finally {
          submit.disabled = false;
        }
      },
    },
      notice ? h('div', { class: 'alert warn' }, notice) : null,
      error,
      h('label', { class: 'field', for: 'login-user' }, h('span', {}, 'اسم المستخدم أو رقم الموبايل'), user),
      h('label', { class: 'field', for: 'login-pass' }, h('span', {}, 'كلمة المرور'), pass),
      submit);
    const logo = fullLogo();
    authPage(h('div', { class: 'card' },
      logo || logoMark(56),
      h('h1', { class: logo ? 'sr-only' : '' }, S.platform_name),
      h('p', { class: 'lead' }, 'سجّل الدخول وابدأ حل الأسئلة'),
      form,
      h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '14px' } }, themeButton())));
    user.focus();
  }

  function showBlocked(code, message) {
    stopMockTimer();
    const expired = code === 'expired';
    const wa = whatsappLink(expired ? 'مرحباً، أريد تجديد اشتراكي في ' + S.platform_name : 'مرحباً، حسابي موقوف في ' + S.platform_name);
    authPage(
      h('div', { class: 'card blocked' },
        h('div', { class: 'icon-circle' }, icon(expired ? 'hourglass' : 'lock', 32)),
        h('h1', {}, expired ? 'انتهى الاشتراك' : 'الحساب موقوف'),
        h('p', { class: 'muted' }, message),
        wa ? h('a', { class: 'btn good block lg', href: wa, target: '_blank', rel: 'noopener' }, icon('chat', 20), 'تواصل عبر واتساب للتجديد') : null,
        h('button', { class: 'btn ghost block', style: { marginTop: '10px' }, onclick: () => logout() }, 'تسجيل الدخول بحساب آخر')),
      servicesCard());
  }

  async function logout() {
    try { await api('student.logout'); } catch (e) { /* already out */ }
    me = null;
    showLogin('');
  }

  // ---------- Shell: header, tab bar ----------

  const NAV = [
    ['home', 'الرئيسية', 'home', () => showHome()],
    ['flags', 'المعلّمة', 'flag', () => showFlags()],
    ['progress', 'تقدمي', 'chart', () => showProgress()],
    ['account', 'حسابي', 'user', () => showAccount()],
  ];

  function streakChip() {
    if (!daily) return null;
    return h('button', {
      class: 'streak-chip' + (daily.streak ? '' : ' cold'), type: 'button',
      title: 'أيام متتالية حققت فيها هدفك', 'aria-label': daily.streak + ' أيام متتالية', onclick: () => showHome(),
    }, icon('flame', 18, { solid: true }), daily.streak);
  }

  function header(active) {
    return h('header', { class: 'app-header' },
      h('div', { class: 'wrap' },
        h('button', { class: 'brand', type: 'button', style: { background: 'none', border: 0, cursor: 'pointer', padding: 0 }, onclick: () => showHome() },
          logoMark(38), h('span', {}, S.platform_name)),
        h('nav', { class: 'head-nav', 'aria-label': 'التنقل' }, NAV.map(([key, label, ic, go]) =>
          h('button', { type: 'button', class: key === active ? 'active' : '', onclick: go }, icon(ic, 18), label))),
        streakChip(),
        themeButton()));
  }

  function tabbar(active) {
    return h('nav', { class: 'tabbar', 'aria-label': 'التنقل' }, NAV.map(([key, label, ic, go]) =>
      h('button', { type: 'button', class: key === active ? 'active' : '', 'aria-current': key === active ? 'page' : false, onclick: go },
        icon(ic, 22), label,
        key === 'flags' && flagsCount ? h('span', { class: 'tab-count' }, flagsCount) : null)));
  }

  function page(active, ...content) {
    document.body.classList.add('has-tabbar');
    mount(header(active), h('main', {}, h('div', { class: 'wrap' }, content)), tabbar(active));
  }

  // Question screens hide the navigation so the student can focus.
  function focusPage(keepScroll, ...content) {
    const y = window.scrollY;
    document.body.classList.remove('has-tabbar');
    mount(h('main', { class: 'player' }, h('div', { class: 'wrap narrow' }, content)));
    if (keepScroll) window.scrollTo(0, y);
  }

  function loading(active) {
    page(active, h('div', { class: 'boot', style: { minHeight: '50vh' } }, h('div', { class: 'spinner' })));
  }

  function ringSvg(fraction, size, stroke, trackClass, fillClass) {
    const r = (size - stroke) / 2;
    const circ = 2 * Math.PI * r;
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + size + ' ' + size);
    svg.setAttribute('aria-hidden', 'true');
    const mk = (cls, dash) => {
      const c = document.createElementNS(svgNS, 'circle');
      c.setAttribute('cx', size / 2); c.setAttribute('cy', size / 2); c.setAttribute('r', r);
      c.setAttribute('fill', 'none'); c.setAttribute('stroke-width', stroke); c.setAttribute('stroke-linecap', 'round');
      c.setAttribute('class', cls);
      if (dash !== undefined) c.setAttribute('stroke-dasharray', dash + ' ' + circ);
      return c;
    };
    svg.append(mk(trackClass), mk(fillClass, Math.max(0, Math.min(1, fraction)) * circ));
    return svg;
  }

  // ---------- Home ----------

  const TILE_COLORS = ['t-blue', 't-green', 't-gold', 't-coral', 't-violet', 't-teal'];
  const TILE_ICONS = ['pulse', 'bars', 'leaf', 'globe', 'flask', 'heart'];
  const DAY_NAMES = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];

  async function showHome() {
    stopMockTimer();
    attempt = null;
    loading('home');
    let data;
    try { data = await call('student.quizzes'); } catch (e) { return; }
    me = data.me;
    daily = data.daily;
    flagsCount = data.flags;
    reviewQuizId = data.review_quiz_id;
    const first = me.name.trim().split(/\s+/)[0];
    const greeting = new Date().getHours() < 12 ? 'صباح الخير' : 'مساء الخير';
    const open = data.quizzes.find((q) => q.stats && q.stats.open && q.stats.open.answered > 0);

    page('home',
      h('div', { class: 'greet' },
        h('div', { class: 'spacer' }, h('h1', {}, greeting + '، ' + first), h('div', { class: 'sub' }, 'جاهز تكمل مذاكرتك النهارده؟')),
        subscriptionChip(me.subscription)),
      h('div', { class: 'home-grid' },
        goalCard(),
        data.mock && data.mock.available ? mockHero(data.mock) : null,
        open ? resumeCard(open) : null,
        flagsCount ? flagCard() : null),
      h('div', { class: 'section-head' }, h('h2', {}, 'اختباراتك'), h('span', { class: 'muted small' }, data.quizzes.length + ' ملف')),
      data.quizzes.length
        ? h('div', { class: 'tiles' }, data.quizzes.map(quizTile))
        : h('div', { class: 'card empty' }, h('div', { class: 'big' }, icon('book', 28)), h('p', {}, 'لا توجد اختبارات متاحة حالياً. ستظهر هنا فور إضافتها.')),
      servicesCard());
  }

  function subscriptionChip(sub) {
    if (!sub || sub.expires_at === null) return null;
    const ending = sub.state === 'ending';
    return h('span', { class: 'sub-chip' + (ending ? ' ending' : ''), title: 'ينتهي في ' + fmtDate(sub.expires_at) },
      h('span', { class: 'dot' }), ending ? 'اشتراكك قارب على الانتهاء · ' + sub.days_left + ' يوم' : 'اشتراكك ساري · ' + sub.days_left + ' يوم');
  }

  function goalCard() {
    if (!daily) return null;
    const done = daily.today >= daily.goal;
    const todayKey = daily.week[daily.week.length - 1].day;
    return h('section', { class: 'card goal-card' },
      h('div', { class: 'goal-top' },
        h('div', { class: 'goal-ring' }, ringSvg(daily.today / daily.goal, 84, 10, 'track', 'fill'),
          h('span', { class: 'val' }, Math.min(daily.today, 999) + '/' + daily.goal)),
        h('div', {},
          h('h2', {}, 'هدف اليوم'),
          h('p', {}, done ? 'أحسنت! حققت هدف اليوم' : 'باقي ' + (daily.goal - daily.today) + ' سؤال وتحقق هدفك'))),
      h('div', { class: 'week', 'aria-label': 'آخر 7 أيام' }, daily.week.map((d) => {
        const isToday = d.day === todayKey;
        const name = isToday ? 'اليوم' : DAY_NAMES[new Date(d.day + 'T12:00:00').getDay()];
        return h('div', { class: 'day' + (d.met ? ' met' : '') + (isToday ? ' today' : ''), title: d.answered + ' سؤال' },
          h('span', { class: 'dot' }, d.met ? icon('check', 14, { stroke: 3.5 }) : null), name);
      })),
      h('div', { class: 'goal-foot' },
        h('span', { class: 'row', style: { gap: '6px' } }, h('span', { style: { color: 'var(--gold)' } }, icon('flame', 18, { solid: true })),
          daily.streak ? 'سلسلة ' + daily.streak + ' يوم متتالي' : 'حقق هدفك اليوم لتبدأ سلسلتك'),
        h('button', { class: 'btn ghost sm', type: 'button', onclick: () => showAccount() }, 'تغيير الهدف')));
  }

  function secondsLabel(sec) {
    if (sec === 60) return 'دقيقة';
    if (sec % 60 === 0) return (sec / 60) + ' دقائق';
    return sec + ' ثانية';
  }

  function mockHero(m) {
    const st = m.stats || {};
    const open = st.open && st.open.answered > 0 ? st.open : null;
    const start = async () => {
      const ok = await modal({
        title: m.title,
        body: h('ul', { class: 'rules' },
          h('li', {}, m.size + ' سؤال من كل الملفات (' + m.quizzes + ' ملف) بالتساوي، وأسئلة مختلفة في كل مرة.'),
          h('li', {}, 'لكل سؤال ' + secondsLabel(m.seconds) + '. عند انتهاء الوقت ينتقل الاختبار للسؤال التالي تلقائياً.'),
          h('li', {}, 'يمكنك تخطي السؤال، لكن لا يمكن الرجوع لسؤال سابق.'),
          h('li', {}, 'يمكنك الخروج والعودة لاستكمال الاختبار لاحقاً.'),
          open ? h('li', { class: 'warn-text' }, 'لديك اختبار تجريبي لم يكتمل، وبدء اختبار جديد سيلغيه.') : null),
        confirmText: 'ابدأ الآن',
      });
      if (ok) startQuiz(m.quiz_id, 'new');
    };
    return h('section', { class: 'hero' },
      h('span', { class: 'star' }, icon('star', 22, { solid: true })),
      h('span', { class: 'pill' }, icon('timer', 14), 'بوقت محدد'),
      h('h2', {}, m.title),
      h('p', {}, m.size + ' سؤال من كل الملفات · ' + secondsLabel(m.seconds) + ' لكل سؤال · أسئلة جديدة عليك في كل مرة'),
      open ? h('p', {}, 'وصلت للسؤال ' + open.answered + ' من ' + open.total) : null,
      h('div', { class: 'hero-row' },
        open
          ? h('button', { class: 'btn light lg', onclick: () => startQuiz(m.quiz_id, 'resume') }, 'أكمل الاختبار', icon('forward', 18))
          : h('button', { class: 'btn light lg', onclick: start }, 'ابدأ الاختبار', icon('forward', 18)),
        open ? h('button', { class: 'btn ghost', style: { color: '#fff' }, onclick: start }, 'ابدأ جديد') : null,
        st.last ? h('div', { class: 'last' }, h('b', {}, st.last.pct + '%'), h('span', {}, 'آخر نتيجة')) : null));
  }

  function resumeCard(q) {
    const o = q.stats.open;
    return h('section', { class: 'card resume-card' },
      h('div', { class: 'mini-ring' }, ringSvg(o.answered / o.total, 52, 6, 'goal-track', 'goal-fill-blue'),
        h('span', {}, Math.round(o.answered / o.total * 100) + '%')),
      h('div', { class: 'meta' },
        h('span', { class: 'small muted' }, 'تابع من حيث توقفت'),
        h('b', { dir: 'auto' }, q.title),
        h('span', { class: 'small muted' }, 'السؤال ' + (o.answered + 1 > o.total ? o.total : o.answered + 1) + ' من ' + o.total)),
      h('button', { class: 'btn primary icon', 'aria-label': 'أكمل الحل', onclick: () => startQuiz(q.id, 'resume') }, icon('forward', 20)));
  }

  function flagCard() {
    return h('section', { class: 'card flag-card' },
      h('span', { class: 'ico' }, icon('flag', 22, { solid: true })),
      h('div', { class: 'meta' },
        h('b', {}, 'عندك ' + flagsCount + ' سؤال معلّم للمراجعة'),
        h('div', { class: 'small muted' }, 'الأسئلة اللي علّمتها أثناء الحل')),
      h('button', { class: 'btn primary sm', onclick: () => startQuiz(reviewQuizId, 'new') }, 'تدرّب عليها'));
  }

  function quizTile(q, i) {
    const st = q.stats || {};
    const open = st.open && st.open.answered > 0 ? st.open : null;
    const bar = open ? open.answered / open.total * 100 : (st.best || 0);
    const foot = open
      ? ['أكمل · ' + open.answered + ' من ' + open.total, '']
      : st.best !== undefined && st.best !== null ? ['أفضل نتيجة ' + st.best + '%', q.total + ' سؤال'] : ['جديد', q.total + ' سؤال'];
    return h('button', { class: 'tile ' + TILE_COLORS[i % TILE_COLORS.length], type: 'button', onclick: () => quizSheet(q) },
      h('span', { class: 'ico' }, icon(TILE_ICONS[i % TILE_ICONS.length], 22, { stroke: 2.4 })),
      h('b', { dir: 'auto' }, q.title),
      h('span', { class: 'bar' }, h('i', { style: { width: bar + '%' } })),
      h('span', { class: 'foot' }, h('span', {}, foot[0]), h('span', {}, foot[1])));
  }

  function quizSheet(q) {
    const st = q.stats || {};
    const open = st.open && st.open.answered > 0 ? st.open : null;
    const go = (fn) => () => { document.querySelector('.modal-backdrop')?.remove(); fn(); };
    const actions = [];
    if (open) {
      actions.push(h('button', { class: 'btn primary block lg', type: 'button', onclick: go(() => startQuiz(q.id, 'resume')) }, 'أكمل الحل (' + open.answered + ' من ' + open.total + ')'));
      actions.push(h('button', { class: 'btn block', type: 'button', onclick: go(() => startQuiz(q.id, 'new')) }, 'ابدأ من جديد'));
    } else {
      actions.push(h('button', { class: 'btn primary block lg', type: 'button', onclick: go(() => startQuiz(q.id, 'new')) }, st.last ? 'أعد الاختبار' : 'ابدأ الاختبار'));
    }
    if (st.last) {
      if (st.last.correct < st.last.total) actions.push(h('button', { class: 'btn block', type: 'button', onclick: go(() => startQuiz(q.id, 'wrong')) }, 'حل أخطائي فقط (' + (st.last.total - st.last.correct) + ')'));
      actions.push(h('button', { class: 'btn ghost block', type: 'button', onclick: go(() => reviewAttempt(st.last.id)) }, 'مراجعة آخر محاولة'));
    }
    modal({
      title: q.title,
      body: h('div', { class: 'stack' },
        h('div', { class: 'row' },
          h('span', { class: 'badge info' }, q.total + ' سؤال'),
          st.finished ? h('span', { class: 'badge' }, st.finished + ' محاولة') : null,
          st.best !== undefined && st.best !== null ? h('span', { class: 'badge ' + (st.best >= 50 ? 'good' : 'bad') }, 'أفضل نتيجة ' + st.best + '%') : null),
        q.description ? h('p', { class: 'muted', dir: 'auto', style: { margin: 0 } }, q.description) : null,
        h('div', { class: 'sheet-actions' }, actions)),
      confirmText: 'إغلاق',
      cancelText: null,
    });
  }

  // The teacher's "other services" card, set in the dashboard settings.
  function servicesCard() {
    if (!S.services_enabled) return null;
    const items = (S.services_text || '').split('\n').map((t) => t.trim()).filter(Boolean);
    const wa = UI.waLink(S.services_whatsapp, 'مرحباً، أريد الاستفسار عن ' + (S.services_title || 'خدماتكم الإضافية'));
    if (!items.length && !wa) return null;
    return h('section', { class: 'card services-card', style: { marginTop: '24px' } },
      h('h2', {}, icon('sparkle', 20, { solid: true }), S.services_title),
      items.length ? h('ul', { class: 'services-list' }, items.map((t) => h('li', { dir: 'auto' }, t))) : null,
      wa ? h('a', { class: 'btn good', href: wa, target: '_blank', rel: 'noopener' }, icon('chat', 18), 'تواصل عبر واتساب ', h('bdi', { dir: 'ltr' }, S.services_whatsapp)) : null);
  }

  // ---------- Question tools: flag, highlight, strike-out ----------

  const highlights = new Map(); // question id -> [[start, end], ...] character ranges of the question text
  const struck = new Map();     // question id -> Set of option indexes ruled out

  function renderQText(q, el) {
    const box = el || h('div', { class: 'q-text', dir: textDir(q.text) });
    const ranges = highlights.get(q.id) || [];
    const parts = [];
    let pos = 0;
    ranges.forEach(([s, e]) => {
      if (s > pos) parts.push(document.createTextNode(q.text.slice(pos, s)));
      parts.push(h('mark', { title: 'اضغط لإزالة التظليل', onclick: () => {
        highlights.set(q.id, (highlights.get(q.id) || []).filter((r) => r[0] !== s || r[1] !== e));
        renderQText(q, box);
      } }, q.text.slice(s, e)));
      pos = e;
    });
    parts.push(document.createTextNode(q.text.slice(pos)));
    box.replaceChildren(...parts);
    return box;
  }

  // Highlights the current text selection inside the question. Returns true when it did.
  function highlightSelection(q, box) {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || sel.isCollapsed) return false;
    const r = sel.getRangeAt(0);
    if (!box.contains(r.startContainer) || !box.contains(r.endContainer)) return false;
    const before = document.createRange();
    before.selectNodeContents(box);
    before.setEnd(r.startContainer, r.startOffset);
    const s = before.toString().length;
    const e = s + r.toString().length;
    if (e <= s) return false;
    const merged = [];
    (highlights.get(q.id) || []).concat([[s, e]]).sort((a, b) => a[0] - b[0]).forEach((rg) => {
      const last = merged[merged.length - 1];
      if (last && rg[0] <= last[1]) last[1] = Math.max(last[1], rg[1]); else merged.push([rg[0], rg[1]]);
    });
    highlights.set(q.id, merged);
    sel.removeAllRanges();
    renderQText(q, box);
    return true;
  }

  // Question text plus a small toolbar. With a mouse, dragging over words highlights them at once;
  // on a phone, select the words and tap "تظليل".
  function questionBlock(q) {
    const box = renderQText(q);
    box.addEventListener('mouseup', () => highlightSelection(q, box));
    const tools = h('div', { class: 'q-tools' },
      h('button', {
        class: 'btn sm', type: 'button',
        onpointerdown: (e) => { e.preventDefault(); if (!highlightSelection(q, box)) toast('حدّد كلمات من نص السؤال أولاً'); },
      }, icon('marker', 16), 'تظليل'),
      h('button', { class: 'btn sm ghost', type: 'button', onclick: () => { highlights.delete(q.id); renderQText(q, box); } }, 'مسح التظليل'),
      h('span', { class: 'hide-sm' }, 'حدّد كلمات من السؤال لتظليلها'));
    return [box, tools];
  }

  function strikeButton(q, i, rerender) {
    const set = struck.get(q.id) || new Set();
    const on = set.has(i);
    return h('button', {
      class: 'strike-btn' + (on ? ' on' : ''), type: 'button',
      'aria-pressed': on ? 'true' : 'false', 'aria-label': on ? 'إرجاع الاختيار' : 'استبعاد الاختيار', title: on ? 'إرجاع الاختيار' : 'استبعاد الاختيار',
      onclick: () => {
        const next = new Set(set);
        if (on) next.delete(i); else next.add(i);
        struck.set(q.id, next);
        rerender();
      },
    }, icon(on ? 'refresh' : 'strike', 18));
  }

  function flagButton(q, rerender) {
    return h('button', {
      class: 'btn icon flag-btn' + (q.flagged ? ' on' : ''), type: 'button',
      'aria-pressed': q.flagged ? 'true' : 'false', 'aria-label': q.flagged ? 'إزالة التعليم' : 'علّم السؤال للمراجعة',
      title: q.flagged ? 'إزالة التعليم' : 'علّم السؤال للمراجعة',
      onclick: async () => {
        try {
          const res = await call('student.flag', { question_id: q.id, flagged: !q.flagged });
          q.flagged = res.flagged;
          flagsCount = Math.max(0, flagsCount + (res.flagged ? 1 : -1));
          toast(res.flagged ? 'تم تعليم السؤال، وستجده في "المعلّمة"' : 'أُزيل التعليم');
          rerender();
        } catch (e) { /* shown */ }
      },
    }, icon('flag', 20, { solid: q.flagged }));
  }

  function noteDaily(res) {
    if (!res || !res.daily) return;
    daily = Object.assign({}, daily || {}, res.daily);
    if (res.daily.reached_now) {
      toast('أحسنت! حققت هدف اليوم · سلسلتك ' + res.daily.streak + ' يوم');
      confetti();
    }
  }

  // ---------- Quiz player (study mode: instant answers) ----------

  let attempt = null;
  let index = 0;

  async function startQuiz(quizId, mode) {
    let res;
    try { res = await call('student.start', { quiz_id: quizId, mode }); } catch (e) { return; }
    attempt = res.attempt;
    if (mode === 'wrong') toast('هذه المحاولة فيها الأسئلة اللي أخطأت فيها فقط');
    const firstOpen = attempt.questions.findIndex((q) => q.chosen === undefined && !q.skipped);
    if (attempt.mode === 'mock') {
      if (firstOpen === -1) return finishMock();
      index = firstOpen;
      return renderMock(true);
    }
    index = firstOpen === -1 ? 0 : firstOpen;
    renderPlayer();
  }

  async function reviewAttempt(attemptId) {
    try {
      const res = await call('student.attempt', { attempt_id: attemptId });
      showResults(res.attempt, false);
    } catch (e) { /* handled */ }
  }

  function counts(a) {
    let correct = 0, wrong = 0;
    for (const q of a.questions) {
      if (q.chosen === undefined) continue;
      if (q.chosen === q.correct_index) correct++; else wrong++;
    }
    return { correct, wrong, answered: correct + wrong, total: a.questions.length };
  }

  function questionState(q) {
    if (q.chosen === undefined) return '';
    return q.chosen === q.correct_index ? 'correct' : 'wrong';
  }

  function focusHead(exitLabel, onExit, progressText, sideText, fraction, extra) {
    return h('div', { class: 'focus-head' },
      h('button', { class: 'btn icon', type: 'button', 'aria-label': exitLabel, title: exitLabel, onclick: onExit }, icon('x', 20)),
      h('div', { class: 'prog' },
        h('div', { class: 'line' }, h('b', {}, progressText), h('span', { class: 'muted' }, sideText)),
        h('div', { class: 'progress' }, h('i', { style: { width: Math.round(fraction * 100) + '%' } }))),
      extra);
  }

  function renderPlayer(popIndex, keepScroll) {
    const q = attempt.questions[index];
    const c = counts(attempt);
    const state = questionState(q);
    const answered = q.chosen !== undefined;
    const isLast = index === attempt.questions.length - 1;
    const out = struck.get(q.id) || new Set();
    const again = () => renderPlayer(undefined, true);

    const options = q.options.map((text, i) => {
      let cls = 'option';
      let mark = null;
      if (answered) {
        if (i === q.correct_index) { cls += ' correct'; mark = icon('check', 20, { stroke: 3 }); }
        else if (i === q.chosen) { cls += ' wrong'; mark = icon('x', 20, { stroke: 3 }); }
        else cls += ' dim';
        if (i === popIndex) cls += ' pop';
      } else if (out.has(i)) cls += ' struck';
      const btn = h('button', { class: cls, type: 'button', disabled: answered, onclick: () => choose(i) },
        h('span', { class: 'letter' }, optionLetter(i, q.text)),
        h('span', { class: 'otext', dir: 'auto' }, text),
        mark ? h('span', { class: 'mark' }, mark) : null);
      return answered ? btn : h('div', { class: 'opt-wrap' }, btn, strikeButton(q, i, again));
    });

    const feedback = answered ? h('div', { class: 'feedback ' + (state === 'correct' ? 'good' : 'bad'), id: 'feedback' },
      h('div', { class: 'verdict' }, icon(state === 'correct' ? 'check' : 'x', 20, { stroke: 3 }), state === 'correct' ? 'إجابة صحيحة، أحسنت!' : 'إجابة خاطئة'),
      state === 'wrong' ? h('div', {}, 'الإجابة الصحيحة: ',
        h('b', {}, h('bdi', { dir: textDir(q.text) }, optionLetter(q.correct_index, q.text) + ') ' + q.options[q.correct_index]))) : null,
      q.explanation ? h('div', { class: 'explain', dir: 'auto' }, q.explanation) : null) : null;

    const questionNav = h('div', { class: 'navigator', 'aria-label': 'قائمة الأسئلة' },
      attempt.questions.map((item, i) => h('button', {
        type: 'button',
        class: [questionState(item), i === index ? 'current' : '', item.flagged ? 'flagged' : ''].join(' ').trim(),
        'aria-label': 'السؤال ' + (i + 1) + (item.flagged ? '، معلّم' : ''),
        onclick: () => { index = i; renderPlayer(); },
      }, i + 1)));

    focusPage(keepScroll,
      focusHead('رجوع للرئيسية', () => showHome(), 'السؤال ' + (index + 1) + ' من ' + c.total,
        c.correct + ' صحيحة · ' + c.wrong + ' خاطئة', c.answered / c.total, flagButton(q, again)),
      h('section', { class: 'q-card' + (state ? ' is-' + state : '') },
        h('div', { class: 'q-num' },
          h('span', { dir: 'auto' }, q.source || attempt.title),
          state ? h('span', { class: 'badge ' + (state === 'correct' ? 'good' : 'bad') }, state === 'correct' ? 'صحيح' : 'خطأ') : null),
        questionBlock(q),
        UI.questionImage(q.image),
        h('div', { class: 'options', dir: textDir(q.text) }, options),
        feedback),
      h('div', { class: 'player-nav' },
        h('button', { class: 'btn', disabled: index === 0, onclick: () => { index--; renderPlayer(); } }, 'السابق'),
        h('span', { class: 'spacer hide-sm' }),
        isLast
          ? h('button', { class: 'btn primary', onclick: finish }, 'إنهاء وعرض النتيجة')
          : h('button', { class: 'btn ' + (answered ? 'primary' : ''), onclick: () => { index++; renderPlayer(); } }, answered ? 'السؤال التالي' : 'تخطّي')),
      questionNav,
      !isLast && c.answered === c.total ? h('div', { style: { marginTop: '16px' } }, h('button', { class: 'btn primary block lg', onclick: finish }, 'أنهيت كل الأسئلة · اعرض النتيجة')) : null);

    if (popIndex !== undefined) {
      const fb = document.getElementById('feedback');
      if (fb && fb.getBoundingClientRect().bottom > innerHeight) fb.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }

  let busy = false;
  async function choose(i) {
    const q = attempt.questions[index];
    if (busy || q.chosen !== undefined) return;
    busy = true;
    document.querySelectorAll('.option').forEach((b) => { b.disabled = true; });
    try {
      const res = await call('student.answer', { attempt_id: attempt.id, question_id: q.id, choice: i });
      q.chosen = res.chosen;
      q.correct_index = res.correct_index;
      q.explanation = res.explanation;
      if (navigator.vibrate && !res.correct) navigator.vibrate(120);
      renderPlayer(res.chosen, true);
      noteDaily(res);
    } catch (e) {
      document.querySelectorAll('.option').forEach((b) => { b.disabled = false; });
    } finally {
      busy = false;
    }
  }

  async function finish() {
    const c = counts(attempt);
    if (c.answered < c.total) {
      const ok = await modal({
        title: 'إنهاء الاختبار؟',
        body: h('p', {}, 'لم تُجب على ' + (c.total - c.answered) + ' سؤال. ستُحسب كإجابات غير محلولة.'),
        confirmText: 'إنهاء الآن',
        cancelText: 'أكمل الحل',
      });
      if (!ok) return;
    }
    try {
      const res = await call('student.finish', { attempt_id: attempt.id });
      showResults(res.attempt, true);
    } catch (e) { /* handled */ }
  }

  // Keyboard: 1-9 or A-J picks an option, arrows move between questions.
  document.addEventListener('keydown', (e) => {
    if (!attempt || !document.querySelector('.q-card') || e.target.closest('input, textarea') || document.querySelector('.modal-backdrop')) return;
    if (attempt.mode === 'mock') return mockKey(e);
    const q = attempt.questions[index];
    let pick = -1;
    if (/^[1-9]$/.test(e.key)) pick = Number(e.key) - 1;
    else if (/^[a-j]$/i.test(e.key)) pick = e.key.toLowerCase().charCodeAt(0) - 97;
    if (pick >= 0 && pick < q.options.length) { choose(pick); return; }
    if (e.key === 'ArrowLeft' && index < attempt.questions.length - 1) { index++; renderPlayer(); }
    if (e.key === 'ArrowRight' && index > 0) { index--; renderPlayer(); }
  });

  // ---------- Results ----------

  // Score per file from the questions of one attempt (mock exams and flagged practice mix files).
  function sourceScores(a) {
    const by = {};
    a.questions.forEach((q) => {
      if (!q.source) return;
      by[q.source] = by[q.source] || { quiz: q.source, correct: 0, total: 0 };
      by[q.source].total++;
      if (q.chosen !== undefined && q.chosen === q.correct_index) by[q.source].correct++;
    });
    return Object.values(by).map((t) => Object.assign(t, { pct: Math.round(t.correct / t.total * 100) })).sort((x, y) => x.pct - y.pct);
  }

  function showResults(a, fresh) {
    stopMockTimer();
    attempt = null;
    const c = counts(a);
    const skipped = c.total - c.answered;
    const pct = c.total ? Math.round((c.correct / c.total) * 100) : 0;
    const message = pct >= 90 ? 'ممتاز! أداء رائع' : pct >= 75 ? 'أحسنت! نتيجة جيدة جداً' : pct >= 50 ? 'جيد، راجع أخطاءك وتحسّن أكثر' : 'لا بأس، راجع الشرح وحاول مرة أخرى';
    const delta = a.previous_pct !== null && a.previous_pct !== undefined ? pct - a.previous_pct : null;
    const sources = sourceScores(a);
    page(null,
      h('div', { class: 'wrap narrow', style: { padding: 0 } },
        h('section', { class: 'card result-hero' },
          h('div', { class: 'muted', dir: 'auto' }, a.title),
          h('div', { class: 'ring' }, ringSvg(pct / 100, 168, 14, 'goal-track', pct >= 50 ? 'goal-fill-blue' : 'goal-fill-bad'),
            h('div', { class: 'val' }, h('span', {}, pct + '%', h('small', {}, c.correct + ' من ' + c.total)))),
          h('h1', {}, message),
          delta !== null ? h('span', { class: 'delta-chip ' + (delta > 0 ? 'up' : delta < 0 ? 'down' : '') },
            icon(delta >= 0 ? 'up' : 'down', 16, { stroke: 2.6 }),
            h('bdi', { dir: 'ltr' }, (delta > 0 ? '+' : '') + delta), ' عن محاولتك السابقة (' + a.previous_pct + '%)') : null,
          a.mode === 'wrong' || a.mode === 'review' ? h('p', { class: 'small muted', style: { margin: 0 } }, 'هذه المحاولة لا تُحسب في منحنى التقدم.') : null,
          h('div', { class: 'stat-tiles' },
            h('div', {}, h('b', { style: { color: 'var(--good)' } }, c.correct), h('span', {}, 'صحيحة')),
            h('div', {}, h('b', { style: { color: 'var(--bad)' } }, c.wrong), h('span', {}, 'خاطئة')),
            skipped ? h('div', {}, h('b', { style: { color: 'var(--warn)' } }, skipped), h('span', {}, 'بدون إجابة')) : null,
            h('div', {}, h('b', {}, c.total), h('span', {}, 'إجمالي'))),
          h('div', { class: 'result-actions' },
            c.correct < c.total ? h('button', { class: 'btn primary lg block', onclick: () => startQuiz(a.quiz_id, 'wrong') }, 'راجع أخطاءك (' + (c.total - c.correct) + ' سؤال)') : null,
            a.mode !== 'review' ? h('button', { class: 'btn block', onclick: () => startQuiz(a.quiz_id, 'new') }, a.mode === 'mock' ? 'اختبار تجريبي جديد بأسئلة مختلفة' : 'أعد الاختبار كاملاً') : null,
            h('div', { class: 'row', style: { justifyContent: 'center' } },
              h('button', { class: 'btn ghost', onclick: () => showProgress() }, icon('chart', 18), 'تقدمي'),
              h('button', { class: 'btn ghost', onclick: () => showHome() }, icon('home', 18), 'الرئيسية')))),
        sources.length > 1 ? h('section', { class: 'card', style: { marginTop: '16px' } },
          h('h2', {}, 'نتيجتك في كل ملف'),
          UI.topicBars(sources, { onPractice: null })) : null,
        UI.reviewList(a)));

    if (fresh && pct >= 80) confetti();
  }

  // ---------- Mock exam: timed, forward only ----------

  let mockTimer = null;
  let mockDeadline = 0;
  let mockSelected = null;
  let timerHidden = false;
  try { timerHidden = localStorage.getItem('mcq-timer-hidden') === '1'; } catch (e) { /* storage blocked */ }

  function stopMockTimer() {
    if (mockTimer) clearInterval(mockTimer);
    mockTimer = null;
  }

  function fmtClock(sec) {
    return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
  }

  // newQuestion: start this question's clock (false = redraw the same question and keep its clock).
  function renderMock(newQuestion) {
    stopMockTimer();
    const a = attempt;
    const q = a.questions[index];
    const total = a.questions.length;
    const revealed = q.correct_index !== undefined; // only with feedback on, after answering or skipping
    const done = a.questions.filter((x) => x.chosen !== undefined || x.skipped).length;
    const isLast = index === total - 1;
    if (newQuestion) { mockSelected = null; mockDeadline = Date.now() + a.seconds * 1000; }
    const out = struck.get(q.id) || new Set();
    const again = () => renderMock(false);

    const options = q.options.map((text, i) => {
      let cls = 'option';
      let mark = null;
      if (revealed) {
        if (i === q.correct_index) { cls += ' correct'; mark = icon('check', 20, { stroke: 3 }); }
        else if (i === q.chosen) { cls += ' wrong'; mark = icon('x', 20, { stroke: 3 }); }
        else cls += ' dim';
      } else {
        if (i === mockSelected) cls += ' selected';
        if (out.has(i)) cls += ' struck';
      }
      const btn = h('button', { class: cls, type: 'button', disabled: revealed, 'data-i': i, onclick: () => mockChoose(i) },
        h('span', { class: 'letter' }, optionLetter(i, q.text)),
        h('span', { class: 'otext', dir: 'auto' }, text),
        mark ? h('span', { class: 'mark' }, mark) : null);
      return revealed ? btn : h('div', { class: 'opt-wrap' }, btn, strikeButton(q, i, again));
    });

    const state = revealed ? (q.chosen === q.correct_index ? 'correct' : 'wrong') : '';
    const clock = h('span', { id: 'mock-clock' }, fmtClock(a.seconds));
    const ringBox = h('span', {});
    const timer = h('div', { class: 'timer' + (timerHidden || revealed ? ' is-hidden' : ''), id: 'mock-timer', role: 'timer', 'aria-label': 'الوقت المتبقي للسؤال' }, ringBox, clock);
    const eyeBtn = h('button', {
      class: 'btn icon', type: 'button', 'aria-label': timerHidden ? 'إظهار المؤقت' : 'إخفاء المؤقت', title: timerHidden ? 'إظهار المؤقت' : 'إخفاء المؤقت',
      onclick: () => {
        timerHidden = !timerHidden;
        try { localStorage.setItem('mcq-timer-hidden', timerHidden ? '1' : '0'); } catch (e) { /* storage blocked */ }
        renderMock(false);
      },
    }, icon(timerHidden ? 'eye' : 'eyeOff', 20));

    const confirmBtn = h('button', { class: 'btn primary', id: 'mock-confirm', disabled: mockSelected === null, onclick: () => mockSubmit(mockSelected) },
      isLast ? 'تأكيد وإنهاء الاختبار' : 'تأكيد والتالي');
    const nav = revealed
      ? [h('span', { class: 'spacer' }), h('button', { class: 'btn primary', onclick: mockNext }, isLast ? 'إنهاء وعرض النتيجة' : 'السؤال التالي')]
      : [h('button', { class: 'btn', onclick: () => mockSubmit(-1) }, isLast ? 'تخطي وإنهاء' : 'تخطي'), h('span', { class: 'spacer hide-sm' }), a.feedback ? null : confirmBtn];

    focusPage(!newQuestion,
      focusHead('حفظ والخروج', () => { stopMockTimer(); toast('تم حفظ تقدمك، ويمكنك استكمال الاختبار لاحقاً'); showHome(); },
        'السؤال ' + (index + 1) + ' من ' + total, '', done / total,
        h('div', { class: 'row', style: { gap: '6px', flexWrap: 'nowrap' } }, timer, revealed ? null : eyeBtn, flagButton(q, again))),
      h('section', { class: 'q-card' + (state ? ' is-' + state : '') },
        h('div', { class: 'q-num' },
          q.source ? h('span', { class: 'badge info', dir: 'auto' }, q.source) : null,
          state ? h('span', { class: 'badge ' + (state === 'correct' ? 'good' : 'bad') }, state === 'correct' ? 'صحيح' : (q.skipped ? 'لم تُجب' : 'خطأ')) : null),
        questionBlock(q),
        UI.questionImage(q.image),
        h('div', { class: 'options', dir: textDir(q.text) }, options),
        revealed && q.explanation ? h('div', { class: 'feedback ' + (state === 'correct' ? 'good' : 'bad') },
          h('div', { class: 'explain', dir: 'auto', style: { marginTop: 0 } }, q.explanation)) : null,
        !revealed ? h('p', { class: 'small muted', style: { margin: '12px 0 0' } },
          (a.feedback ? '' : 'يمكنك تغيير اختيارك قبل التأكيد · الإجابات تظهر في النهاية · ') + 'لا رجوع للأسئلة السابقة') : null),
      h('div', { class: 'player-nav' }, nav));

    if (revealed) return;
    const tick = () => {
      if (!document.getElementById('mock-timer') || !attempt) return stopMockTimer();
      const left = Math.max(0, Math.ceil((mockDeadline - Date.now()) / 1000));
      clock.textContent = fmtClock(left);
      ringBox.replaceChildren(ringSvg(left / a.seconds, 26, 4, 't-track', 't-fill'));
      timer.classList.toggle('low', left <= 10);
      if (left <= 0) {
        stopMockTimer();
        toast('انتهى وقت السؤال');
        mockSubmit(!a.feedback && mockSelected !== null ? mockSelected : -1);
      }
    };
    tick();
    mockTimer = setInterval(tick, 250);
  }

  function mockChoose(i) {
    const q = attempt.questions[index];
    if (q.correct_index !== undefined) return;
    if (attempt.feedback) return mockSubmit(i); // answers shown at once: the click is the answer
    mockSelected = i; // exam style: choose, change your mind, then confirm
    document.querySelectorAll('.q-card .option').forEach((b) => b.classList.toggle('selected', Number(b.dataset.i) === i));
    const btn = document.getElementById('mock-confirm');
    if (btn) btn.disabled = false;
  }

  let mockBusy = false;
  async function mockSubmit(choice) {
    if (mockBusy || choice === null) return;
    mockBusy = true;
    stopMockTimer();
    const q = attempt.questions[index];
    try {
      const res = await call('student.answer', { attempt_id: attempt.id, question_id: q.id, choice });
      if (res.chosen < 0) q.skipped = true; else q.chosen = res.chosen;
      noteDaily(res);
      if (res.correct_index !== undefined) {
        q.correct_index = res.correct_index;
        q.explanation = res.explanation;
        renderMock(false); // show the answer, wait for "next"
      } else {
        mockNext();
      }
    } catch (e) {
      if (attempt && document.getElementById('mock-timer')) renderMock(false); // keep the question; the clock continues
    } finally {
      mockBusy = false;
    }
  }

  function mockNext() {
    if (index < attempt.questions.length - 1) {
      index++;
      renderMock(true);
    } else {
      finishMock();
    }
  }

  async function finishMock() {
    stopMockTimer();
    try {
      const res = await call('student.finish', { attempt_id: attempt.id });
      showResults(res.attempt, true);
    } catch (e) { /* handled */ }
  }

  // Keyboard: 1-9 / A-J choose, Enter confirms.
  function mockKey(e) {
    const q = attempt.questions[index];
    if (e.key === 'Enter' && mockSelected !== null && !attempt.feedback) { e.preventDefault(); mockSubmit(mockSelected); return; }
    let pick = -1;
    if (/^[1-9]$/.test(e.key)) pick = Number(e.key) - 1;
    else if (/^[a-j]$/i.test(e.key)) pick = e.key.toLowerCase().charCodeAt(0) - 97;
    if (pick >= 0 && pick < q.options.length) mockChoose(pick);
  }

  // ---------- Flagged questions ----------

  async function showFlags() {
    stopMockTimer();
    attempt = null;
    loading('flags');
    let data;
    try { data = await call('student.flags'); } catch (e) { return; }
    me = data.me;
    reviewQuizId = data.review_quiz_id;
    const list = data.questions;
    flagsCount = list.length;
    const unflag = async (q) => {
      try {
        await call('student.flag', { question_id: q.id, flagged: false });
        toast('أُزيل التعليم');
        showFlags();
      } catch (e) { /* shown */ }
    };
    page('flags',
      h('div', { class: 'page-head' },
        h('div', { class: 'spacer' }, h('h1', {}, 'الأسئلة المعلّمة'), h('div', { class: 'muted small' }, 'الأسئلة اللي علّمتها أثناء الحل علشان ترجعلها')),
        list.length ? h('button', { class: 'btn primary lg', onclick: () => startQuiz(reviewQuizId, 'new') }, icon('refresh', 18), 'تدرّب على ' + list.length + ' سؤال') : null),
      list.length
        ? h('div', { class: 'flag-list' }, list.map((q) => h('article', { class: 'card flag-item' },
          h('span', { style: { color: 'var(--gold)' } }, icon('flag', 22, { solid: true })),
          h('div', { class: 'meta' },
            h('span', { class: 'q', dir: 'auto' }, q.text),
            h('span', { class: 'small muted', dir: 'auto' }, q.source + (q.image ? ' · فيه صورة' : ''))),
          h('button', { class: 'btn ghost icon', 'aria-label': 'إزالة التعليم', title: 'إزالة التعليم', onclick: () => unflag(q) }, icon('x', 18)))))
        : h('div', { class: 'card empty' }, h('div', { class: 'big' }, icon('flag', 28)),
          h('h2', { style: { margin: 0 } }, 'لا توجد أسئلة معلّمة'),
          h('p', {}, 'اضغط على العلَم أثناء حل أي سؤال لتحفظه هنا وتتدرّب عليه لاحقاً.')));
  }

  // ---------- Progress ----------

  async function showProgress() {
    stopMockTimer();
    attempt = null;
    loading('progress');
    let data;
    try { data = await call('student.history'); } catch (e) { return; }
    me = data.me;
    page('progress',
      h('div', { class: 'page-head' }, h('div', {}, h('h1', {}, 'تقدمي'),
        h('div', { class: 'muted small' }, 'كل نتائجك محفوظة هنا، علشان تقارن أداءك وتعرف نقاط قوتك وضعفك.'))),
      UI.progressView(data.attempts, { onReview: reviewAttempt, who: 'student', topics: data.topics, onPractice: (quizId) => startQuiz(quizId, 'new') }));
  }

  // ---------- Account ----------

  async function showAccount() {
    stopMockTimer();
    attempt = null;
    if (!daily) {
      loading('account');
      try { const data = await call('student.quizzes'); daily = data.daily; me = data.me; flagsCount = data.flags; } catch (e) { return; }
    }
    const sub = me.subscription;
    const wa = whatsappLink('مرحباً، أريد تجديد اشتراكي في ' + S.platform_name);
    const setGoal = async (g) => {
      try {
        const res = await call('student.goal', { goal: g });
        daily = res.daily;
        toast('هدفك اليومي الآن ' + g + ' سؤال');
        showAccount();
      } catch (e) { /* shown */ }
    };
    page('account',
      h('section', { class: 'card', style: { display: 'flex', alignItems: 'center', gap: '14px' } },
        h('span', { class: 'avatar' }, me.name.trim().charAt(0)),
        h('div', { class: 'spacer' }, h('h1', { style: { margin: 0, fontSize: '1.3rem' } }, me.name), h('div', { class: 'muted small', dir: 'ltr', style: { textAlign: 'right' } }, me.username))),
      h('section', { class: 'card', style: { marginTop: '16px' } },
        h('h2', {}, 'اشتراكك'),
        h('div', { class: 'settings-list' },
          h('div', { class: 'item' }, h('div', { class: 'meta' }, h('b', {}, 'الحالة'), h('span', { class: 'muted small' }, sub.state === 'ending' ? 'قارب على الانتهاء' : 'ساري')),
            h('span', { class: 'badge ' + (sub.state === 'ending' ? 'warn' : 'good') }, (sub.days_left === null ? '—' : sub.days_left) + ' يوم متبقي')),
          sub.first_login_at ? h('div', { class: 'item' }, h('div', { class: 'meta' }, h('b', {}, 'بداية الاشتراك')), h('span', {}, fmtDate(sub.first_login_at))) : null,
          sub.expires_at ? h('div', { class: 'item' }, h('div', { class: 'meta' }, h('b', {}, 'نهاية الاشتراك')), h('span', {}, fmtDate(sub.expires_at))) : null),
        wa ? h('a', { class: 'btn good', href: wa, target: '_blank', rel: 'noopener', style: { marginTop: '12px' } }, icon('chat', 18), 'جدّد اشتراكك عبر واتساب') : null),
      h('section', { class: 'card', style: { marginTop: '16px' } },
        h('h2', {}, 'هدفك اليومي'),
        h('p', { class: 'muted' }, 'عدد الأسئلة اللي عايز تحلها كل يوم. لما تحققه يزيد عداد الأيام المتتالية.'),
        h('div', { class: 'chips', role: 'group', 'aria-label': 'الهدف اليومي' }, [10, 20, 30, 50, 100].map((g) =>
          h('button', { class: 'chip' + (daily && daily.goal === g ? ' active' : ''), type: 'button', 'aria-pressed': daily && daily.goal === g ? 'true' : 'false', onclick: () => setGoal(g) }, g + ' سؤال')))),
      h('section', { class: 'card', style: { marginTop: '16px' } },
        h('div', { class: 'settings-list' },
          h('div', { class: 'item' }, icon(currentTheme() === 'dark' ? 'moon' : 'sun', 20),
            h('div', { class: 'meta' }, h('b', {}, 'الوضع الليلي'), h('span', { class: 'muted small' }, currentTheme() === 'dark' ? 'مفعّل' : 'غير مفعّل')),
            h('button', { class: 'btn sm', type: 'button', onclick: () => { toggleTheme(); showAccount(); } }, currentTheme() === 'dark' ? 'الوضع النهاري' : 'الوضع الليلي')),
          h('div', { class: 'item' }, icon('logout', 20),
            h('div', { class: 'meta' }, h('b', {}, 'تسجيل الخروج')),
            h('button', { class: 'btn sm danger', type: 'button', onclick: logout }, 'خروج')))),
      servicesCard());
  }

  // ---------- Boot ----------

  (async function boot() {
    try {
      const res = await api('student.me');
      me = res.me;
      showHome();
    } catch (err) {
      if (err.code === 'expired' || err.code === 'suspended') showBlocked(err.code, err.message);
      else showLogin(err.code === 'other_device' ? err.message : '');
    }
  })();
})();
