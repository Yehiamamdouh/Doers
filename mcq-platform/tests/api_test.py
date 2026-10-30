# End-to-end API test: subscriptions, answers, single device, quiz edits, CSRF.
# Run against a fresh database:  php -S 127.0.0.1:8099 &  python3 tests/api_test.py
import json, os, re, sqlite3, sys, time, urllib.request, http.cookiejar
BASE = os.environ.get('BASE', 'http://127.0.0.1:8099/')
DB = os.environ.get('DB', os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data', 'platform.sqlite'))
failures = []
def client():
    jar = http.cookiejar.CookieJar()
    op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
    html = op.open(BASE + 'admin.php').read().decode()
    csrf = json.loads(re.search(r'window.APP = (.*?);</script>', html).group(1))['csrf']
    def call(action, body=None):
        req = urllib.request.Request(BASE + 'api.php?action=' + action, data=json.dumps(body or {}).encode(), headers={'Content-Type': 'application/json', 'X-CSRF': csrf})
        try:
            r = op.open(req); return json.loads(r.read())
        except urllib.error.HTTPError as e:
            return json.loads(e.read())
    def get(path):
        try:
            r = op.open(BASE + path)
            return r.status, r.headers.get('Content-Type', ''), r.read()
        except urllib.error.HTTPError as e:
            return e.code, '', b''
    call.get = get
    return call
def check(label, cond, extra=''):
    print(('PASS ' if cond else 'FAIL ') + label, extra if not cond else '')
    if not cond:
        failures.append(label)

A = client()
check('status needs setup', A('admin.status')['needs_setup'] is True)
check('setup', A('admin.setup', {'username': 'teacher', 'password': 'secret123', 'platform_name': 'أكاديمية الصحة العامة'})['ok'])
check('second setup refused', not A('admin.setup', {'username': 'x', 'password': 'secret1234'})['ok'])
check('admin me', A('admin.me')['settings']['platform_name'] == 'أكاديمية الصحة العامة')
check('add student', A('admin.student.save', {'name': 'سارة علي', 'username': '01012345678', 'password': 'pass1234'})['ok'])
check('dup username refused', not A('admin.student.save', {'name': 'X', 'username': '01012345678', 'password': 'pass1234'})['ok'])
r = A('admin.quiz.save', {'title': 'Epidemiology 1', 'published': 1, 'questions': [
    {'text': 'Incidence measures?', 'options': ['existing', 'new cases', 'deaths'], 'correct': 1, 'explanation': 'New cases over time.'},
    {'text': 'Prevalence measures?', 'options': ['existing', 'new'], 'correct': 0, 'explanation': ''},
    {'text': 'BCG at birth?', 'options': ['yes', 'no'], 'correct': 0, 'explanation': 'Egypt schedule'}]})
check('quiz save', r['ok']); qid = r['id']
check('invalid quiz refused', not A('admin.quiz.save', {'title': 'bad', 'questions': [{'text': 'x', 'options': ['a', 'b'], 'correct': 5}]})['ok'])

# Question image: upload, attach to question 1, and refuse non-images.
PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
up = A('admin.media.upload', {'data': 'data:image/png;base64,' + PNG})
check('image upload', up['ok'] and re.match(r'^[a-f0-9]{32}\.png$', up['name']), up)
check('non-image upload refused', not A('admin.media.upload', {'data': 'data:image/png;base64,' + 'aGVsbG8='})['ok'])
check('unknown image name refused', not A('admin.quiz.save', {'id': qid, 'title': 'Epidemiology 1', 'published': 1, 'questions': [{'text': 'x', 'options': ['a', 'b'], 'correct': 0, 'image': '0' * 32 + '.png'}]})['ok'])
qz = A('admin.quiz.get', {'id': qid})['quiz']
qz['questions'][0]['image'] = up['name']
check('save question with image', A('admin.quiz.save', {'id': qid, 'title': qz['title'], 'published': 1, 'questions': qz['questions']})['ok'])
check('image kept on question', A('admin.quiz.get', {'id': qid})['quiz']['questions'][0]['image'] == up['name'])
status, ctype, _ = A.get('media.php?f=' + up['name'])
check('teacher can load image', status == 200 and ctype == 'image/png', (status, ctype))

S = client()
check('student unauth', S('student.me')['code'] == 'auth')
check('wrong password', not S('student.login', {'username': '01012345678', 'password': 'nope'})['ok'])
r = S('student.login', {'username': '٠١٠١٢٣٤٥٦٧٨', 'password': 'pass1234'})
check('login with arabic digits', r['ok'], r)
sub = r['me']['subscription']
days = (sub['expires_at'] - sub['first_login_at']) / 86400
check('3 month window', 89 <= days <= 93, days)
quizzes = S('student.quizzes')['quizzes']
check('quiz listed', len(quizzes) == 1 and quizzes[0]['total'] == 3)
status, ctype, body = S.get('media.php?f=' + up['name'])
check('student can load image', status == 200 and ctype == 'image/png' and body[:4] == b'\x89PNG', (status, ctype))
check('anonymous cannot load image', client().get('media.php?f=' + up['name'])[0] == 403)
check('bad image name is 404', S.get('media.php?f=../data/platform.sqlite')[0] == 404)
att = S('student.start', {'quiz_id': qid, 'mode': 'new'})['attempt']
check('no answers leaked before answering', all('correct_index' not in q for q in att['questions']))
check('student sees question image', att['questions'][0]['image'] == up['name'])
q1, q2 = att['questions'][0], att['questions'][1]
r = S('student.answer', {'attempt_id': att['id'], 'question_id': q1['id'], 'choice': 1})
check('correct answer', r['correct'] and r['explanation'] == 'New cases over time.')
r = S('student.answer', {'attempt_id': att['id'], 'question_id': q2['id'], 'choice': 1})
check('wrong answer shows key', (not r['correct']) and r['correct_index'] == 0)
r = S('student.answer', {'attempt_id': att['id'], 'question_id': q2['id'], 'choice': 0})
check('cannot change answer', r['chosen'] == 1 and not r['correct'])
res = S('student.start', {'quiz_id': qid, 'mode': 'resume'})['attempt']
check('resume keeps answers', res['id'] == att['id'] and res['questions'][0]['chosen'] == 1)
fin = S('student.finish', {'attempt_id': att['id']})['attempt']
check('finish reveals all', all('correct_index' in q for q in fin['questions']) and fin['correct_count'] == 1)
w = S('student.start', {'quiz_id': qid, 'mode': 'wrong'})['attempt']
check('wrong-only retry has 2 qs (wrong + skipped)', len(w['questions']) == 2, len(w['questions']))

# Progress history: finish the wrong-only retry, then a perfect full attempt.
for q in w['questions']:
    S('student.answer', {'attempt_id': w['id'], 'question_id': q['id'], 'choice': 0})
wf = S('student.finish', {'attempt_id': w['id']})['attempt']
check('wrong-only attempt marked', wf['mode'] == 'wrong' and wf['previous_pct'] is None, wf.get('mode'))
full = S('student.start', {'quiz_id': qid, 'mode': 'new'})['attempt']
for q in full['questions']:
    S('student.answer', {'attempt_id': full['id'], 'question_id': q['id'], 'choice': 0})
fin2 = S('student.finish', {'attempt_id': full['id']})['attempt']
check('result compares with previous full attempt', fin2['mode'] == 'full' and fin2['previous_pct'] == 33, fin2.get('previous_pct'))
hist = S('student.history')['attempts']
check('history keeps every attempt in order', [a['mode'] for a in hist] == ['full', 'wrong', 'full'] and hist[0]['pct'] == 33, [(a['mode'], a['pct']) for a in hist])
srow = A('admin.students')['students'][0]
expected_trend = hist[2]['pct'] - hist[0]['pct']
check('teacher sees last score and trend', srow['last_pct'] == hist[2]['pct'] and srow['trend'] == expected_trend, (srow['last_pct'], srow['trend']))
ah = A('admin.student.history', {'id': srow['id']})
check('teacher sees student history', len(ah['attempts']) == 3 and ah['student']['name'] == 'سارة علي')
aa = A('admin.attempt', {'id': hist[0]['id']})['attempt']
check('teacher can review an attempt', len(aa['questions']) == 3 and all('correct_index' in q for q in aa['questions']))
check('student cannot use teacher history', S('admin.student.history', {'id': srow['id']})['code'] == 'auth')

# Single device: second login kicks out the first.
S2 = client()
check('second device login', S2('student.login', {'username': '01012345678', 'password': 'pass1234'})['ok'])
check('first device kicked', S('student.me')['code'] == 'other_device')

# Expiry
sid = A('admin.students')['students'][0]['id']
A('admin.student.action', {'id': sid, 'action': 'expire'})
r = S2('student.quizzes')
check('expired blocks active session', r['code'] == 'expired', r)
check('expired student cannot load images', S2.get('media.php?f=' + up['name'])[0] == 403)
r = client()('student.login', {'username': '01012345678', 'password': 'pass1234'})
check('expired blocks login', r['code'] == 'expired')
A('admin.student.action', {'id': sid, 'action': 'renew'})
st = A('admin.students')['students'][0]['subscription']
check('renew from today', st['state'] == 'active' and 89 <= st['days_left'] <= 93, st)
A('admin.student.action', {'id': sid, 'action': 'renew'})
st2 = A('admin.students')['students'][0]['subscription']
check('renew while active extends', st2['days_left'] > 170, st2)
# Simulate time passing: move expiry into the past directly in the DB.
db = sqlite3.connect(DB)
db.execute('UPDATE students SET expires_at = ? WHERE id = ?', (int(time.time()) - 5, sid)); db.commit()
r = client()('student.login', {'username': '01012345678', 'password': 'pass1234'})
check('auto expiry after period passes', r['code'] == 'expired')
A('admin.student.action', {'id': sid, 'action': 'reset'})
r = client()('student.login', {'username': '01012345678', 'password': 'pass1234'})
check('reset restarts on next login', r['ok'] and r['me']['subscription']['days_left'] >= 89, r)
A('admin.student.action', {'id': sid, 'action': 'set_expiry', 'value': '2027-01-15'})
st = A('admin.students')['students'][0]['subscription']
check('manual expiry date', time.strftime('%Y-%m-%d', time.localtime(st['expires_at'])) in ('2027-01-15', '2027-01-16'), st)
A('admin.student.action', {'id': sid, 'action': 'suspend'})
check('suspended blocks login', client()('student.login', {'username': '01012345678', 'password': 'pass1234'})['code'] == 'suspended')
A('admin.student.action', {'id': sid, 'action': 'activate'})

# Editing the quiz keeps ids of kept questions
quiz = A('admin.quiz.get', {'id': qid})['quiz']
qs = quiz['questions']; qs[0]['text'] = 'Incidence rate measures?'; del qs[2]
qs.append({'text': 'New q', 'options': ['a', 'b'], 'correct': 1, 'explanation': ''})
A('admin.quiz.save', {'id': qid, 'title': quiz['title'], 'published': 1, 'questions': qs})
q2 = A('admin.quiz.get', {'id': qid})['quiz']['questions']
check('ids preserved on edit', q2[0]['id'] == qs[0]['id'] and q2[0]['text'] == 'Incidence rate measures?' and len(q2) == 3)
res = A('admin.results', {})['results']
check('results listed newest first', [r['id'] for r in res] == sorted([r['id'] for r in res], reverse=True) and res[-1]['pct'] == 33, [r['pct'] for r in res])
check('settings save', A('admin.settings.save', {'settings': {'subscription_months': 6, 'contact_whatsapp': '+20 101 234 5678'}})['ok'])
check('settings applied', A('admin.me')['settings']['contact_whatsapp'] == '201012345678')
A('admin.settings.save', {'settings': {'subscription_months': 3}})
# CSRF
req = urllib.request.Request(BASE + 'api.php?action=admin.status', data=b'{}', headers={'Content-Type': 'application/json'})
try: urllib.request.urlopen(req); check('csrf enforced', False)
except urllib.error.HTTPError as e: check('csrf enforced', e.code == 403)

print('%d failed' % len(failures) if failures else 'ALL PASSED')
sys.exit(1 if failures else 0)
