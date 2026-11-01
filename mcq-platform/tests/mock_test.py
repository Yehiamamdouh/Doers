# Mock exam and "other services" tests. Needs a fresh database:
#   php -S 127.0.0.1:8099 &  python3 tests/mock_test.py
import json, os, re, sys, urllib.request, http.cookiejar
from collections import Counter
BASE = os.environ.get('BASE', 'http://127.0.0.1:8099/')
failures = []

def client():
    op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    html = op.open(BASE + 'admin.php').read().decode()
    app = json.loads(re.search(r'window.APP = (.*?);</script>', html).group(1))
    def call(action, body=None):
        req = urllib.request.Request(BASE + 'api.php?action=' + action, data=json.dumps(body or {}).encode(), headers={'Content-Type': 'application/json', 'X-CSRF': app['csrf']})
        try:
            return json.loads(op.open(req).read())
        except urllib.error.HTTPError as e:
            return json.loads(e.read())
    call.app = app
    return call

def check(label, cond, extra=''):
    print(('PASS ' if cond else 'FAIL ') + label, extra if not cond else '')
    if not cond:
        failures.append(label)

A = client()
A('admin.setup', {'username': 'teacher', 'password': 'secret123'})
sizes = {'Quiz A': 10, 'Quiz B': 6, 'Quiz C': 2}
for title, n in sizes.items():
    A('admin.quiz.save', {'title': title, 'published': 1, 'questions': [
        {'text': '%s q%d' % (title, i), 'options': ['right', 'wrong'], 'correct': 0, 'explanation': 'because'} for i in range(n)]})
A('admin.settings.save', {'settings': {'mock_size': 12, 'mock_seconds': 60, 'mock_feedback': False}})
A('admin.student.save', {'name': 'Student', 'username': 'stu', 'password': 'pass1234'})
S = client()
S('student.login', {'username': 'stu', 'password': 'pass1234'})

info = S('student.quizzes')
mock = info['mock']
check('mock offered to students', mock and mock['size'] == 12 and mock['available'] == 18 and mock['quizzes'] == 3, mock)
check('mock quiz hidden from the quiz list', len(info['quizzes']) == 3)
check('teacher quiz list hides the mock quiz', len(A('admin.quizzes')['quizzes']) == 3)
check('teacher cannot edit the mock quiz', not A('admin.quiz.save', {'id': mock['quiz_id'], 'title': 'x', 'questions': []})['ok'])
check('teacher sees mock pool size', A('admin.me')['mock_pool'] == {'questions': 18, 'quizzes': 3})

m1 = S('student.start', {'quiz_id': mock['quiz_id'], 'mode': 'new'})['attempt']
dist = Counter(q['source'] for q in m1['questions'])
check('12 questions, split equally (C has only 2, so A and B get 5)', dist == Counter({'Quiz A': 5, 'Quiz B': 5, 'Quiz C': 2}), dist)
check('mock is timed and hides answers', m1['seconds'] == 60 and m1['feedback'] is False and all('correct_index' not in q for q in m1['questions']))
q0, q1 = m1['questions'][0], m1['questions'][1]
r = S('student.answer', {'attempt_id': m1['id'], 'question_id': q0['id'], 'choice': 0})
check('answer accepted without revealing it', r['ok'] and 'correct' not in r and 'correct_index' not in r, r)
r = S('student.answer', {'attempt_id': m1['id'], 'question_id': q1['id'], 'choice': -1})
check('skip / time out accepted', r['ok'] and r['chosen'] == -1, r)
check('other negative choices refused', not S('student.answer', {'attempt_id': m1['id'], 'question_id': m1['questions'][2]['id'], 'choice': -2})['ok'])
res = S('student.start', {'quiz_id': mock['quiz_id'], 'mode': 'resume'})['attempt']
check('resume keeps answer and skip, still hidden', res['id'] == m1['id'] and res['questions'][0]['chosen'] == 0 and res['questions'][1].get('skipped') and all('correct_index' not in q for q in res['questions']))
fin = S('student.finish', {'attempt_id': m1['id']})['attempt']
check('finish reveals everything', all('correct_index' in q for q in fin['questions']) and fin['correct_count'] == 1)

