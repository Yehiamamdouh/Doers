# Free trial (no account) and question counter tests. Needs a fresh database:
#   php -S 127.0.0.1:8099 &  python3 tests/trial_test.py
import base64, json, os, re, struct, urllib.request, http.cookiejar, zlib
from collections import Counter
BASE = os.environ.get('BASE', 'http://127.0.0.1:8099/')
failures = []

def client(page='index.php'):
    op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    html = op.open(BASE + page).read().decode()
    app = json.loads(re.search(r'window.APP = (.*?);</script>', html).group(1))
    def call(action, body=None):
        req = urllib.request.Request(BASE + 'api.php?action=' + action, data=json.dumps(body or {}).encode(), headers={'Content-Type': 'application/json', 'X-CSRF': app['csrf']})
        try:
            return json.loads(op.open(req).read())
        except urllib.error.HTTPError as e:
            return json.loads(e.read())
    def get(path):
        try:
            return op.open(BASE + path).status
        except urllib.error.HTTPError as e:
            return e.code
    call.app = app
    call.get = get
    return call

def check(label, cond, extra=''):
    print(('PASS ' if cond else 'FAIL ') + label, extra if not cond else '')
    if not cond:
        failures.append(label)

def png():
    def chunk(kind, data):
        return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data) & 0xffffffff)
    raw = chunk(b'IHDR', struct.pack('>IIBBBBB', 1, 1, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(b'\x00\xff\x00\x00')) + chunk(b'IEND', b'')
    return 'data:image/png;base64,' + base64.b64encode(b'\x89PNG\r\n\x1a\n' + raw).decode()

A = client('admin.php')
A('admin.setup', {'username': 'teacher', 'password': 'secret123'})
image = A('admin.media.upload', {'data': png()})
check('image uploaded', image['ok'], image)
sizes = {'Quiz A': 10, 'Quiz B': 6, 'Quiz C': 2}
for title, n in sizes.items():
    A('admin.quiz.save', {'title': title, 'published': 1, 'questions': [
        {'text': '%s q%d' % (title, i), 'options': ['right', 'wrong'], 'correct': 0, 'explanation': 'because',
         'image': image['name'] if title == 'Quiz C' else ''} for i in range(n)]})
A('admin.quiz.save', {'title': 'Hidden', 'published': 0, 'questions': [
    {'text': 'hidden q%d' % i, 'options': ['a', 'b'], 'correct': 0} for i in range(5)]})
A('admin.settings.save', {'settings': {'trial_size': 12}})

# ----- Question counter -----
V1 = client()
check('counter counts published questions only', V1.app['stats'] == {'questions': 18, 'quizzes': 3}, V1.app['stats'])
check('counter and trial on by default', V1.app['settings']['show_question_count'] is True and V1.app['settings']['trial_enabled'] is True)
check('teacher can hide the counter', A('admin.settings.save', {'settings': {'show_question_count': False}})['ok']
      and client().app['settings']['show_question_count'] is False)
A('admin.settings.save', {'settings': {'show_question_count': True}})

# ----- Starting a trial -----
info = V1('trial.info')
check('trial info for a new visitor', info['enabled'] and info['size'] == 12 and info['seconds'] == 60 and info['trial'] is None and info['stats']['questions'] == 18, info)
check('student pages stay closed to visitors', V1('student.quizzes').get('code') == 'auth')
check('trial state needs a trial', V1('trial.state').get('code') == 'trial_auth')
check('name required', not V1('trial.start', {'name': ' ', 'phone': '0571216884'})['ok'])
check('valid phone required', not V1('trial.start', {'name': 'Visitor One', 'phone': '12ab'})['ok'])

r = V1('trial.start', {'name': 'Visitor One', 'phone': '0571216884'})
t1 = r['attempt']
dist = Counter(q['source'] for q in t1['questions'])
check('12 questions, split equally across published quizzes', r['ok'] and dist == Counter({'Quiz A': 5, 'Quiz B': 5, 'Quiz C': 2}), dist)
check('no repeated questions', len({q['id'] for q in t1['questions']}) == 12)
check('trial is timed with answers after each question', t1['mode'] == 'trial' and t1['seconds'] == 60 and t1['feedback'] is True and t1['name'] == 'Visitor One')
check('answers hidden before answering', all('correct_index' not in q for q in t1['questions']))
check('trial token returned', len(r.get('token', '')) == 40)
token1 = r['token']

q0, q1, q2 = t1['questions'][0], t1['questions'][1], t1['questions'][2]
a = V1('trial.answer', {'question_id': q0['id'], 'choice': 0})
check('answer shows result and explanation', a['ok'] and a['correct'] is True and a['correct_index'] == 0 and a['explanation'] == 'because', a)
again = V1('trial.answer', {'question_id': q0['id'], 'choice': 1})
check('first answer is kept', again['chosen'] == 0)
a = V1('trial.answer', {'question_id': q1['id'], 'choice': -1})
check('skip / time out accepted', a['ok'] and a['chosen'] == -1 and a['skipped'] and a['correct_index'] == 0, a)
check('other negative choices refused', not V1('trial.answer', {'question_id': q2['id'], 'choice': -2})['ok'])
check('out-of-range choice refused', not V1('trial.answer', {'question_id': q2['id'], 'choice': 5})['ok'])
check('question outside the trial refused', not V1('trial.answer', {'question_id': 999999, 'choice': 0})['ok'])

c_q = next(q for q in t1['questions'] if q['source'] == 'Quiz C')
check('trial visitor can load images of their questions', V1.get('media.php?f=' + c_q['image']) == 200)
check('other visitors cannot load images', client().get('media.php?f=' + c_q['image']) == 403)

# ----- Coming back, one trial per number -----
state = V1('trial.state')['attempt']
check('state resumes with answers', state['id'] == t1['id'] and state['questions'][0]['chosen'] == 0 and state['questions'][1].get('skipped'))
check('info shows the trial in progress', V1('trial.info')['trial'] == {'name': 'Visitor One', 'answered': 2, 'total': 12, 'finished': False, 'pct': 8})
check('same session, same number resumes', V1('trial.start', {'name': 'Visitor One', 'phone': '0571216884'})['attempt']['id'] == t1['id'])
V2 = client()
used = V2('trial.start', {'name': 'Someone', 'phone': '+966 57 121 6884'})
check('same number in another format is refused', used.get('code') == 'trial_used', used)
V3 = client()
back = V3('trial.start', {'name': 'Visitor One', 'phone': '٠٥٧١٢١٦٨٨٤', 'token': token1})
check('same number with the browser token resumes (Arabic digits ok)', back['ok'] and back['attempt']['id'] == t1['id'], back)
V4 = client()
check('token restores the trial on a new visit', V4('trial.info', {'token': token1})['trial']['answered'] == 2 and V4('trial.state')['attempt']['id'] == t1['id'])
check('wrong token does not', client()('trial.info', {'token': 'x' * 40})['trial'] is None)

fin = V1('trial.finish')['attempt']
check('finish reveals all answers', fin['finished'] and all('correct_index' in q for q in fin['questions']) and fin['correct_count'] == 1)
check('no answers after finishing', not V1('trial.answer', {'question_id': q2['id'], 'choice': 0})['ok'])
check('a second trial from the same browser is refused', V1('trial.start', {'name': 'Visitor One', 'phone': '01012345678'}).get('code') == 'trial_used')
check('finished trial still viewable', V1('trial.info')['trial']['finished'] is True)
V1('trial.leave')
check('leave forgets the trial in this browser', V1('trial.info')['trial'] is None)

# ----- Teacher view -----
A('admin.student.save', {'name': 'Visitor One', 'username': '0571216884', 'password': 'pass1234'})
V5 = client()
t5 = V5('trial.start', {'name': 'Visitor Five', 'phone': '01012345678'})
check('second visitor starts', t5['ok'] and len(t5['attempt']['questions']) == 12)
check('teacher-only list', V5('admin.trials').get('code') == 'auth')
rows = A('admin.trials')['trials']
by = {t['name']: t for t in rows}
check('teacher sees visitors with phone and score', len(rows) == 2 and by['Visitor One']['phone'] == '966571216884' and by['Visitor One']['pct'] == 8 and by['Visitor One']['finished_at'] and by['Visitor Five']['finished_at'] is None, rows)
check('subscribed visitor is marked', by['Visitor One']['subscribed'] is True and by['Visitor Five']['subscribed'] is False)
A('admin.trial.delete', {'id': by['Visitor Five']['id']})
check('deleted visitor is gone', len(A('admin.trials')['trials']) == 1)
check('deleted visitor session ends', V5('trial.state').get('code') == 'trial_auth')

# ----- Turning it off, limits -----
A('admin.settings.save', {'settings': {'trial_enabled': False}})
check('disabled trial refuses new visitors', client()('trial.start', {'name': 'New', 'phone': '01099999999'}).get('code') == 'trial_off')
check('disabled shows in info', client()('trial.info')['enabled'] is False)
A('admin.settings.save', {'settings': {'trial_enabled': True, 'trial_size': 500, 'trial_feedback': False}})
V6 = client()
t6 = V6('trial.start', {'name': 'Visitor Six', 'phone': '01011111111'})
check('size capped by the question bank', len(t6['attempt']['questions']) == 18)
r6 = V6('trial.answer', {'question_id': t6['attempt']['questions'][0]['id'], 'choice': 0})
check('feedback off hides the answer until the end', t6['attempt']['feedback'] is False and 'correct_index' not in r6, r6)
# Visitor One and Six count from this network (Five was deleted), so 3 more fit in the limit of 5 a day.
codes = [client()('trial.start', {'name': 'Bulk %d' % i, 'phone': '0102000000%d' % i}).get('code') for i in range(5)]
check('new trials limited per network per day', codes == [None, None, None, 'rate', 'rate'], codes)

print()
print('ALL PASS' if not failures else 'FAILED: %d' % len(failures))
raise SystemExit(1 if failures else 0)
