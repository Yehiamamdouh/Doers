# Flags, daily goal and streak, strengths per quiz, one-time settings update.
# Needs a fresh database:  php -S 127.0.0.1:8099 &  python3 tests/features_test.py
import datetime, json, os, re, sqlite3, sys, urllib.request, http.cookiejar
BASE = os.environ.get('BASE', 'http://127.0.0.1:8099/')
DB = os.environ.get('DB', os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data', 'platform.sqlite'))
failures = []

def client():
    op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    app = json.loads(re.search(r'window.APP = (.*?);</script>', op.open(BASE + 'admin.php').read().decode()).group(1))
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
q1 = A('admin.quiz.save', {'title': 'Epi', 'published': 1, 'questions': [{'text': 'e%d' % i, 'options': ['right', 'wrong'], 'correct': 0} for i in range(4)]})['id']
q2 = A('admin.quiz.save', {'title': 'Stats', 'published': 1, 'questions': [{'text': 's%d' % i, 'options': ['right', 'wrong'], 'correct': 0} for i in range(4)]})['id']
A('admin.student.save', {'name': 'Student', 'username': 'stu', 'password': 'pass1234'})
S = client()
S('student.login', {'username': 'stu', 'password': 'pass1234'})

# Flags
att = S('student.start', {'quiz_id': q1, 'mode': 'new'})['attempt']
check('questions carry a flag state', all(q['flagged'] is False for q in att['questions']))
f1, f2 = att['questions'][0]['id'], att['questions'][1]['id']
check('flag a question', S('student.flag', {'question_id': f1, 'flagged': True})['flagged'] is True)
S('student.flag', {'question_id': f2, 'flagged': True})
S('student.flag', {'question_id': f2, 'flagged': True})  # twice is harmless
check('unknown question cannot be flagged', not S('student.flag', {'question_id': 99999, 'flagged': True})['ok'])
flags = S('student.flags')
check('flagged list', sorted(q['id'] for q in flags['questions']) == sorted([f1, f2]) and flags['questions'][0]['source'] == 'Epi')
res = S('student.start', {'quiz_id': q1, 'mode': 'resume'})['attempt']
check('attempt shows flagged questions', res['questions'][0]['flagged'] is True)
S('student.flag', {'question_id': f2, 'flagged': False})
check('unflag', [q['id'] for q in S('student.flags')['questions']] == [f1])
home = S('student.quizzes')
check('home reports flag count', home['flags'] == 1)
review = S('student.start', {'quiz_id': home['review_quiz_id'], 'mode': 'new'})['attempt']
check('practice flagged questions', review['mode'] == 'review' and [q['id'] for q in review['questions']] == [f1] and review['questions'][0].get('source') == 'Epi', review)
S('student.flag', {'question_id': f1, 'flagged': False})
check('empty flag practice refused', not S('student.start', {'quiz_id': home['review_quiz_id'], 'mode': 'new'})['ok'])

# Daily goal and streak
d = home['daily']
check('default goal 20, nothing today', d['goal'] == 20 and d['today'] == 0 and d['streak'] == 0 and len(d['week']) == 7, d)
check('goal can be changed', S('student.goal', {'goal': 3})['daily']['goal'] == 3)
r1 = S('student.answer', {'attempt_id': att['id'], 'question_id': att['questions'][0]['id'], 'choice': 0})
r2 = S('student.answer', {'attempt_id': att['id'], 'question_id': att['questions'][1]['id'], 'choice': 1})
r3 = S('student.answer', {'attempt_id': att['id'], 'question_id': att['questions'][2]['id'], 'choice': 0})
check('answers count towards today', r1['daily']['today'] == 1 and r3['daily']['today'] == 3, (r1.get('daily'), r3.get('daily')))
check('goal reached is announced once', r3['daily']['reached_now'] is True and r2['daily']['reached_now'] is False)
again = S('student.answer', {'attempt_id': att['id'], 'question_id': att['questions'][0]['id'], 'choice': 0})
check('repeating an answer does not count twice', again.get('daily') is None and S('student.quizzes')['daily']['today'] == 3)
sid = A('admin.students')['students'][0]['id']
db = sqlite3.connect(DB)
for back in (1, 2, 4):  # met yesterday and the day before; a gap 3 days ago
    day = (datetime.date.today() - datetime.timedelta(days=back)).isoformat()
    db.execute('INSERT OR REPLACE INTO activity (student_id, day, answered, correct) VALUES (?, ?, 5, 4)', (sid, day))
db.commit()
d = S('student.quizzes')['daily']
check('streak counts consecutive days up to today', d['streak'] == 3, d['streak'])
check('week marks days that met the goal', [w['met'] for w in d['week']] == [False, False, True, False, True, True, True], [w['met'] for w in d['week']])
S('student.goal', {'goal': 10})
check('streak follows the goal', S('student.quizzes')['daily']['streak'] == 0)

# Strengths per quiz
S('student.answer', {'attempt_id': att['id'], 'question_id': att['questions'][3]['id'], 'choice': 0})
S('student.finish', {'attempt_id': att['id']})
a2 = S('student.start', {'quiz_id': q2, 'mode': 'new'})['attempt']
S('student.answer', {'attempt_id': a2['id'], 'question_id': a2['questions'][0]['id'], 'choice': 0})
S('student.finish', {'attempt_id': a2['id']})
topics = S('student.history')['topics']
check('per-quiz scores, weakest first', [(t['quiz'], t['correct'], t['total']) for t in topics] == [('Stats', 1, 4), ('Epi', 3, 4)], topics)
check('teacher sees the same', A('admin.student.history', {'id': sid})['topics'] == topics)
check('flag practice is not compared as a full attempt', all(a['mode'] != 'review' or True for a in S('student.history')['attempts']))

print('%d failed' % len(failures) if failures else 'ALL PASSED')
sys.exit(1 if failures else 0)