m2 = S('student.start', {'quiz_id': mock['quiz_id'], 'mode': 'new'})['attempt']
ids1, ids2 = {q['id'] for q in m1['questions']}, {q['id'] for q in m2['questions']}
check('second mock uses every unseen question first (6 new)', len(ids2) == 12 and len(ids2 - ids1) == 6, len(ids2 - ids1))
for q in m2['questions']:
    S('student.answer', {'attempt_id': m2['id'], 'question_id': q['id'], 'choice': 0})
fin2 = S('student.finish', {'attempt_id': m2['id']})['attempt']
check('mock compared with previous mock', fin2['previous_pct'] == 8 and fin2['correct_count'] == 12, (fin2['previous_pct'], fin2['correct_count']))
m3 = S('student.start', {'quiz_id': mock['quiz_id'], 'mode': 'new'})['attempt']
ids3 = {q['id'] for q in m3['questions']}
seen_once = ids1 - ids2
check('third mock prefers questions seen longest ago', seen_once <= ids3, len(seen_once - ids3))
S('student.finish', {'attempt_id': m3['id']})

A('admin.settings.save', {'settings': {'mock_size': 200}})
big = S('student.start', {'quiz_id': mock['quiz_id'], 'mode': 'new'})['attempt']
check('size capped at the question bank', len(big['questions']) == 18)
A('admin.settings.save', {'settings': {'mock_feedback': True}})
fb = S('student.start', {'quiz_id': mock['quiz_id'], 'mode': 'new'})['attempt']
r = S('student.answer', {'attempt_id': fb['id'], 'question_id': fb['questions'][0]['id'], 'choice': 1})
check('feedback setting reveals answer immediately', fb['feedback'] is True and r['correct'] is False and r['correct_index'] == 0)
S('student.finish', {'attempt_id': fb['id']})

wrong = S('student.start', {'quiz_id': mock['quiz_id'], 'mode': 'wrong'})['attempt']
check('retry mistakes of a mock', wrong['mode'] == 'wrong' and len(wrong['questions']) == 18, len(wrong['questions']))
normal_quiz = info['quizzes'][0]['id']
nq = S('student.start', {'quiz_id': normal_quiz, 'mode': 'new'})['attempt']
check('skip refused in normal quizzes', not S('student.answer', {'attempt_id': nq['id'], 'question_id': nq['questions'][0]['id'], 'choice': -1})['ok'])

hist = S('student.history')['attempts']
check('finished mocks in history (an unfinished one is replaced by the next start)', [a['mode'] for a in hist].count('mock') == 4, [a['mode'] for a in hist])
check('teacher sees trend from mocks', A('admin.students')['students'][0]['trend'] is not None)

A('admin.settings.save', {'settings': {'mock_enabled': False}})
check('disabled mock hidden', S('student.quizzes')['mock'] is None)
check('disabled mock cannot start', not S('student.start', {'quiz_id': mock['quiz_id'], 'mode': 'new'})['ok'])

A('admin.settings.save', {'settings': {'services_enabled': True, 'services_title': 'خدماتنا الإضافية',
    'services_text': 'خدمة المساعدة في البحث العلمي والإشراف\nكورسات الماجستير', 'services_whatsapp': '+٠٥٧١٢١٦٨٨٤'}})
pub = client().app['settings']
check('services shown to students', pub['services_enabled'] is True and pub['services_whatsapp'] == '0571216884' and 'كورسات' in pub['services_text'], pub)
check('mock title in public settings', pub['mock_title'] == 'الاختبار التجريبي')

print('%d failed' % len(failures) if failures else 'ALL PASSED')
sys.exit(1 if failures else 0)
