// Student app: login, subscription banner, quiz list, interactive quiz, results and review.
(function () {
  'use strict';

  const { APP, h, mount, api, toast, themeButton, brand, modal, fmtDate, whatsappLink, optionLetter, textDir, confetti } = window.UI;
  const S = APP.settings;
  let me = null;

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

  function showLogin(notice) {
    const error = h('div', { class: 'alert bad hidden', role: 'alert' });
    const user = h('input', { class: 'input', name: 'username', autocomplete: 'username', required: true, dir: 'ltr', inputmode: 'text' });
    const pass = h('input', { class: 'input', name: 'password', type: 'password', autocomplete: 'current-password', required: true, dir: 'ltr' });
    const submit = h('button', { class: 'btn primary block', type: 'submit' }, 'دخول');
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
      h('label', { class: 'field' }, h('span', {}, 'اسم المستخدم أو رقم الموبايل'), user),
      h('label', { class: 'field' }, h('span', {}, 'كلمة المرور'), pass),
      submit);

    mount(h('div', { class: 'auth' },
      h('div', { class: 'card' },
        h('div', { class: 'brand-mark', 'aria-hidden': 'true' }, (S.platform_name || 'م').trim().charAt(0)),
        h('h1', {}, S.platform_name),
        h('p', { class: 'lead' }, 'سجّل الدخول لبدء حل الأسئلة'),
        form,
        h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '16px' } }, themeButton()))));
    user.focus();
  }

  function showBlocked(code, message) {
    const expired = code === 'expired';
    const wa = whatsappLink(expired ? 'مرحباً، أريد تجديد اشتراكي في ' + S.platform_name : 'مرحباً، حسابي موقوف في ' + S.platform_name);
    mount(h('div', { class: 'auth' },
      h('div', { class: 'card blocked' },
        h('div', { class: 'icon-circle', 'aria-hidden': 'true' }, expired ? '⏳' : '🔒'),
        h('h1', {}, expired ? 'انتهى الاشتراك' : 'الحساب موقوف'),
        h('p', { class: 'muted' }, message),
        wa ? h('a', { class: 'btn good block', href: wa, target: '_blank', rel: 'noopener' }, 'تواصل عبر واتساب للتجديد') : null,
        h('button', { class: 'btn ghost block', style: { marginTop: '10px' }, onclick: () => logout() }, 'تسجيل الدخول بحساب آخر'))));
  }

  async function logout() {
    try { await api('student.logout'); } catch (e) { /* already out */ }
    me = null;
    showLogin('');
  }

  // ---------- Shell ----------

  function topbar(extra) {
    return h('header', { class: 'topbar' },
      h('div', { class: 'wrap' },
        brand(S.platform_name),
        extra,
        me ? h('button', { class: 'btn ghost sm', onclick: () => showProgress() }, '📈 تقدمي') : null,
        me ? h('span', { class: 'muted small hide-sm' }, me.name) : null,
        themeButton(),
        me ? h('button', { class: 'btn ghost sm', onclick: logout }, 'خروج') : null));
  }

  function subscriptionBanner(sub) {
    if (!sub || sub.expires_at === null) return null;
    const ending = sub.state === 'ending';
    const totalDays = Math.max(1, Math.round((sub.expires_at - sub.first_login_at) / 86400));
    const left = Math.min(100, Math.max(0, (sub.days_left / totalDays) * 100));
    const wa = ending ? whatsappLink('مرحباً، أريد تجديد اشتراكي في ' + S.platform_name) : null;
    return h('div', { class: 'sub-banner' + (ending ? ' ending' : '') },
      h('div', {}, h('div', { class: 'days' }, sub.days_left), h('div', { class: 'small' }, 'يوم متبقي')),
      h('div', { style: { flex: '1 1 220px' } },
        h('div', { style: { fontWeight: 700 } }, ending ? 'اشتراكك قارب على الانتهاء' : 'اشتراكك ساري'),
        h('div', { class: 'small' }, 'ينتهي في ' + fmtDate(sub.expires_at)),
        h('div', { class: 'meter', style: { marginTop: '6px' } }, h('i', { style: { width: left + '%' } }))),
      wa ? h('a', { class: 'btn sm', href: wa, target: '_blank', rel: 'noopener' }, 'جدّد الآن') : null);
  }

  // ---------- Home ----------

  async function showHome() {
    mount(topbar(), h('main', {}, h('div', { class: 'wrap' }, h('div', { class: 'boot', style: { minHeight: '40vh' } }, h('div', { class: 'spinner' })))));
    let data;
    try { data = await call('student.quizzes'); } catch (e) { return; }
    me = data.me;
    const quizzes = data.quizzes;

    const cards = quizzes.map((q) => {
      const st = q.stats || {};
      const open = st.open && st.open.answered > 0 ? st.open : null;
      const actions = [];
      if (open) {
        actions.push(h('button', { class: 'btn primary', onclick: () => startQuiz(q.id, 'resume') }, 'أكمل الحل'));
        actions.push(h('button', { class: 'btn', onclick: () => startQuiz(q.id, 'new') }, 'ابدأ من جديد'));
      } else {
        actions.push(h('button', { class: 'btn primary', onclick: () => startQuiz(q.id, 'new') }, st.last ? 'أعد الاختبار' : 'ابدأ الاختبار'));
      }
      if (st.last) {
        actions.push(h('button', { class: 'btn ghost', onclick: () => reviewAttempt(st.last.id) }, 'مراجعة آخر محاولة'));
        if (st.last.correct < st.last.total) {
          actions.push(h('button', { class: 'btn ghost', onclick: () => startQuiz(q.id, 'wrong') }, 'حل أخطائي فقط'));
        }
      }
      return h('article', { class: 'card quiz-card' },
        h('div', { class: 'row' },
          h('span', { class: 'badge info' }, q.total + ' سؤال'),
          st.best !== undefined && st.best !== null ? h('span', { class: 'badge ' + (st.best >= 50 ? 'good' : 'bad') }, 'أفضل نتيجة ' + st.best + '%') : null),
        h('h3', { dir: 'auto' }, q.title),
        q.description ? h('p', { class: 'muted small', dir: 'auto' }, q.description) : null,
        open ? h('div', {},
          h('div', { class: 'small muted' }, 'تم حل ' + open.answered + ' من ' + open.total),
          h('div', { class: 'mini-progress' }, h('i', { style: { width: (open.answered / open.total * 100) + '%' } }))) : null,
        h('div', { class: 'actions' }, actions));
    });

    mount(
      topbar(),
      h('main', {},
        h('div', { class: 'wrap' },
          h('h1', {}, 'أهلاً ' + me.name.split(' ')[0] + ' 👋'),
          h('p', { class: 'muted' }, 'اختر اختباراً وابدأ الحل. ستظهر لك الإجابة الصحيحة والشرح بعد كل سؤال.'),
          subscriptionBanner(me.subscription),
          cards.length
            ? h('div', { class: 'grid' }, cards)
            : h('div', { class: 'card empty' }, h('div', { class: 'big' }, '📚'), h('p', {}, 'لا توجد اختبارات متاحة حالياً. ستظهر هنا فور إضافتها.')))));
  }

  // ---------- Quiz player ----------

  let attempt = null;
  let index = 0;

  async function startQuiz(quizId, mode) {
    let res;
    try { res = await call('student.start', { quiz_id: quizId, mode }); } catch (e) { return; }
    attempt = res.attempt;
    if (mode === 'wrong') toast('هذه المحاولة تحتوي على الأسئلة التي أخطأت فيها فقط');
    const firstOpen = attempt.questions.findIndex((q) => q.chosen === undefined);
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

  function renderPlayer(popIndex) {
    const q = attempt.questions[index];
    const c = counts(attempt);
    const state = questionState(q);
    const answered = q.chosen !== undefined;
    const isLast = index === attempt.questions.length - 1;

    const options = q.options.map((text, i) => {
      let cls = 'option';
      let mark = '';
      if (answered) {
        if (i === q.correct_index) { cls += ' correct'; mark = '✓'; }
        else if (i === q.chosen) { cls += ' wrong'; mark = '✗'; }
        else cls += ' dim';
        if (i === popIndex) cls += ' pop';
      }
      return h('button', { class: cls, type: 'button', disabled: answered, onclick: () => choose(i) },
        h('span', { class: 'letter' }, optionLetter(i, q.text)),
        h('span', { class: 'otext', dir: 'auto' }, text),
        mark ? h('span', { class: 'mark', 'aria-hidden': 'true' }, mark) : null);
    });

    const feedback = answered ? h('div', { class: 'feedback ' + (state === 'correct' ? 'good' : 'bad'), id: 'feedback' },
      h('div', { class: 'verdict' }, state === 'correct' ? '✓ إجابة صحيحة، أحسنت!' : '✗ إجابة خاطئة'),
      state === 'wrong' ? h('div', {}, 'الإجابة الصحيحة: ',
        h('b', {}, h('bdi', { dir: textDir(q.text) }, optionLetter(q.correct_index, q.text) + ') ' + q.options[q.correct_index]))) : null,
      q.explanation ? h('div', {}, h('div', { class: 'explain-title' }, 'الشرح:'), h('div', { class: 'explain', dir: 'auto' }, q.explanation)) : null) : null;

    const questionNav = h('div', { class: 'navigator', 'aria-label': 'قائمة الأسئلة' },
      attempt.questions.map((item, i) => h('button', {
        type: 'button',
        class: [questionState(item), i === index ? 'current' : ''].join(' ').trim(),
        'aria-label': 'السؤال ' + (i + 1),
        onclick: () => { index = i; renderPlayer(); },
      }, i + 1)));

    mount(
      topbar(),
      h('main', {},
        h('div', { class: 'wrap narrow' },
          h('div', { class: 'player-head' },
            h('button', { class: 'btn ghost sm', onclick: () => showHome() }, '→ الاختبارات'),
            h('h2', { class: 'spacer', dir: 'auto' }, attempt.title),
            h('div', { class: 'score-pills' },
              h('span', { class: 'badge good' }, '✓ ' + c.correct),
              h('span', { class: 'badge bad' }, '✗ ' + c.wrong))),
          h('div', { class: 'progress', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': c.total, 'aria-valuenow': c.answered },
            h('i', { style: { width: (c.answered / c.total * 100) + '%' } })),
          h('div', { class: 'small muted', style: { marginTop: '6px' } }, 'أجبت على ' + c.answered + ' من ' + c.total),
          h('section', { class: 'q-card' + (state ? ' is-' + state : '') },
            h('div', { class: 'q-num' }, 'السؤال ' + (index + 1) + ' من ' + c.total,
              state ? h('span', { class: 'badge ' + (state === 'correct' ? 'good' : 'bad') }, state === 'correct' ? 'صحيح' : 'خطأ') : null),
            h('div', { class: 'q-text', dir: textDir(q.text) }, q.text),
            h('div', { class: 'options', dir: textDir(q.text) }, options),
            feedback),
          h('div', { class: 'player-nav' },
            h('button', { class: 'btn', disabled: index === 0, onclick: () => { index--; renderPlayer(); } }, 'السابق'),
            h('span', { class: 'spacer hide-sm' }),
            isLast
              ? h('button', { class: 'btn primary', onclick: finish }, 'إنهاء وعرض النتيجة')
              : h('button', { class: 'btn ' + (answered ? 'primary' : ''), onclick: () => { index++; renderPlayer(); } }, answered ? 'السؤال التالي' : 'تخطّي')),
          questionNav,
          !isLast && c.answered === c.total ? h('div', { style: { marginTop: '16px' } }, h('button', { class: 'btn primary block', onclick: finish }, 'أنهيت كل الأسئلة — اعرض النتيجة')) : null)));

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
      renderPlayer(res.chosen);
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
    const q = attempt.questions[index];
    let pick = -1;
    if (/^[1-9]$/.test(e.key)) pick = Number(e.key) - 1;
    else if (/^[a-j]$/i.test(e.key)) pick = e.key.toLowerCase().charCodeAt(0) - 97;
    if (pick >= 0 && pick < q.options.length) { choose(pick); return; }
    if (e.key === 'ArrowLeft' && index < attempt.questions.length - 1) { index++; renderPlayer(); }
    if (e.key === 'ArrowRight' && index > 0) { index--; renderPlayer(); }
  });

  // ---------- Results and review ----------

  function ring(pct) {
    const r = 70, circ = 2 * Math.PI * r;
    const color = pct >= 80 ? 'var(--good)' : pct >= 50 ? 'var(--primary)' : 'var(--bad)';
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 160 160');
    const mk = (stroke, dash) => {
      const c = document.createElementNS(svgNS, 'circle');
      c.setAttribute('cx', '80'); c.setAttribute('cy', '80'); c.setAttribute('r', String(r));
      c.setAttribute('fill', 'none'); c.setAttribute('stroke-width', '14'); c.setAttribute('stroke', stroke);
      c.setAttribute('stroke-linecap', 'round');
      if (dash !== undefined) c.setAttribute('stroke-dasharray', dash + ' ' + circ);
      return c;
    };
    svg.append(mk('var(--surface-2)'), mk(color, (pct / 100) * circ));
    return h('div', { class: 'ring' }, svg, h('div', { class: 'val' }, pct + '%'));
  }

  function showResults(a, fresh) {
    attempt = null;
    const c = counts(a);
    const skipped = c.total - c.answered;
    const pct = c.total ? Math.round((c.correct / c.total) * 100) : 0;
    const message = pct >= 90 ? 'ممتاز! أداء رائع 🎉' : pct >= 75 ? 'أحسنت! نتيجة جيدة جداً 👏' : pct >= 50 ? 'جيد، راجع الأخطاء لتتحسن أكثر 💪' : 'لا بأس، راجع الشرح وحاول مرة أخرى 📖';
    mount(
      topbar(),
      h('main', {},
        h('div', { class: 'wrap narrow' },
          h('section', { class: 'card result-hero' },
            h('div', { class: 'muted', dir: 'auto' }, a.title),
            ring(pct),
            h('h1', {}, message),
            a.previous_pct !== null && a.previous_pct !== undefined
              ? h('p', {}, 'مقارنة بمحاولتك السابقة (' + a.previous_pct + '%): ', UI.deltaBadge(pct - a.previous_pct))
              : null,
            a.mode === 'wrong' ? h('p', { class: 'small muted' }, 'محاولة "الأخطاء فقط" لا تُحسب في منحنى التقدم.') : null,
            h('div', { class: 'stats' },
              h('div', { class: 'stat' }, h('b', { style: { color: 'var(--good)' } }, c.correct), 'صحيحة'),
              h('div', { class: 'stat' }, h('b', { style: { color: 'var(--bad)' } }, c.wrong), 'خاطئة'),
              skipped ? h('div', { class: 'stat' }, h('b', { style: { color: 'var(--warn)' } }, skipped), 'بدون إجابة') : null,
              h('div', { class: 'stat' }, h('b', {}, c.total), 'إجمالي')),
            h('div', { class: 'row', style: { justifyContent: 'center' } },
              c.correct < c.total ? h('button', { class: 'btn primary', onclick: () => startQuiz(a.quiz_id, 'wrong') }, 'حل الأسئلة الخاطئة فقط') : null,
              h('button', { class: 'btn', onclick: () => startQuiz(a.quiz_id, 'new') }, 'إعادة الاختبار كاملاً'),
              h('button', { class: 'btn ghost', onclick: () => showProgress() }, '📈 تقدمي'),
              h('button', { class: 'btn ghost', onclick: () => showHome() }, 'كل الاختبارات'))),
          UI.reviewList(a))));

    if (fresh && pct >= 80) confetti();
  }

  // ---------- Progress history ----------

  async function showProgress() {
    attempt = null;
    mount(topbar(), h('main', {}, h('div', { class: 'wrap' }, h('div', { class: 'boot', style: { minHeight: '40vh' } }, h('div', { class: 'spinner' })))));
    let data;
    try { data = await call('student.history'); } catch (e) { return; }
    me = data.me;
    mount(
      topbar(),
      h('main', {},
        h('div', { class: 'wrap' },
          h('div', { class: 'row', style: { marginBottom: '8px' } },
            h('button', { class: 'btn ghost sm', onclick: () => showHome() }, '→ الاختبارات')),
          h('h1', {}, 'تقدمي'),
          h('p', { class: 'muted' }, 'كل نتائجك السابقة محفوظة هنا، لتقارن أداءك وتتابع تحسّنك من محاولة لأخرى.'),
          UI.progressView(data.attempts, { onReview: reviewAttempt, who: 'student' }))));
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
