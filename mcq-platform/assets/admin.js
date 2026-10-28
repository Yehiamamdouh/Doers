// Teacher dashboard: students and subscriptions, quizzes and question editor, PDF import, results, settings.
(function () {
  'use strict';

  const { APP, h, mount, api, toast, themeButton, brand, modal, fmtDate, fmtDateTime, isoDate, optionLetter, textDir, randomPassword, copyText } = window.UI;
  let settings = Object.assign({}, APP.settings);
  const studentUrl = new URL('./', location.href).href;

  async function call(action, body) {
    try {
      return await api(action, body);
    } catch (err) {
      if (err.code === 'auth') showLogin();
      else if (err.code === 'csrf') location.reload();
      else toast(err.message, 'bad');
      throw err;
    }
  }

  // ---------- Setup and login ----------

  function authCard(title, lead, fields, submitText, onSubmit) {
    const error = h('div', { class: 'alert bad hidden', role: 'alert' });
    const submit = h('button', { class: 'btn primary block', type: 'submit' }, submitText);
    const form = h('form', {
      onsubmit: async (e) => {
        e.preventDefault();
        error.classList.add('hidden');
        submit.disabled = true;
        try {
          await onSubmit(form);
        } catch (err) {
          error.textContent = err.message;
          error.classList.remove('hidden');
        } finally {
          submit.disabled = false;
        }
      },
    }, error, fields, submit);
    mount(h('div', { class: 'auth' },
      h('div', { class: 'card' },
        h('div', { class: 'brand-mark', 'aria-hidden': 'true' }, '✎'),
        h('h1', {}, title),
        h('p', { class: 'lead' }, lead),
        form,
        h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '16px' } }, themeButton()))));
    const first = form.querySelector('input');
    if (first) first.focus();
  }

  function field(label, input, hint) {
    return h('label', { class: 'field' }, h('span', {}, label), input, hint ? h('div', { class: 'small muted', style: { marginTop: '4px' } }, hint) : null);
  }

  function showSetup() {
    authCard('إعداد المنصة', 'أنشئ حساب المعلم (المسؤول). هذه الخطوة تظهر مرة واحدة فقط.', [
      field('اسم المنصة', h('input', { class: 'input', name: 'platform_name', value: settings.platform_name })),
      field('اسم مستخدم المعلم', h('input', { class: 'input', name: 'username', dir: 'ltr', required: true, autocomplete: 'username' })),
      field('كلمة المرور', h('input', { class: 'input', name: 'password', type: 'password', dir: 'ltr', required: true, autocomplete: 'new-password' }), '8 أحرف على الأقل'),
    ], 'إنشاء الحساب', async (form) => {
      await api('admin.setup', { platform_name: form.platform_name.value, username: form.username.value, password: form.password.value });
      location.reload();
    });
  }

  function showLogin() {
    authCard('لوحة المعلم', 'سجّل الدخول لإدارة الطلاب والأسئلة', [
      field('اسم المستخدم', h('input', { class: 'input', name: 'username', dir: 'ltr', required: true, autocomplete: 'username' })),
      field('كلمة المرور', h('input', { class: 'input', name: 'password', type: 'password', dir: 'ltr', required: true, autocomplete: 'current-password' })),
    ], 'دخول', async (form) => {
      await api('admin.login', { username: form.username.value, password: form.password.value });
      start();
    });
  }

  // ---------- Shell and routing ----------

  const TABS = [['students', 'الطلاب والاشتراكات'], ['quizzes', 'الاختبارات والأسئلة'], ['results', 'النتائج'], ['settings', 'الإعدادات']];
  let dirty = false;
  let lastHash = location.hash;

  function shell(active, ...content) {
    mount(
      h('header', { class: 'topbar' },
        h('div', { class: 'wrap' },
          brand(settings.platform_name),
          h('span', { class: 'badge info hide-sm' }, 'لوحة المعلم'),
          h('a', { class: 'btn ghost sm hide-sm', href: studentUrl, target: '_blank', rel: 'noopener' }, 'صفحة الطلاب ↗'),
          themeButton(),
          h('button', { class: 'btn ghost sm', onclick: async () => { await api('admin.logout').catch(() => {}); showLogin(); } }, 'خروج'))),
      h('div', { class: 'wrap', style: { paddingTop: '12px' } },
        h('nav', { class: 'tabs' }, TABS.map(([key, label]) => h('button', {
          class: key === active ? 'active' : '',
          onclick: () => { location.hash = key; },
        }, label)))),
      h('main', {}, h('div', { class: 'wrap' }, content)));
  }

  function route() {
    if (dirty && location.hash !== lastHash) {
      if (!window.confirm('لديك تعديلات غير محفوظة. هل تريد المغادرة بدون حفظ؟')) {
        history.replaceState(null, '', lastHash || '#quizzes');
        return;
      }
      dirty = false;
    }
    lastHash = location.hash;
    const [page, arg] = (location.hash.slice(1) || 'students').split('/');
    if (page === 'quizzes') return showQuizzes();
    if (page === 'quiz') return showQuizEditor(arg === 'new' ? 0 : Number(arg));
    if (page === 'results') return showResults(arg ? Number(arg) : 0);
    if (page === 'settings') return showSettings();
    return showStudents();
  }
  window.addEventListener('hashchange', route);
  window.addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

  function loading(active) {
    shell(active, h('div', { class: 'boot', style: { minHeight: '40vh' } }, h('div', { class: 'spinner' })));
  }

  // ---------- Students ----------

  function statusBadge(s) {
    const sub = s.subscription;
    if (sub.state === 'suspended') return h('span', { class: 'badge bad' }, 'موقوف');
    if (sub.state === 'not_started') return h('span', { class: 'badge info' }, 'لم يبدأ بعد');
    if (sub.state === 'expired') return h('span', { class: 'badge bad' }, 'منتهي');
    if (sub.state === 'ending') return h('span', { class: 'badge warn' }, 'ينتهي خلال ' + sub.days_left + ' يوم');
    return h('span', { class: 'badge good' }, 'نشط · ' + sub.days_left + ' يوم');
  }

  function waNumber(username) {
    let d = String(username).replace(/\D/g, '');
    if (d.startsWith('00')) d = d.slice(2);
    if (/^01\d{9}$/.test(d)) d = '2' + d; // Egyptian mobile → international
    return d.length >= 10 ? d : '';
  }

  function credentialsText(name, username, password) {
    return [
      'أهلاً ' + name + ' 👋',
      'تم تفعيل حسابك على ' + settings.platform_name,
      'رابط المنصة: ' + studentUrl,
      'اسم المستخدم: ' + username,
      'كلمة المرور: ' + password,
      'مدة الاشتراك ' + settings.subscription_months + ' شهور تبدأ من أول تسجيل دخول.',
    ].join('\n');
  }

  function showCredentials(name, username, password) {
    const text = credentialsText(name, username, password);
    const wa = waNumber(username);
    modal({
      title: 'بيانات دخول الطالب',
      body: h('div', {},
        h('p', { class: 'muted' }, 'أرسل هذه البيانات للطالب. لن تظهر كلمة المرور مرة أخرى.'),
        h('textarea', { class: 'input', rows: 7, readonly: true, dir: 'auto' }, text),
        h('div', { class: 'row', style: { marginTop: '10px' } },
          h('button', { class: 'btn', type: 'button', onclick: () => copyText(text) }, 'نسخ'),
          wa ? h('a', { class: 'btn good', href: 'https://wa.me/' + wa + '?text=' + encodeURIComponent(text), target: '_blank', rel: 'noopener' }, 'إرسال عبر واتساب') : null)),
      confirmText: 'تم',
      cancelText: null,
    });
  }

  function studentForm(s) {
    const isNew = !s;
    const name = h('input', { class: 'input', name: 'name', required: true, value: s ? s.name : '' });
    const username = h('input', { class: 'input', name: 'username', dir: 'ltr', required: true, value: s ? s.username : '', placeholder: '01xxxxxxxxx' });
    const password = h('input', { class: 'input', name: 'password', dir: 'ltr', value: isNew ? randomPassword() : '', placeholder: isNew ? '' : 'اتركها فارغة لعدم التغيير' });
    const notes = h('textarea', { class: 'input', name: 'notes', rows: 2 }, s ? s.notes : '');
    modal({
      title: isNew ? 'إضافة طالب' : 'تعديل بيانات ' + s.name,
      body: h('div', {},
        field('اسم الطالب', name),
        field('اسم المستخدم (يُفضّل رقم الموبايل)', username),
        field(isNew ? 'كلمة المرور' : 'كلمة مرور جديدة', password, isNew ? 'تم توليدها تلقائياً، ويمكنك تغييرها.' : 'تغيير كلمة المرور يسجّل خروج الطالب من أجهزته.'),
        field('ملاحظات (اختياري)', notes)),
      confirmText: isNew ? 'إضافة' : 'حفظ',
      onConfirm: async () => {
        await api('admin.student.save', { id: s ? s.id : 0, name: name.value, username: username.value, password: password.value, notes: notes.value });
        if (isNew || password.value) showCredentials(name.value.trim(), username.value.replace(/\s+/g, ''), password.value);
        else toast('تم الحفظ');
        showStudents();
      },
    });
  }

  function bulkAdd() {
    const area = h('textarea', { class: 'input code', rows: 10, dir: 'auto', placeholder: 'أحمد محمد, 01012345678\nسارة علي, 01198765432' });
    modal({
      title: 'إضافة مجموعة طلاب',
      wide: true,
      body: h('div', {},
        h('p', { class: 'muted' }, 'اكتب كل طالب في سطر: الاسم ثم فاصلة ثم رقم الموبايل (أو اسم المستخدم). سيتم توليد كلمة مرور لكل طالب.'),
        area),
      confirmText: 'إضافة الكل',
      onConfirm: async () => {
        const rows = area.value.split('\n').map((l) => l.split(/[,،\t;]/).map((x) => x.trim())).filter((r) => r[0] && r[1]);
        if (!rows.length) throw new Error('لم يتم العثور على أي طالب. استخدم الصيغة: الاسم, الرقم');
        const done = [];
        const failed = [];
        for (const [name, username] of rows) {
          const password = randomPassword();
          try {
            await api('admin.student.save', { name, username, password });
            done.push({ name, username: username.replace(/\s+/g, ''), password });
          } catch (err) {
            failed.push(name + ' (' + err.message + ')');
          }
        }
        const text = done.map((d) => d.name + ' | ' + d.username + ' | ' + d.password).join('\n');
        setTimeout(() => modal({
          title: 'تمت إضافة ' + done.length + ' طالب',
          wide: true,
          body: h('div', {},
            failed.length ? h('div', { class: 'alert bad' }, 'لم تتم إضافة: ' + failed.join('، ')) : null,
            done.length ? h('div', { class: 'table-wrap' }, h('table', {},
              h('thead', {}, h('tr', {}, h('th', {}, 'الاسم'), h('th', {}, 'اسم المستخدم'), h('th', {}, 'كلمة المرور'), h('th', {}, ''))),
              h('tbody', {}, done.map((d) => {
                const wa = waNumber(d.username);
                return h('tr', {}, h('td', {}, d.name), h('td', { dir: 'ltr' }, d.username), h('td', { dir: 'ltr' }, d.password),
                  h('td', {}, wa ? h('a', { class: 'btn sm good', href: 'https://wa.me/' + wa + '?text=' + encodeURIComponent(credentialsText(d.name, d.username, d.password)), target: '_blank', rel: 'noopener' }, 'واتساب') : null));
              })))) : null,
            done.length ? h('button', { class: 'btn', type: 'button', style: { marginTop: '10px' }, onclick: () => copyText(text) }, 'نسخ الكل') : null),
          confirmText: 'تم',
          cancelText: null,
        }), 0);
        showStudents();
      },
    });
  }

  async function studentAction(s, action, value) {
    await call('admin.student.action', { id: s.id, action, value });
  }

  function manageStudent(s) {
    const months = settings.subscription_months;
    const sub = s.subscription;
    const dateInput = h('input', { class: 'input', type: 'date', value: sub.expires_at ? isoDate(sub.expires_at) : '', style: { maxWidth: '200px' } });
    const act = async (action, value, confirmText) => {
      if (confirmText && !window.confirm(confirmText)) return;
      try {
        await studentAction(s, action, value);
        toast('تم');
        document.querySelector('.modal-backdrop')?.remove();
        showStudents();
      } catch (e) { /* toast shown */ }
    };
    const info = (label, value) => h('div', {}, h('div', { class: 'small muted' }, label), h('div', { style: { fontWeight: 700 } }, value));
    modal({
      title: s.name,
      wide: true,
      body: h('div', { class: 'stack' },
        h('div', { class: 'row' }, statusBadge(s), h('span', { class: 'muted', dir: 'ltr' }, s.username)),
        h('div', { class: 'kpis', style: { marginBottom: 0 } },
          info('أول دخول (بداية الاشتراك)', sub.first_login_at ? fmtDateTime(sub.first_login_at) : 'لم يدخل بعد'),
          info('نهاية الاشتراك', sub.expires_at ? fmtDate(sub.expires_at) : 'تبدأ مع أول دخول'),
          info('آخر دخول', s.last_login_at ? fmtDateTime(s.last_login_at) : '—'),
          info('الاختبارات المكتملة', s.attempts + (s.avg_pct !== null ? ' · متوسط ' + s.avg_pct + '%' : ''))),
        s.notes ? h('div', { class: 'alert' }, s.notes) : null,
        h('div', { class: 'card flat' },
          h('h3', {}, 'الاشتراك'),
          h('div', { class: 'row' },
            h('button', { class: 'btn good', type: 'button', onclick: () => act('renew') }, 'تجديد ' + months + ' شهور'),
            h('button', { class: 'btn danger', type: 'button', onclick: () => act('expire', null, 'إنهاء اشتراك ' + s.name + ' الآن؟ لن يتمكن من الدخول حتى التجديد.') }, 'إنهاء الاشتراك الآن'),
            h('button', { class: 'btn', type: 'button', onclick: () => act('reset', null, 'إعادة ضبط الاشتراك؟ سيبدأ عدّ ' + months + ' شهور من جديد عند أول دخول قادم.') }, 'إعادة ضبط (يبدأ من الدخول القادم)')),
          h('div', { class: 'row', style: { marginTop: '12px' } },
            h('span', {}, 'أو حدّد تاريخ الانتهاء يدوياً:'),
            dateInput,
            h('button', { class: 'btn', type: 'button', onclick: () => dateInput.value ? act('set_expiry', dateInput.value) : toast('اختر تاريخاً', 'bad') }, 'حفظ التاريخ')),
          h('p', { class: 'small muted', style: { marginTop: '10px', marginBottom: 0 } }, 'التجديد يضيف ' + months + ' شهور من تاريخ الانتهاء الحالي، أو من اليوم إذا كان الاشتراك منتهياً.')),
        h('div', { class: 'card flat' },
          h('h3', {}, 'الحساب'),
          h('div', { class: 'row' },
            h('button', { class: 'btn', type: 'button', onclick: () => { document.querySelector('.modal-backdrop')?.remove(); studentForm(s); } }, 'تعديل البيانات / كلمة المرور'),
            h('button', { class: 'btn', type: 'button', onclick: () => { document.querySelector('.modal-backdrop')?.remove(); location.hash = 'results/' + s.id; } }, 'عرض النتائج'),
            h('button', { class: 'btn', type: 'button', onclick: () => act('logout') }, 'تسجيل خروج من كل الأجهزة'),
            s.active
              ? h('button', { class: 'btn danger', type: 'button', onclick: () => act('suspend', null, 'إيقاف حساب ' + s.name + '؟') }, 'إيقاف الحساب')
              : h('button', { class: 'btn good', type: 'button', onclick: () => act('activate') }, 'تفعيل الحساب'),
            h('button', { class: 'btn danger', type: 'button', onclick: () => act('delete', null, 'حذف ' + s.name + ' وكل نتائجه نهائياً؟') }, 'حذف الطالب')))),
      confirmText: 'إغلاق',
      cancelText: null,
    });
  }

  let studentFilter = { q: '', state: 'all' };

  async function showStudents() {
    loading('students');
    let data;
    try { data = await call('admin.students'); } catch (e) { return; }
    const students = data.students;
    const count = (st) => students.filter((s) => s.subscription.state === st).length;

    const tbody = h('tbody');
    const paint = () => {
      const q = studentFilter.q.trim().toLowerCase();
      const rows = students.filter((s) =>
        (studentFilter.state === 'all' || s.subscription.state === studentFilter.state || (studentFilter.state === 'active' && s.subscription.state === 'ending')) &&
        (!q || s.name.toLowerCase().includes(q) || s.username.toLowerCase().includes(q)));
      tbody.replaceChildren(...rows.map((s) => h('tr', {},
        h('td', {}, h('div', { style: { fontWeight: 700 } }, s.name), s.notes ? h('div', { class: 'small muted' }, s.notes.slice(0, 60)) : null),
        h('td', { dir: 'ltr', style: { textAlign: 'right' } }, s.username),
        h('td', {}, statusBadge(s)),
        h('td', { class: 'small' }, s.subscription.first_login_at ? fmtDate(s.subscription.first_login_at) : '—'),
        h('td', { class: 'small' }, s.subscription.expires_at ? fmtDate(s.subscription.expires_at) : '—'),
        h('td', { class: 'small' }, s.attempts ? s.attempts + ' · ' + s.avg_pct + '%' : '—'),
        h('td', {}, h('div', { class: 'row' },
          h('button', { class: 'btn sm good', onclick: async () => { try { await studentAction(s, 'renew'); toast('تم تجديد اشتراك ' + s.name); showStudents(); } catch (e) { /* shown */ } } }, 'تجديد'),
          h('button', { class: 'btn sm', onclick: () => manageStudent(s) }, 'إدارة'))))));
      if (!rows.length) tbody.append(h('tr', {}, h('td', { colspan: 7, class: 'empty' }, students.length ? 'لا توجد نتائج مطابقة.' : 'لا يوجد طلاب بعد. ابدأ بإضافة أول طالب.')));
    };
    paint();

    const kpi = (label, value, state) => h('button', {
      class: 'kpi', type: 'button', style: { cursor: 'pointer', textAlign: 'start', font: 'inherit', color: 'inherit' },
      onclick: () => { studentFilter.state = state; filterSelect.value = state; paint(); },
    }, h('b', {}, value), h('span', { class: 'small muted' }, label));

    const filterSelect = h('select', { class: 'input', style: { maxWidth: '200px' }, onchange: (e) => { studentFilter.state = e.target.value; paint(); } },
      [['all', 'كل الطلاب'], ['active', 'نشط'], ['ending', 'ينتهي قريباً'], ['expired', 'منتهي'], ['not_started', 'لم يبدأ'], ['suspended', 'موقوف']]
        .map(([v, l]) => h('option', { value: v, selected: v === studentFilter.state }, l)));

    shell('students',
      h('div', { class: 'kpis' },
        kpi('إجمالي الطلاب', students.length, 'all'),
        kpi('اشتراك نشط', count('active') + count('ending'), 'active'),
        kpi('ينتهي خلال ' + settings.warn_days + ' أيام', count('ending'), 'ending'),
        kpi('منتهي', count('expired'), 'expired'),
        kpi('لم يبدأ بعد', count('not_started'), 'not_started')),
      h('div', { class: 'toolbar' },
        h('input', { class: 'input', type: 'search', placeholder: 'بحث بالاسم أو الرقم…', value: studentFilter.q, oninput: (e) => { studentFilter.q = e.target.value; paint(); } }),
        filterSelect,
        h('span', { class: 'spacer' }),
        h('button', { class: 'btn', onclick: bulkAdd }, 'إضافة مجموعة'),
        h('button', { class: 'btn primary', onclick: () => studentForm(null) }, '+ إضافة طالب')),
      h('div', { class: 'table-wrap' }, h('table', {},
        h('thead', {}, h('tr', {}, ['الطالب', 'اسم المستخدم', 'الحالة', 'بداية الاشتراك', 'نهاية الاشتراك', 'اختبارات · متوسط', ''].map((t) => h('th', {}, t)))),
        tbody)),
      h('p', { class: 'small muted', style: { marginTop: '12px' } }, 'يبدأ اشتراك كل طالب (' + settings.subscription_months + ' شهور) تلقائياً من أول تسجيل دخول، ويُغلق حسابه تلقائياً عند انتهاء المدة حتى تجدده.'));
  }

  // ---------- Quizzes ----------

  async function showQuizzes() {
    loading('quizzes');
    let data;
    try { data = await call('admin.quizzes'); } catch (e) { return; }
    const quizzes = data.quizzes;
    const rows = quizzes.map((q, i) => h('tr', {},
      h('td', {}, h('a', { href: '#quiz/' + q.id, style: { fontWeight: 700 }, dir: 'auto' }, q.title), q.description ? h('div', { class: 'small muted', dir: 'auto' }, q.description.slice(0, 80)) : null),
      h('td', {}, q.total),
      h('td', {}, h('label', { class: 'check' },
        h('input', { type: 'checkbox', checked: !!q.published, onchange: async (e) => {
          try { await call('admin.quiz.publish', { id: q.id, published: e.target.checked }); toast(e.target.checked ? 'الاختبار ظاهر للطلاب' : 'تم إخفاء الاختبار'); } catch (err) { e.target.checked = !e.target.checked; }
        } }),
        h('span', { class: 'small' }, 'ظاهر'))),
      h('td', {}, q.attempts),
      h('td', {}, h('div', { class: 'row' },
        h('a', { class: 'btn sm primary', href: '#quiz/' + q.id }, 'تعديل الأسئلة'),
        h('button', { class: 'btn sm ghost', disabled: i === 0, title: 'تحريك لأعلى', onclick: async () => { await call('admin.quiz.move', { id: q.id, dir: -1 }).catch(() => {}); showQuizzes(); } }, '↑'),
        h('button', { class: 'btn sm ghost', disabled: i === quizzes.length - 1, title: 'تحريك لأسفل', onclick: async () => { await call('admin.quiz.move', { id: q.id, dir: 1 }).catch(() => {}); showQuizzes(); } }, '↓'),
        h('button', { class: 'btn sm danger', onclick: async () => {
          if (!window.confirm('حذف "' + q.title + '" بكل أسئلته ونتائج الطلاب فيه؟')) return;
          await call('admin.quiz.delete', { id: q.id }).catch(() => {});
          showQuizzes();
        } }, 'حذف')))));

    shell('quizzes',
      h('div', { class: 'toolbar' },
        h('h1', { class: 'spacer', style: { margin: 0 } }, 'الاختبارات'),
        h('a', { class: 'btn primary', href: '#quiz/new' }, '+ اختبار جديد')),
      quizzes.length
        ? h('div', { class: 'table-wrap' }, h('table', {},
          h('thead', {}, h('tr', {}, ['الاختبار', 'الأسئلة', 'الحالة', 'محاولات', ''].map((t) => h('th', {}, t)))),
          h('tbody', {}, rows)))
        : h('div', { class: 'card empty' }, h('div', { class: 'big' }, '📝'),
          h('p', {}, 'لا توجد اختبارات بعد. أنشئ اختباراً ثم ارفع ملف PDF بالأسئلة أو الصقها.'),
          h('a', { class: 'btn primary', href: '#quiz/new' }, 'إنشاء أول اختبار')));
  }

  // ---------- Quiz editor ----------

  let quiz = null;

  async function showQuizEditor(id) {
    dirty = false;
    if (id) {
      loading('quizzes');
      try { quiz = (await call('admin.quiz.get', { id })).quiz; } catch (e) { return; }
    } else {
      quiz = { id: 0, title: '', description: '', published: 1, questions: [] };
    }
    renderEditor();
  }

  function markDirty() {
    dirty = true;
    const s = document.getElementById('save-state');
    if (s) { s.textContent = 'تعديلات غير محفوظة'; s.className = 'badge warn'; }
  }

  function blankQuestion() {
    return { id: 0, text: '', options: ['', '', '', ''], correct: -1, explanation: '' };
  }

  function questionEditor(q, i) {
    const name = 'correct-' + i + '-' + Math.random().toString(36).slice(2, 7);
    const invalid = !q.text.trim() || q.options.filter((o) => o.trim()).length < 2 || q.correct < 0 || !String(q.options[q.correct] || '').trim();
    const optionRows = q.options.map((opt, oi) => h('div', { class: 'opt-row' },
      h('input', { type: 'radio', name, checked: q.correct === oi, title: 'الإجابة الصحيحة', onchange: () => { q.correct = oi; markDirty(); renderEditor(true); } }),
      h('span', { class: 'badge' }, optionLetter(oi, q.text)),
      h('input', { class: 'input', value: opt, dir: 'auto', placeholder: 'اختيار ' + (oi + 1), oninput: (e) => { q.options[oi] = e.target.value; markDirty(); } }),
      h('button', { class: 'btn sm ghost', type: 'button', title: 'حذف الاختيار', disabled: q.options.length <= 2, onclick: () => {
        q.options.splice(oi, 1);
        if (q.correct === oi) q.correct = -1; else if (q.correct > oi) q.correct--;
        markDirty(); renderEditor(true);
      } }, '✕')));

    return h('article', { class: 'card q-edit' + (invalid ? ' invalid' : ''), id: 'q-' + i },
      h('div', { class: 'q-edit-head' },
        h('b', {}, 'السؤال ' + (i + 1)),
        invalid ? h('span', { class: 'badge bad' }, q.correct < 0 ? 'حدّد الإجابة الصحيحة' : 'غير مكتمل') : null,
        h('span', { class: 'spacer' }),
        h('button', { class: 'btn sm ghost', type: 'button', disabled: i === 0, title: 'لأعلى', onclick: () => { quiz.questions.splice(i - 1, 0, quiz.questions.splice(i, 1)[0]); markDirty(); renderEditor(true); } }, '↑'),
        h('button', { class: 'btn sm ghost', type: 'button', disabled: i === quiz.questions.length - 1, title: 'لأسفل', onclick: () => { quiz.questions.splice(i + 1, 0, quiz.questions.splice(i, 1)[0]); markDirty(); renderEditor(true); } }, '↓'),
        h('button', { class: 'btn sm danger', type: 'button', onclick: () => { if (window.confirm('حذف السؤال ' + (i + 1) + '؟')) { quiz.questions.splice(i, 1); markDirty(); renderEditor(true); } } }, 'حذف')),
      h('textarea', { class: 'input', rows: 2, dir: 'auto', placeholder: 'نص السؤال', oninput: (e) => { q.text = e.target.value; markDirty(); } }, q.text),
      h('div', { class: 'small muted', style: { margin: '10px 0 6px' } }, 'الاختيارات — اضغط الدائرة بجانب الإجابة الصحيحة'),
      optionRows,
      q.options.length < 10 ? h('button', { class: 'btn sm ghost', type: 'button', onclick: () => { q.options.push(''); markDirty(); renderEditor(true); } }, '+ إضافة اختيار') : null,
      h('div', { class: 'small muted', style: { margin: '10px 0 6px' } }, 'الشرح (يظهر للطالب بعد الإجابة)'),
      h('textarea', { class: 'input', rows: 2, dir: 'auto', placeholder: 'شرح الإجابة الصحيحة (اختياري)', oninput: (e) => { q.explanation = e.target.value; markDirty(); } }, q.explanation));
  }

  function renderEditor(keepScroll) {
    const y = window.scrollY;
    const title = h('input', { class: 'input', value: quiz.title, dir: 'auto', placeholder: 'مثال: الوبائيات — الفصل الأول', oninput: (e) => { quiz.title = e.target.value; markDirty(); } });
    const desc = h('input', { class: 'input', value: quiz.description, dir: 'auto', placeholder: 'وصف قصير يظهر للطالب (اختياري)', oninput: (e) => { quiz.description = e.target.value; markDirty(); } });
    const invalidCount = quiz.questions.filter((q) => !q.text.trim() || q.options.filter((o) => o.trim()).length < 2 || q.correct < 0).length;

    shell('quizzes',
      h('div', { class: 'toolbar' },
        h('a', { class: 'btn ghost sm', href: '#quizzes' }, '→ كل الاختبارات'),
        h('span', { class: 'spacer' }),
        h('span', { id: 'save-state', class: dirty ? 'badge warn' : 'badge' }, dirty ? 'تعديلات غير محفوظة' : (quiz.id ? 'محفوظ' : 'اختبار جديد')),
        h('button', { class: 'btn primary', onclick: saveQuiz }, 'حفظ الاختبار')),
      h('div', { class: 'card', style: { marginBottom: '16px' } },
        field('عنوان الاختبار', title),
        field('الوصف', desc),
        h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !!quiz.published, onchange: (e) => { quiz.published = e.target.checked ? 1 : 0; markDirty(); } }), 'ظاهر للطلاب')),
      h('div', { class: 'toolbar' },
        h('h2', { class: 'spacer', style: { margin: 0 } }, 'الأسئلة (' + quiz.questions.length + ')'),
        h('button', { class: 'btn primary', onclick: openImport }, '📄 استيراد من PDF أو نص'),
        h('button', { class: 'btn', onclick: () => { quiz.questions.push(blankQuestion()); markDirty(); renderEditor(true); setTimeout(() => document.getElementById('q-' + (quiz.questions.length - 1))?.scrollIntoView({ behavior: 'smooth' }), 50); } }, '+ سؤال يدوي'),
        h('button', { class: 'btn ghost', onclick: exportJson, disabled: !quiz.questions.length }, 'تصدير JSON'),
        h('button', { class: 'btn ghost', onclick: importJson }, 'استيراد JSON')),
      invalidCount ? h('div', { class: 'alert warn' }, invalidCount + ' سؤال يحتاج مراجعة (بدون إجابة صحيحة أو اختيارات ناقصة). الأسئلة المعلّمة بالأحمر.') : null,
      quiz.questions.length
        ? h('div', { class: 'stack' }, quiz.questions.map(questionEditor))
        : h('div', { class: 'card empty' }, h('div', { class: 'big' }, '📄'), h('p', {}, 'ارفع ملف PDF بالأسئلة أو الصق نصها، وسيتم تحويلها تلقائياً إلى أسئلة تفاعلية.'),
          h('button', { class: 'btn primary', onclick: openImport }, 'استيراد الأسئلة')),
      quiz.questions.length > 3 ? h('div', { class: 'row', style: { marginTop: '16px', justifyContent: 'flex-end' } }, h('button', { class: 'btn primary', onclick: saveQuiz }, 'حفظ الاختبار')) : null);
    if (keepScroll) window.scrollTo(0, y);
  }

  async function saveQuiz() {
    const questions = quiz.questions.map((q) => {
      // Drop empty options and remap the correct answer to the remaining ones.
      const kept = q.options.map((o, i) => ({ o: o.trim(), i })).filter((x) => x.o);
      return { id: q.id || 0, text: q.text, options: kept.map((x) => x.o), correct: kept.findIndex((x) => x.i === q.correct), explanation: q.explanation };
    });
    try {
      const res = await call('admin.quiz.save', { id: quiz.id, title: quiz.title, description: quiz.description, published: quiz.published, questions });
      dirty = false;
      toast('تم حفظ الاختبار');
      if (!quiz.id) {
        lastHash = '#quiz/' + res.id;
        location.hash = 'quiz/' + res.id;
      } else {
        showQuizEditor(quiz.id);
      }
    } catch (e) { /* toast shown */ }
  }

  function exportJson() {
    const data = {
      title: quiz.title,
      description: quiz.description,
      questions: quiz.questions.map((q) => ({ text: q.text, options: q.options, correct: q.correct, explanation: q.explanation })),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: (quiz.title || 'quiz').replace(/[\\/:*?"<>|]+/g, '-') + '.json' });
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  function importJson() {
    const input = h('input', { type: 'file', accept: '.json,application/json' });
    input.addEventListener('change', async () => {
      const file = input.files[0];
      if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        const list = Array.isArray(data) ? data : data.questions;
        if (!Array.isArray(list)) throw new Error();
        const added = list.map((q) => ({
          id: 0,
          text: String(q.text || q.question || ''),
          options: (q.options || q.choices || []).map(String),
          correct: Number.isInteger(q.correct) ? q.correct : Number.isInteger(q.answer) ? q.answer : -1,
          explanation: String(q.explanation || ''),
        }));
        if (!quiz.title && data.title) quiz.title = data.title;
        quiz.questions.push(...added);
        markDirty();
        renderEditor();
        toast('تمت إضافة ' + added.length + ' سؤال — لا تنسَ الحفظ');
      } catch (e) {
        toast('الملف غير صالح. استخدم ملف JSON مُصدَّر من المنصة.', 'bad');
      }
    });
    input.click();
  }

  // ---------- Import from PDF / text ----------

  const PDFJS = 'assets/vendor/pdfjs/'; // self-hosted pdf.js 3.11.174
  let pdfjsReady = null;

  function loadPdfJs() {
    if (!pdfjsReady) {
      pdfjsReady = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = PDFJS + 'pdf.min.js';
        s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js'; resolve(window.pdfjsLib); };
        s.onerror = () => { pdfjsReady = null; reject(new Error('تعذّر تحميل قارئ PDF.')); };
        document.head.appendChild(s);
      });
    }
    return pdfjsReady;
  }

  async function pdfToText(file, onProgress) {
    const pdfjs = await loadPdfJs();
    const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    const pages = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      onProgress(p, pdf.numPages);
      const content = await (await pdf.getPage(p)).getTextContent();
      let text = '';
      let lastY = null;
      for (const item of content.items) {
        const y = item.transform ? Math.round(item.transform[5]) : null;
        if (lastY !== null && y !== null && Math.abs(y - lastY) > 2 && !text.endsWith('\n')) text += '\n';
        text += item.str;
        if (item.hasEOL) text += '\n';
        if (y !== null) lastY = y;
      }
      pages.push(text);
    }
    return pages.join('\n');
  }

  function openImport() {
    const status = h('div', { class: 'small muted' });
    const source = h('textarea', { class: 'input code', dir: 'auto', placeholder: 'الصق نص الأسئلة هنا، أو اختر ملف PDF بالأعلى…\n\n1. What is the powerhouse of the cell?\nA) Nucleus\nB) Mitochondria\nC) Ribosome\nD) Golgi\nAnswer: B\nExplanation: Mitochondria produce ATP.' });
    const key = h('textarea', { class: 'input', rows: 3, dir: 'ltr', placeholder: '1-B  2-C  3-A  4-D …' });
    const fileInput = h('input', { type: 'file', accept: '.pdf,.txt,application/pdf,text/plain', class: 'input' });
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files[0];
      if (!file) return;
      status.textContent = 'جاري قراءة الملف…';
      try {
        if (/\.pdf$/i.test(file.name) || file.type === 'application/pdf') {
          source.value = await pdfToText(file, (p, n) => { status.textContent = 'جاري قراءة صفحة ' + p + ' من ' + n + '…'; });
        } else {
          source.value = await file.text();
        }
        status.textContent = source.value.trim()
          ? 'تمت قراءة الملف. راجع النص بسرعة ثم اضغط "تحليل الأسئلة".'
          : 'لم يتم العثور على نص في الملف. غالباً الملف عبارة عن صور (سكان)، استخدم أداة OCR أولاً ثم الصق النص.';
      } catch (err) {
        status.textContent = err.message || 'تعذّرت قراءة الملف.';
      }
    });

    const preview = h('div', { class: 'parsed-list stack' });
    const stepInput = h('div', {},
      h('div', { class: 'alert' }, 'ارفع ملف PDF (يحتوي على نص وليس صوراً) أو الصق الأسئلة. يتعرف النظام على: ترقيم الأسئلة، الاختيارات (A-D أو أ-د)، سطر "Answer:" أو "الإجابة:"، علامة * بجانب الإجابة الصحيحة، سطر "Explanation:" أو "الشرح:"، ومفتاح الإجابات في آخر الملف.'),
      field('ملف PDF أو TXT', fileInput),
      status,
      field('نص الأسئلة', source),
      h('details', {}, h('summary', { style: { cursor: 'pointer', fontWeight: 600 } }, 'مفتاح الإجابات منفصل؟ (اختياري)'),
        h('p', { class: 'small muted' }, 'لو الإجابات مكتوبة في جدول أو صفحة منفصلة، الصقها هنا بأي شكل مثل: 1-B 2-C 3-A'), key));
    const stepPreview = h('div', { class: 'hidden' }, preview);

    let parsed = [];
    const backdrop = h('div', { class: 'modal-backdrop' });
    const close = () => backdrop.remove();
    const btnParse = h('button', { class: 'btn primary', type: 'button' }, 'تحليل الأسئلة');
    const btnBack = h('button', { class: 'btn hidden', type: 'button' }, 'رجوع للنص');
    const btnAdd = h('button', { class: 'btn primary hidden', type: 'button' }, 'إضافة للاختبار');

    btnParse.addEventListener('click', () => {
      const all = window.MCQParser.parse(source.value, key.value);
      // Titles, headers and other text without options are not questions.
      parsed = all.filter((q) => q.options.length > 0);
      const skipped = all.length - parsed.length;
      if (!parsed.length) { toast('لم يتم العثور على أسئلة. تأكد من ترقيم الأسئلة والاختيارات.', 'bad'); return; }
      const needFix = parsed.filter((q) => q.warnings.length).length;
      preview.replaceChildren(
        h('div', { class: 'alert ' + (needFix ? 'warn' : 'good') },
          'تم استخراج ' + parsed.length + ' سؤال' + (needFix ? ' — ' + needFix + ' منها يحتاج مراجعة (يمكنك تعديلها بعد الإضافة).' : ' بنجاح ✓'),
          skipped ? h('div', { class: 'small' }, 'تم تجاهل ' + skipped + ' فقرة بدون اختيارات (مثل العناوين). لو كانت سؤالاً، عدّل النص وأعد التحليل.') : null),
        ...parsed.map((q, i) => h('div', { class: 'card flat' + (q.warnings.length ? ' q-edit invalid' : '') },
          h('div', { class: 'row' }, h('b', {}, (i + 1) + '.'), q.warnings.map((w) => h('span', { class: 'badge bad' }, w))),
          h('div', { dir: textDir(q.text), style: { fontWeight: 600 } }, q.text),
          h('ol', { type: 'A', dir: textDir(q.text) }, q.options.map((o, oi) => h('li', { class: oi === q.correct ? 'is-correct' : '' }, o + (oi === q.correct ? ' ✓' : '')))),
          q.explanation ? h('div', { class: 'small muted' }, 'الشرح: ', h('bdi', {}, q.explanation)) : null)));
      stepInput.classList.add('hidden');
      stepPreview.classList.remove('hidden');
      btnParse.classList.add('hidden');
      btnBack.classList.remove('hidden');
      btnAdd.classList.remove('hidden');
      btnAdd.textContent = 'إضافة ' + parsed.length + ' سؤال للاختبار';
      backdrop.querySelector('.modal').scrollTop = 0;
    });
    btnBack.addEventListener('click', () => {
      stepInput.classList.remove('hidden');
      stepPreview.classList.add('hidden');
      btnParse.classList.remove('hidden');
      btnBack.classList.add('hidden');
      btnAdd.classList.add('hidden');
    });
    btnAdd.addEventListener('click', () => {
      quiz.questions.push(...parsed.map((q) => ({
        id: 0,
        text: q.text,
        options: q.options.length ? q.options : ['', ''],
        correct: q.correct,
        explanation: q.explanation,
      })));
      close();
      markDirty();
      renderEditor();
      toast('تمت إضافة ' + parsed.length + ' سؤال — راجعها ثم اضغط حفظ');
    });

    backdrop.append(h('div', { class: 'modal wide' },
      h('h2', {}, 'استيراد الأسئلة من PDF أو نص'),
      stepInput, stepPreview,
      h('div', { class: 'modal-actions' }, h('button', { class: 'btn', type: 'button', onclick: close }, 'إلغاء'), btnBack, btnParse, btnAdd)));
    document.body.appendChild(backdrop);
  }

  // ---------- Results ----------

  async function showResults(studentId) {
    loading('results');
    let results, students, quizzes;
    try {
      [results, students, quizzes] = await Promise.all([
        call('admin.results', { student_id: studentId }).then((r) => r.results),
        call('admin.students').then((r) => r.students),
        call('admin.quizzes').then((r) => r.quizzes),
      ]);
    } catch (e) { return; }
    let quizFilter = 0;
    const tbody = h('tbody');
    const kpis = h('div', { class: 'kpis' });
    const visible = () => results.filter((r) => !quizFilter || r.quiz_id === quizFilter);
    const paint = () => {
      const rows = visible();
      const avg = rows.length ? Math.round(rows.reduce((s, r) => s + r.pct, 0) / rows.length) : 0;
      kpis.replaceChildren(
        h('div', { class: 'kpi' }, h('b', {}, rows.length), h('span', { class: 'small muted' }, 'محاولة مكتملة')),
        h('div', { class: 'kpi' }, h('b', {}, rows.length ? avg + '%' : '—'), h('span', { class: 'small muted' }, 'متوسط الدرجات')),
        h('div', { class: 'kpi' }, h('b', {}, new Set(rows.map((r) => r.student_id)).size), h('span', { class: 'small muted' }, 'طالب')));
      tbody.replaceChildren(...rows.map((r) => h('tr', {},
        h('td', {}, h('a', { href: '#results/' + r.student_id }, r.student)),
        h('td', { dir: 'auto' }, r.quiz),
        h('td', {}, r.correct + ' / ' + r.total),
        h('td', {}, h('span', { class: 'badge ' + (r.pct >= 75 ? 'good' : r.pct >= 50 ? 'warn' : 'bad') }, r.pct + '%')),
        h('td', { class: 'small' }, fmtDateTime(r.finished_at)),
        h('td', { class: 'small' }, r.minutes + ' دقيقة'))));
      if (!rows.length) tbody.append(h('tr', {}, h('td', { colspan: 6, class: 'empty' }, 'لا توجد نتائج بعد.')));
    };
    paint();

    const exportCsv = () => {
      const lines = [['الطالب', 'الاختبار', 'الصحيحة', 'الإجمالي', 'النسبة', 'التاريخ']]
        .concat(visible().map((r) => [r.student, r.quiz, r.correct, r.total, r.pct + '%', fmtDateTime(r.finished_at)]))
        .map((row) => row.map((v) => '"' + String(v).replace(/"/g, '""') + '"').join(','));
      const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
      const a = h('a', { href: URL.createObjectURL(blob), download: 'results.csv' });
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    };

    shell('results',
      h('div', { class: 'toolbar' },
        h('select', { class: 'input', style: { maxWidth: '240px' }, onchange: (e) => { location.hash = e.target.value ? 'results/' + e.target.value : 'results'; } },
          h('option', { value: '' }, 'كل الطلاب'),
          students.map((s) => h('option', { value: s.id, selected: s.id === studentId }, s.name))),
        h('select', { class: 'input', style: { maxWidth: '240px' }, onchange: (e) => { quizFilter = Number(e.target.value); paint(); } },
          h('option', { value: 0 }, 'كل الاختبارات'),
          quizzes.map((q) => h('option', { value: q.id }, q.title))),
        h('span', { class: 'spacer' }),
        h('button', { class: 'btn', onclick: exportCsv }, 'تصدير Excel (CSV)')),
      kpis,
      h('div', { class: 'table-wrap' }, h('table', {},
        h('thead', {}, h('tr', {}, ['الطالب', 'الاختبار', 'الدرجة', 'النسبة', 'التاريخ', 'المدة'].map((t) => h('th', {}, t)))),
        tbody)));
  }

  // ---------- Settings ----------

  function showSettings() {
    const f = {
      platform_name: h('input', { class: 'input', value: settings.platform_name }),
      subscription_months: h('input', { class: 'input', type: 'number', min: 1, max: 36, value: settings.subscription_months, style: { maxWidth: '140px' } }),
      warn_days: h('input', { class: 'input', type: 'number', min: 0, max: 60, value: settings.warn_days, style: { maxWidth: '140px' } }),
      contact_whatsapp: h('input', { class: 'input', dir: 'ltr', value: settings.contact_whatsapp, placeholder: '201012345678' }),
      expired_message: h('textarea', { class: 'input', rows: 3 }, settings.expired_message),
      single_device: h('input', { type: 'checkbox', checked: settings.single_device === '1' }),
    };
    const cur = h('input', { class: 'input', type: 'password', dir: 'ltr', autocomplete: 'current-password' });
    const neu = h('input', { class: 'input', type: 'password', dir: 'ltr', autocomplete: 'new-password' });

    shell('settings',
      h('div', { class: 'stack', style: { maxWidth: '720px' } },
        h('div', { class: 'card' },
          h('h2', {}, 'رابط المنصة للطلاب'),
          h('div', { class: 'row' }, h('code', { dir: 'ltr', style: { wordBreak: 'break-all' } }, studentUrl), h('button', { class: 'btn sm', onclick: () => copyText(studentUrl) }, 'نسخ'))),
        h('form', { class: 'card', onsubmit: async (e) => {
          e.preventDefault();
          const values = {
            platform_name: f.platform_name.value,
            subscription_months: f.subscription_months.value,
            warn_days: f.warn_days.value,
            contact_whatsapp: f.contact_whatsapp.value,
            expired_message: f.expired_message.value,
            single_device: f.single_device.checked,
          };
          try {
            await call('admin.settings.save', { settings: values });
            settings = (await call('admin.me')).settings;
            toast('تم حفظ الإعدادات');
            showSettings();
          } catch (err) { /* shown */ }
        } },
          h('h2', {}, 'إعدادات المنصة'),
          field('اسم المنصة', f.platform_name),
          field('مدة الاشتراك (بالشهور)', f.subscription_months, 'تبدأ من أول تسجيل دخول للطالب. التغيير يُطبّق على الاشتراكات الجديدة والتجديدات القادمة.'),
          field('تنبيه قرب الانتهاء قبل (أيام)', f.warn_days),
          field('رقم واتساب للتجديد', f.contact_whatsapp, 'بالصيغة الدولية بدون + (مثال 201012345678). يظهر للطالب زر واتساب عند انتهاء اشتراكه.'),
          field('رسالة انتهاء الاشتراك', f.expired_message),
          h('label', { class: 'check', style: { marginBottom: '16px' } }, f.single_device, 'جهاز واحد لكل طالب (الدخول من جهاز جديد يُخرج الجهاز القديم، لمنع مشاركة الحساب)'),
          h('div', {}, h('button', { class: 'btn primary', type: 'submit' }, 'حفظ الإعدادات'))),
        h('form', { class: 'card', onsubmit: async (e) => {
          e.preventDefault();
          try {
            await call('admin.password', { current: cur.value, new: neu.value });
            cur.value = neu.value = '';
            toast('تم تغيير كلمة المرور');
          } catch (err) { /* shown */ }
        } },
          h('h2', {}, 'تغيير كلمة مرور المعلم'),
          field('كلمة المرور الحالية', cur),
          field('كلمة المرور الجديدة', neu, '8 أحرف على الأقل'),
          h('button', { class: 'btn', type: 'submit' }, 'تغيير'))));
  }

  // ---------- Boot ----------

  async function start() {
    try {
      const res = await api('admin.me');
      settings = res.settings;
      route();
    } catch (err) {
      showLogin();
    }
  }

  (async function boot() {
    try {
      const status = await api('admin.status');
      if (status.needs_setup) return showSetup();
      if (!status.logged_in) return showLogin();
      start();
    } catch (err) {
      toast(err.message, 'bad');
      showLogin();
    }
  })();
})();
