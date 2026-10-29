// Performance history shared by the student app and the teacher dashboard:
// score chart, stat tiles, trend, per-quiz comparison, attempt log and the answer review list.
(function () {
  'use strict';

  const { h, fmtDate, fmtDateTime, optionLetter, textDir } = window.UI;
  const SVG = 'http://www.w3.org/2000/svg';
  const STEADY = 5; // a change smaller than this many points counts as steady

  // Same rule as score_trend() in api.php: average of the latest n full attempts minus the n before them.
  function trend(scores) {
    const n = Math.min(3, Math.floor(scores.length / 2));
    if (n < 1) return null;
    const avg = (list) => list.reduce((s, v) => s + v, 0) / list.length;
    return Math.round(avg(scores.slice(-n)) - avg(scores.slice(-2 * n, -n)));
  }

  // ▲ +12 / ▼ -8 / = 0 — direction is shown by icon and sign, never by color alone.
  function deltaBadge(delta, suffix) {
    if (delta === null || delta === undefined) return null;
    const kind = delta >= STEADY ? 'good' : delta <= -STEADY ? 'bad' : '';
    const icon = delta >= STEADY ? '▲' : delta <= -STEADY ? '▼' : '=';
    return h('span', { class: 'badge ' + kind, dir: 'ltr' }, icon + ' ' + (delta > 0 ? '+' : '') + delta + (suffix || ''));
  }

  function trendText(delta) {
    if (delta === null) return 'يحتاج محاولتين على الأقل';
    if (delta >= STEADY) return 'تحسّن';
    if (delta <= -STEADY) return 'تراجع';
    return 'ثابت';
  }

  function svg(tag, attrs) {
    const el = document.createElementNS(SVG, tag);
    for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, v);
    return el;
  }

  // Line chart of full-attempt scores over time (0–100%). Single series, so no legend; the title names it.
  function scoreChart(points) {
    const wrap = h('div', { class: 'chart', dir: 'ltr' });
    const tip = h('div', { class: 'chart-tip', role: 'status', 'aria-live': 'polite' });
    let selected = points.length - 1;

    const draw = () => {
      const W = Math.max(280, wrap.clientWidth);
      const H = 240;
      const pad = { top: 16, right: 18, bottom: 30, left: 42 };
      const iw = W - pad.left - pad.right;
      const ih = H - pad.top - pad.bottom;
      const x = (i) => pad.left + (points.length === 1 ? iw / 2 : (i / (points.length - 1)) * iw);
      const y = (v) => pad.top + ih - (v / 100) * ih;

      const root = svg('svg', { width: W, height: H, viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'منحنى الدرجات عبر المحاولات', tabindex: '0', class: 'chart-svg' });
      for (const v of [0, 25, 50, 75, 100]) {
        root.append(svg('line', { x1: pad.left, x2: W - pad.right, y1: y(v), y2: y(v), class: v === 0 ? 'chart-base' : 'chart-grid' }));
        const t = svg('text', { x: pad.left - 8, y: y(v) + 4, 'text-anchor': 'end', class: 'chart-axis' });
        t.textContent = v + '%';
        root.append(t);
      }
      // A few date ticks: first, last and evenly spaced ones between them.
      const tickCount = Math.min(points.length, Math.max(2, Math.floor(iw / 110)));
      const ticks = new Set(points.length === 1 ? [0] : Array.from({ length: tickCount }, (_, k) => Math.round((k / (tickCount - 1)) * (points.length - 1))));
      for (const i of ticks) {
        const t = svg('text', { x: x(i), y: H - 8, 'text-anchor': points.length === 1 ? 'middle' : i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle', class: 'chart-axis' });
        t.textContent = shortDate(points[i].finished_at);
        root.append(t);
      }
      if (points.length > 1) {
        const line = points.map((p, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(p.pct).toFixed(1)).join(' ');
        root.append(svg('path', { d: line + ' L' + x(points.length - 1) + ' ' + y(0) + ' L' + x(0) + ' ' + y(0) + ' Z', class: 'chart-area' }));
        root.append(svg('path', { d: line, class: 'chart-line' }));
      }
      const cross = svg('line', { y1: pad.top, y2: pad.top + ih, class: 'chart-cross' });
      root.append(cross);
      const dots = points.map((p, i) => {
        const c = svg('circle', { cx: x(i), cy: y(p.pct), r: 4.5, class: 'chart-dot' });
        root.append(c);
        return c;
      });
      // The latest score is labelled directly; the rest are on hover and in the table below.
      const last = points[points.length - 1];
      const lbl = svg('text', { x: x(points.length - 1), y: y(last.pct) - 12, 'text-anchor': points.length === 1 ? 'middle' : 'end', class: 'chart-label' });
      lbl.textContent = last.pct + '%';
      root.append(lbl);

      const hit = svg('rect', { x: pad.left - 12, y: 0, width: iw + 24, height: H, fill: 'transparent' });
      root.append(hit);

      const show = (i) => {
        selected = i;
        const p = points[i];
        cross.setAttribute('x1', x(i));
        cross.setAttribute('x2', x(i));
        cross.style.opacity = 1;
        dots.forEach((d, k) => d.setAttribute('r', k === i ? 6.5 : 4.5));
        tip.replaceChildren(
          h('b', {}, p.pct + '%'),
          h('span', { dir: 'auto' }, p.quiz),
          h('span', { class: 'muted' }, fmtDateTime(p.finished_at) + ' · ' + p.correct + '/' + p.total));
        tip.style.display = 'flex';
        const tx = Math.min(Math.max(x(i) - tip.offsetWidth / 2, 0), W - tip.offsetWidth);
        tip.style.left = tx + 'px';
        tip.style.top = Math.max(0, y(p.pct) - tip.offsetHeight - 16) + 'px';
      };
      const hide = () => { cross.style.opacity = 0; tip.style.display = 'none'; dots.forEach((d) => d.setAttribute('r', 4.5)); };
      const nearest = (clientX) => {
        const bx = clientX - root.getBoundingClientRect().left;
        let best = 0;
        points.forEach((_, i) => { if (Math.abs(x(i) - bx) < Math.abs(x(best) - bx)) best = i; });
        return best;
      };
      hit.addEventListener('pointermove', (e) => show(nearest(e.clientX)));
      hit.addEventListener('pointerdown', (e) => show(nearest(e.clientX)));
      root.addEventListener('pointerleave', hide);
      root.addEventListener('focus', () => show(selected));
      root.addEventListener('blur', hide);
      root.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight' && selected < points.length - 1) { e.preventDefault(); show(selected + 1); }
        if (e.key === 'ArrowLeft' && selected > 0) { e.preventDefault(); show(selected - 1); }
      });
      wrap.replaceChildren(root, tip);
      hide();
    };

    // Draw once the element is in the page (it needs a width), then follow size changes.
    requestAnimationFrame(draw);
    if (window.ResizeObserver) {
      let lastW = 0;
      new ResizeObserver(() => { if (wrap.clientWidth && wrap.clientWidth !== lastW) { lastW = wrap.clientWidth; draw(); } }).observe(wrap);
    }
    return wrap;
  }

  const shortFmt = new Intl.DateTimeFormat('ar-EG-u-nu-latn', { day: 'numeric', month: 'short' });
  const shortDate = (ts) => shortFmt.format(new Date(ts * 1000));

  function tile(label, value, extra) {
    return h('div', { class: 'kpi' }, h('span', { class: 'small muted' }, label), h('b', {}, value), extra || null);
  }

  // attempts: oldest first, from student_history() in api.php.
  function progressView(attempts, opts) {
    const onReview = opts && opts.onReview;
    const who = (opts && opts.who) || 'student'; // wording: "you" for the student, "the student" for the teacher
    const root = h('div', { class: 'stack' });
    if (!attempts.length) {
      root.append(h('div', { class: 'card empty' }, h('div', { class: 'big' }, '📈'),
        h('p', {}, who === 'student' ? 'لم تُكمل أي اختبار بعد. بعد أول اختبار ستظهر هنا درجاتك وتطورك.' : 'لم يُكمل الطالب أي اختبار بعد.')));
      return root;
    }

    const quizzes = [];
    for (const a of attempts) if (!quizzes.some((q) => q.id === a.quiz_id)) quizzes.push({ id: a.quiz_id, title: a.quiz });
    let quizFilter = 0;
    const body = h('div', { class: 'stack' });

    const paint = () => {
      const rows = attempts.filter((a) => !quizFilter || a.quiz_id === quizFilter);
      const full = rows.filter((a) => a.mode === 'full');
      const scores = full.map((a) => a.pct);
      const t = trend(scores);
      const avg = scores.length ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length) : null;
      const last = full[full.length - 1];
      const prev = full[full.length - 2];

      // Change of each full attempt vs the previous full attempt at the same quiz.
      const prevByQuiz = {};
      const change = {};
      for (const a of attempts) {
        if (a.mode !== 'full') continue;
        if (prevByQuiz[a.quiz_id] !== undefined) change[a.id] = a.pct - prevByQuiz[a.quiz_id];
        prevByQuiz[a.quiz_id] = a.pct;
      }

      const n = Math.min(3, Math.floor(scores.length / 2));
      const parts = [
        h('div', { class: 'kpis' },
          tile('اختبارات مكتملة', rows.length),
          tile('متوسط الدرجات', avg === null ? '—' : avg + '%'),
          tile('آخر نتيجة', last ? last.pct + '%' : '—', last && prev ? h('div', { class: 'small' }, deltaBadge(last.pct - prev.pct), ' عن السابقة') : null),
          tile('أفضل نتيجة', scores.length ? Math.max.apply(null, scores) + '%' : '—'),
          tile('الاتجاه', trendText(t), t !== null ? h('div', { class: 'small' }, deltaBadge(t), ' ', h('span', { class: 'muted' }, 'آخر ' + n + ' مقابل ' + n + ' قبلها')) : null)),
      ];

      if (full.length) {
        parts.push(h('section', { class: 'card' },
          h('h3', {}, 'الدرجة في كل محاولة'),
          h('p', { class: 'small muted' }, 'المحاولات الكاملة فقط' + (quizFilter ? '' : '، لكل الاختبارات') + '. مرّر على المنحنى لرؤية التفاصيل.'),
          scoreChart(full)));
      }

      if (!quizFilter && quizzes.length) {
        parts.push(h('section', {},
          h('h3', {}, 'مقارنة أول وآخر محاولة في كل اختبار'),
          h('div', { class: 'table-wrap' }, h('table', {},
            h('thead', {}, h('tr', {}, ['الاختبار', 'محاولات', 'أول نتيجة', 'آخر نتيجة', 'أفضل', 'التغيير'].map((x) => h('th', {}, x)))),
            h('tbody', {}, quizzes.map((q) => {
              const qa = attempts.filter((a) => a.quiz_id === q.id && a.mode === 'full');
              const first = qa[0];
              const lastQ = qa[qa.length - 1];
              return h('tr', {},
                h('td', { dir: 'auto' }, h('a', { href: '#', onclick: (e) => { e.preventDefault(); quizFilter = q.id; select.value = q.id; paint(); } }, q.title)),
                h('td', {}, attempts.filter((a) => a.quiz_id === q.id).length),
                h('td', {}, first ? first.pct + '%' : '—'),
                h('td', {}, lastQ ? lastQ.pct + '%' : '—'),
                h('td', {}, qa.length ? Math.max.apply(null, qa.map((a) => a.pct)) + '%' : '—'),
                h('td', {}, qa.length > 1 ? deltaBadge(lastQ.pct - first.pct) : h('span', { class: 'muted small' }, 'محاولة واحدة')));
            }))))));
      }

      parts.push(h('section', {},
        h('h3', {}, 'سجل المحاولات'),
        h('div', { class: 'table-wrap' }, h('table', {},
          h('thead', {}, h('tr', {}, ['التاريخ', 'الاختبار', 'النوع', 'الدرجة', 'التغيير', 'المدة', ''].map((x) => h('th', {}, x)))),
          h('tbody', {}, rows.slice().reverse().map((a) => h('tr', {},
            h('td', { class: 'small' }, fmtDateTime(a.finished_at)),
            h('td', { dir: 'auto' }, a.quiz),
            h('td', {}, a.mode === 'full' ? h('span', { class: 'badge' }, 'كامل') : h('span', { class: 'badge info' }, 'الأخطاء فقط')),
            h('td', {}, h('b', {}, a.pct + '%'), h('span', { class: 'small muted' }, ' (' + a.correct + '/' + a.total + ')')),
            h('td', {}, a.mode !== 'full' ? h('span', { class: 'muted small' }, 'لا يُقارن') : change[a.id] !== undefined ? deltaBadge(change[a.id]) : h('span', { class: 'muted small' }, 'أول محاولة')),
            h('td', { class: 'small' }, a.minutes + ' د'),
            h('td', {}, onReview ? h('button', { class: 'btn sm', onclick: () => onReview(a.id) }, 'مراجعة') : null))))))));

      body.replaceChildren(...parts);
    };

    const select = h('select', { class: 'input', style: { maxWidth: '320px' }, onchange: (e) => { quizFilter = Number(e.target.value); paint(); } },
      h('option', { value: 0 }, 'كل الاختبارات'),
      quizzes.map((q) => h('option', { value: q.id }, q.title)));
    root.append(
      h('div', { class: 'toolbar', style: { marginBottom: 0 } }, select,
        h('span', { class: 'small muted' }, 'التغيير = الفرق عن المحاولة الكاملة السابقة في نفس الاختبار. محاولات "الأخطاء فقط" لا تدخل في المقارنة.')),
      body);
    paint();
    return root;
  }

  // Every question of a finished attempt with the chosen and correct answers and the explanation.
  function reviewList(a, wording) {
    const you = wording !== 'teacher';
    let filter = 'all';
    const list = h('div', { class: 'stack' });
    const paintList = () => {
      list.replaceChildren(...a.questions
        .map((q, i) => ({ q, i, st: q.chosen === undefined ? 'skipped' : q.chosen === q.correct_index ? 'correct' : 'wrong' }))
        .filter(({ st }) => filter === 'all' || (filter === 'wrong' ? st !== 'correct' : st === 'correct'))
        .map(({ q, i, st }) => h('article', { class: 'card review-item ' + st },
          h('div', { class: 'q-num' }, 'السؤال ' + (i + 1),
            h('span', { class: 'badge ' + (st === 'correct' ? 'good' : st === 'wrong' ? 'bad' : 'warn') }, st === 'correct' ? 'صحيح' : st === 'wrong' ? 'خطأ' : (you ? 'لم تُجب' : 'لم يُجب'))),
          h('div', { class: 'q-text', dir: textDir(q.text) }, q.text),
          h('div', { class: 'options', dir: textDir(q.text) }, q.options.map((text, oi) => h('div', {
            class: 'option' + (oi === q.correct_index ? ' correct' : oi === q.chosen ? ' wrong' : ' dim'),
          },
            h('span', { class: 'letter' }, optionLetter(oi, q.text)),
            h('span', { class: 'otext', dir: 'auto' }, text),
            oi === q.correct_index ? h('span', { class: 'mark' }, '✓') : oi === q.chosen ? h('span', { class: 'mark' }, '✗') : null))),
          q.explanation ? h('div', { class: 'feedback' }, h('div', { class: 'explain-title', style: { marginTop: 0 } }, 'الشرح:'), h('div', { class: 'explain', dir: 'auto' }, q.explanation)) : null)));
      if (!list.children.length) list.append(h('div', { class: 'card empty' }, 'لا توجد أسئلة هنا.'));
    };
    paintList();
    const filterBtn = (key, label) => h('button', {
      type: 'button',
      class: key === filter ? 'active' : '',
      onclick: (e) => { filter = key; e.target.parentNode.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b === e.target)); paintList(); },
    }, label);
    return h('div', {},
      h('div', { class: 'row', style: { margin: '28px 0 12px' } },
        h('h2', { class: 'spacer', style: { margin: 0 } }, 'مراجعة الإجابات'),
        h('div', { class: 'tabs' }, filterBtn('all', 'الكل'), filterBtn('wrong', 'الأخطاء'), filterBtn('correct', 'الصحيحة'))),
      list);
  }

  Object.assign(window.UI, { progressView, reviewList, deltaBadge, trend });
})();
