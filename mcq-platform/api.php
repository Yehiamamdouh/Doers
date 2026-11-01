<?php
// JSON API for the student app (index.php) and the teacher dashboard (admin.php).
// Every call is a POST: api.php?action=<name> with a JSON body and the X-CSRF header.

declare(strict_types=1);

require __DIR__ . '/lib/guard.php';
require __DIR__ . '/lib/bootstrap.php';

set_exception_handler(function (Throwable $e) {
    error_log('[mcq] ' . $e);
    fail('حدث خطأ غير متوقع، حاول مرة أخرى.', 500);
});

if ($reason = requirements_error()) {
    fail('Setup needed: ' . $reason, 500, 'setup');
}

start_session();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    fail('Method not allowed', 405);
}
if (!hash_equals($_SESSION['csrf'], $_SERVER['HTTP_X_CSRF'] ?? '')) {
    fail('انتهت الجلسة، أعد تحميل الصفحة.', 403, 'csrf');
}

$in = json_decode(file_get_contents('php://input') ?: '{}', true);
if (!is_array($in)) {
    $in = [];
}
$action = (string)($_GET['action'] ?? '');

function str_in(array $in, string $key, int $max = 20000): string
{
    return mb_substr(trim((string)($in[$key] ?? '')), 0, $max);
}

function int_in(array $in, string $key): int
{
    return (int)($in[$key] ?? 0);
}

// ---------- Subscriptions ----------

function subscription_state(array $s): array
{
    $now = time();
    $warnDays = (int)settings()['warn_days'];
    if (!$s['active']) {
        $state = 'suspended';
    } elseif ($s['expires_at'] === null) {
        $state = 'not_started';
    } elseif ($s['expires_at'] <= $now) {
        $state = 'expired';
    } elseif ($s['expires_at'] - $now <= $warnDays * 86400) {
        $state = 'ending';
    } else {
        $state = 'active';
    }
    return [
        'state' => $state,
        'first_login_at' => $s['first_login_at'] === null ? null : (int)$s['first_login_at'],
        'expires_at' => $s['expires_at'] === null ? null : (int)$s['expires_at'],
        'days_left' => $s['expires_at'] === null ? null : max(0, (int)ceil(($s['expires_at'] - $now) / 86400)),
    ];
}

function current_student(): array
{
    list($s, $message, $code, $status) = session_student_check();
    if (!$s) {
        fail($message, $status, $code);
    }
    return $s;
}

function student_me(array $s): array
{
    return ['name' => $s['name'], 'username' => $s['username'], 'subscription' => subscription_state($s)];
}

// ---------- Quizzes and attempts ----------

function quiz_questions(int $quizId): array
{
    $stmt = db()->prepare('SELECT * FROM questions WHERE quiz_id = ? ORDER BY position, id');
    $stmt->execute([$quizId]);
    $rows = $stmt->fetchAll();
    foreach ($rows as &$q) {
        $q['id'] = (int)$q['id'];
        $q['correct'] = (int)$q['correct'];
        $q['options'] = json_decode($q['options'], true) ?: [];
    }
    return $rows;
}

// Questions keyed by id, with the title of the quiz each one comes from (mock exams mix quizzes).
function questions_by_ids(array $ids): array
{
    $ids = array_values(array_unique(array_map('intval', $ids)));
    if (!$ids) {
        return [];
    }
    $stmt = db()->prepare('SELECT qs.*, q.title AS source FROM questions qs JOIN quizzes q ON q.id = qs.quiz_id
        WHERE qs.id IN (' . implode(',', array_fill(0, count($ids), '?')) . ')');
    $stmt->execute($ids);
    $byId = [];
    foreach ($stmt as $q) {
        $q['id'] = (int)$q['id'];
        $q['correct'] = (int)$q['correct'];
        $q['options'] = json_decode($q['options'], true) ?: [];
        $byId[$q['id']] = $q;
    }
    return $byId;
}

function load_attempt(int $id, int $studentId): array
{
    $stmt = db()->prepare('SELECT a.*, q.title FROM attempts a JOIN quizzes q ON q.id = a.quiz_id WHERE a.id = ? AND a.student_id = ?');
    $stmt->execute([$id, $studentId]);
    $a = $stmt->fetch();
    if (!$a) {
        fail('المحاولة غير موجودة.', 404);
    }
    $a['question_ids'] = json_decode($a['question_ids'], true) ?: [];
    $a['answers'] = json_decode($a['answers'], true) ?: [];
    return $a;
}

// Questions of an attempt in order. The correct answer and explanation are only
// sent once the student has answered that question (or finished the attempt).
function attempt_payload(array $a): array
{
    $byId = questions_by_ids($a['question_ids']);
    $finished = $a['finished_at'] !== null;
    $mock = $a['mode'] === 'mock';
    // In a mock exam the answers stay hidden until the end, unless the teacher chose to show them.
    $reveal = !$mock || settings()['mock_feedback'] === '1';
    $questions = [];
    foreach ($a['question_ids'] as $qid) {
        if (!isset($byId[$qid])) {
            continue;
        }
        $q = $byId[$qid];
        $item = ['id' => $q['id'], 'text' => $q['text'], 'image' => $q['image'], 'options' => $q['options']];
        if ($mock) {
            $item['source'] = $q['source'];
        }
        $chosen = $a['answers'][(string)$qid] ?? null;
        if ($chosen !== null && (int)$chosen < 0) {
            $item['skipped'] = true; // skipped or ran out of time in a mock exam
        } elseif ($chosen !== null) {
            $item['chosen'] = (int)$chosen;
        }
        if ($finished || ($chosen !== null && (int)$chosen >= 0 && $reveal)) {
            $item['correct_index'] = $q['correct'];
            $item['explanation'] = $q['explanation'];
        }
        $questions[] = $item;
    }
    $payload = [
        'id' => (int)$a['id'],
        'quiz_id' => (int)$a['quiz_id'],
        'title' => $a['title'],
        'mode' => $a['mode'],
        'finished' => $finished,
        'finished_at' => $finished ? (int)$a['finished_at'] : null,
        'correct_count' => (int)$a['correct_count'],
        'questions' => $questions,
        'previous_pct' => null,
    ];
    if ($mock) {
        $payload['seconds'] = max(10, (int)settings()['mock_seconds']);
        $payload['feedback'] = $reveal;
    }
    // The score of the previous complete attempt (full quiz, or mock exam) to show progress on the result screen.
    if ($finished && $a['mode'] !== 'wrong') {
        $stmt = db()->prepare("SELECT question_ids, correct_count FROM attempts
            WHERE student_id = ? AND quiz_id = ? AND mode = ? AND finished_at IS NOT NULL AND id < ?
            ORDER BY finished_at DESC, id DESC LIMIT 1");
        $stmt->execute([(int)$a['student_id'], (int)$a['quiz_id'], $a['mode'], (int)$a['id']]);
        if ($prev = $stmt->fetch()) {
            $payload['previous_pct'] = pct((int)$prev['correct_count'], count(json_decode($prev['question_ids'], true) ?: []));
        }
    }
    return $payload;
}

function create_attempt(int $studentId, int $quizId, array $questionIds, string $mode): array
{
    $pdo = db();
    $pdo->prepare('DELETE FROM attempts WHERE student_id = ? AND quiz_id = ? AND finished_at IS NULL')->execute([$studentId, $quizId]);
    $pdo->prepare('INSERT INTO attempts (student_id, quiz_id, question_ids, mode, started_at) VALUES (?, ?, ?, ?, ?)')
        ->execute([$studentId, $quizId, json_encode(array_values($questionIds)), $mode, time()]);
    return load_attempt((int)$pdo->lastInsertId(), $studentId);
}

function pct(int $correct, int $total): int
{
    return $total > 0 ? (int)round($correct * 100 / $total) : 0;
}

// Every finished attempt of a student, oldest first, for the progress page.
function student_history(int $studentId): array
{
    $stmt = db()->prepare(
        'SELECT a.id, a.quiz_id, q.title AS quiz, a.mode, a.question_ids, a.correct_count, a.started_at, a.finished_at
         FROM attempts a JOIN quizzes q ON q.id = a.quiz_id
         WHERE a.student_id = ? AND a.finished_at IS NOT NULL ORDER BY a.finished_at, a.id'
    );
    $stmt->execute([$studentId]);
    $rows = [];
    foreach ($stmt as $r) {
        $total = count(json_decode($r['question_ids'], true) ?: []);
        $rows[] = [
            'id' => (int)$r['id'],
            'quiz_id' => (int)$r['quiz_id'],
            'quiz' => $r['quiz'],
            'mode' => $r['mode'],
            'correct' => (int)$r['correct_count'],
            'total' => $total,
            'pct' => pct((int)$r['correct_count'], $total),
            'finished_at' => (int)$r['finished_at'],
            'minutes' => max(1, (int)round(((int)$r['finished_at'] - (int)$r['started_at']) / 60)),
        ];
    }
    return $rows;
}

// Trend of full-attempt scores: the average of the latest n attempts minus the average of the n
// before them, n = min(3, half the attempts). The progress page computes the same in JavaScript.
function score_trend(array $scores): ?int
{
    $n = min(3, intdiv(count($scores), 2));
    if ($n < 1) {
        return null;
    }
    $recent = array_slice($scores, -$n);
    $before = array_slice($scores, -2 * $n, $n);
    return (int)round(array_sum($recent) / $n - array_sum($before) / $n);
}

// ---------- Mock exam ----------

// The hidden quiz that mock exam attempts belong to (created on first use).
function mock_quiz_id(): int
{
    $pdo = db();
    $id = $pdo->query("SELECT id FROM quizzes WHERE kind = 'mock' LIMIT 1")->fetchColumn();
    if ($id) {
        return (int)$id;
    }
    $pdo->prepare("INSERT INTO quizzes (title, description, published, position, created_at, updated_at, kind) VALUES (?, '', 0, 0, ?, ?, 'mock')")
        ->execute([settings()['mock_title'], time(), time()]);
    return (int)$pdo->lastInsertId();
}

// Questions a mock exam can draw from: every question of every published quiz, grouped by quiz.
function mock_pool(): array
{
    $groups = [];
    foreach (db()->query("SELECT qs.id, qs.quiz_id FROM questions qs JOIN quizzes q ON q.id = qs.quiz_id
        WHERE q.published = 1 AND q.kind = 'normal' ORDER BY qs.id") as $row) {
        $groups[(int)$row['quiz_id']][] = (int)$row['id'];
    }
    return $groups;
}

// Picks a new mock exam for a student.
// - Equal share per quiz; a quiz with fewer questions than its share passes the rest to the others.
// - Within each quiz, questions this student never had in a mock exam come first, then the ones
//   seen longest ago, so every exam is different until the question bank runs out.
function build_mock(int $studentId): array
{
    $groups = mock_pool();
    $stmt = db()->prepare("SELECT question_ids FROM attempts WHERE student_id = ? AND quiz_id = ? AND mode = 'mock' ORDER BY id");
    $stmt->execute([$studentId, mock_quiz_id()]);
    $lastSeen = [];
    $round = 0;
    foreach ($stmt->fetchAll(PDO::FETCH_COLUMN) as $json) {
        $round++;
        foreach (json_decode($json, true) ?: [] as $qid) {
            $lastSeen[(int)$qid] = $round;
        }
    }
    foreach ($groups as $quizId => $ids) {
        $order = [];
        foreach ($ids as $qid) {
            $order[$qid] = ($lastSeen[$qid] ?? 0) * 1000000 + random_int(0, 999999);
        }
        asort($order);
        $groups[$quizId] = array_keys($order);
    }

    $total = array_sum(array_map('count', $groups));
    $remaining = min(max(1, (int)settings()['mock_size']), $total);
    $take = array_fill_keys(array_keys($groups), 0);
    $open = array_keys($groups);
    while ($remaining > 0 && $open) {
        shuffle($open); // which quizzes get the leftover questions is random
        $share = intdiv($remaining, count($open));
        $extra = $remaining % count($open);
        foreach ($open as $i => $quizId) {
            $want = $share + ($i < $extra ? 1 : 0);
            $got = min($want, count($groups[$quizId]) - $take[$quizId]);
            $take[$quizId] += $got;
            $remaining -= $got;
        }
        $open = array_values(array_filter($open, function ($quizId) use ($groups, $take) {
            return $take[$quizId] < count($groups[$quizId]);
        }));
    }
    $picked = [];
    foreach ($take as $quizId => $n) {
        $picked = array_merge($picked, array_slice($groups[$quizId], 0, $n));
    }
    shuffle($picked);
    return $picked;
}

// ---------- Teacher ----------

function current_admin(): array
{
    $id = (int)($_SESSION['admin_id'] ?? 0);
    $stmt = db()->prepare('SELECT id, username FROM admins WHERE id = ?');
    $stmt->execute([$id]);
    $admin = $stmt->fetch();
    if (!$admin) {
        unset($_SESSION['admin_id']);
        fail('سجّل الدخول أولاً.', 401, 'auth');
    }
    $admin['id'] = (int)$admin['id'];
    return $admin;
}

function admin_count(): int
{
    return (int)db()->query('SELECT COUNT(*) FROM admins')->fetchColumn();
}

function clean_username(string $u): string
{
    $u = strtr($u, ['٠' => '0', '١' => '1', '٢' => '2', '٣' => '3', '٤' => '4', '٥' => '5', '٦' => '6', '٧' => '7', '٨' => '8', '٩' => '9']);
    return preg_replace('/\s+/u', '', $u);
}

function validate_questions(array $list): array
{
    $out = [];
    foreach ($list as $i => $q) {
        $n = $i + 1;
        $text = trim((string)($q['text'] ?? ''));
        $options = array_values(array_filter(array_map('trim', array_map('strval', (array)($q['options'] ?? []))), function ($o) {
            return $o !== '';
        }));
        $correct = (int)($q['correct'] ?? -1);
        $image = (string)($q['image'] ?? '');
        if ($image !== '' && (!preg_match(MEDIA_NAME, $image) || !is_file(MEDIA_DIR . '/' . $image))) {
            fail("صورة السؤال رقم $n غير موجودة. ارفعها مرة أخرى.");
        }
        if ($text === '') {
            fail("السؤال رقم $n بدون نص.");
        }
        if (count($options) < 2) {
            fail("السؤال رقم $n يحتاج اختيارين على الأقل.");
        }
        if ($correct < 0 || $correct >= count($options)) {
            fail("حدّد الإجابة الصحيحة للسؤال رقم $n.");
        }
        $out[] = [
            'id' => (int)($q['id'] ?? 0),
            'text' => mb_substr($text, 0, 5000),
            'options' => array_map(function ($o) {
                return mb_substr($o, 0, 1000);
            }, array_slice($options, 0, 10)),
            'correct' => $correct,
            'explanation' => mb_substr(trim((string)($q['explanation'] ?? '')), 0, 10000),
            'image' => $image,
        ];
    }
    return $out;
}

// ---------- Actions ----------

$pdo = db();

switch ($action) {

    // ----- Student -----

    case 'student.login': {
        $username = clean_username(str_in($in, 'username', 100));
        $password = (string)($in['password'] ?? '');
        $key = 'student:' . mb_strtolower($username);
        $ipKey = 'ip:' . ($_SERVER['REMOTE_ADDR'] ?? '');
        if (too_many_failures($key) || too_many_failures($ipKey)) {
            fail('محاولات كثيرة خاطئة. انتظر 15 دقيقة ثم حاول مرة أخرى.', 429);
        }
        $stmt = $pdo->prepare('SELECT id, password_hash FROM students WHERE username = ?');
        $stmt->execute([$username]);
        $row = $stmt->fetch();
        if (!$row || !password_verify($password, $row['password_hash'])) {
            record_failure($key);
            record_failure($ipKey);
            fail('اسم المستخدم أو كلمة المرور غير صحيحة.', 401);
        }
        clear_failures($key);
        $s = load_student((int)$row['id']);
        if ($blocked = student_blocked($s)) {
            fail($blocked[0], 403, $blocked[1]);
        }
        $now = time();
        // The subscription clock starts on the first successful login.
        if ($s['first_login_at'] === null) {
            $s['first_login_at'] = $now;
            if ($s['expires_at'] === null) {
                $s['expires_at'] = add_months($now, max(1, (int)settings()['subscription_months']));
            }
        }
        $token = bin2hex(random_bytes(20));
        $pdo->prepare('UPDATE students SET first_login_at = ?, expires_at = ?, session_token = ?, last_login_at = ? WHERE id = ?')
            ->execute([$s['first_login_at'], $s['expires_at'], $token, $now, $s['id']]);
        session_regenerate_id(true);
        $_SESSION['student_id'] = $s['id'];
        $_SESSION['student_token'] = $token;
        json_out(['ok' => true, 'me' => student_me($s)]);
    }

    case 'student.logout':
        unset($_SESSION['student_id'], $_SESSION['student_token']);
        json_out(['ok' => true]);

    case 'student.me':
        json_out(['ok' => true, 'me' => student_me(current_student())]);

    case 'student.quizzes': {
        $s = current_student();
        $quizzes = $pdo->query(
            "SELECT q.id, q.title, q.description, COUNT(qs.id) AS total
             FROM quizzes q JOIN questions qs ON qs.quiz_id = q.id
             WHERE q.published = 1 AND q.kind = 'normal' GROUP BY q.id ORDER BY q.position, q.id"
        )->fetchAll();
        $stmt = $pdo->prepare('SELECT id, quiz_id, question_ids, answers, correct_count, finished_at FROM attempts WHERE student_id = ? ORDER BY id');
        $stmt->execute([$s['id']]);
        $stats = [];
        foreach ($stmt as $a) {
            $qid = (int)$a['quiz_id'];
            if (!isset($stats[$qid])) {
                $stats[$qid] = ['open' => null, 'last' => null, 'best' => null, 'finished' => 0];
            }
            $total = count(json_decode($a['question_ids'], true) ?: []);
            if ($a['finished_at'] === null) {
                $stats[$qid]['open'] = ['id' => (int)$a['id'], 'answered' => count(json_decode($a['answers'], true) ?: []), 'total' => $total];
            } else {
                $p = pct((int)$a['correct_count'], $total);
                $stats[$qid]['last'] = ['id' => (int)$a['id'], 'pct' => $p, 'correct' => (int)$a['correct_count'], 'total' => $total];
                $stats[$qid]['best'] = max($stats[$qid]['best'] ?? 0, $p);
                $stats[$qid]['finished']++;
            }
        }
        foreach ($quizzes as &$q) {
            $q['id'] = (int)$q['id'];
            $q['total'] = (int)$q['total'];
            $q['stats'] = $stats[$q['id']] ?? null;
        }
        $mock = null;
        if (settings()['mock_enabled'] === '1') {
            $pool = mock_pool();
            $available = array_sum(array_map('count', $pool));
            $mockId = mock_quiz_id();
            $mock = [
                'quiz_id' => $mockId,
                'title' => settings()['mock_title'],
                'size' => min((int)settings()['mock_size'], $available),
                'available' => $available,
                'quizzes' => count($pool),
                'seconds' => (int)settings()['mock_seconds'],
                'stats' => $stats[$mockId] ?? null,
            ];
        }
        json_out(['ok' => true, 'me' => student_me($s), 'quizzes' => $quizzes, 'mock' => $mock]);
    }

    case 'student.start': {
        $s = current_student();
        $quizId = int_in($in, 'quiz_id');
        $mode = str_in($in, 'mode', 10);
        $stmt = $pdo->prepare('SELECT id, kind, published FROM quizzes WHERE id = ?');
        $stmt->execute([$quizId]);
        $quiz = $stmt->fetch();
        $isMock = $quiz && $quiz['kind'] === 'mock';
        if (!$quiz || (!$isMock && $quiz['published'] !== '1')) {
            fail('الاختبار غير متاح.', 404);
        }
        if ($isMock && $mode !== 'wrong' && settings()['mock_enabled'] !== '1') {
            fail('الاختبار التجريبي غير متاح حالياً.', 404);
        }
        if ($mode === 'resume') {
            $stmt = $pdo->prepare('SELECT id FROM attempts WHERE student_id = ? AND quiz_id = ? AND finished_at IS NULL ORDER BY id DESC LIMIT 1');
            $stmt->execute([$s['id'], $quizId]);
            if ($open = $stmt->fetchColumn()) {
                json_out(['ok' => true, 'attempt' => attempt_payload(load_attempt((int)$open, $s['id']))]);
            }
        }
        if ($mode === 'wrong') {
            $stmt = $pdo->prepare('SELECT id FROM attempts WHERE student_id = ? AND quiz_id = ? AND finished_at IS NOT NULL ORDER BY id DESC LIMIT 1');
            $stmt->execute([$s['id'], $quizId]);
            $lastId = $stmt->fetchColumn();
            if (!$lastId) {
                fail('لا توجد محاولة سابقة لمراجعة أخطائها.');
            }
            $last = load_attempt((int)$lastId, $s['id']);
            $byId = questions_by_ids($last['question_ids']);
            $ids = array_values(array_filter($last['question_ids'], function ($qid) use ($last, $byId) {
                if (!isset($byId[$qid])) {
                    return false;
                }
                $chosen = $last['answers'][(string)$qid] ?? null;
                return $chosen === null || (int)$chosen !== $byId[$qid]['correct'];
            }));
            if (!$ids) {
                fail('أحسنت! لا توجد أخطاء في آخر محاولة.');
            }
            json_out(['ok' => true, 'attempt' => attempt_payload(create_attempt($s['id'], $quizId, $ids, 'wrong'))]);
        }
        $ids = $isMock ? build_mock($s['id']) : array_column(quiz_questions($quizId), 'id');
        if (!$ids) {
            fail('لا توجد أسئلة في هذا الاختبار بعد.');
        }
        json_out(['ok' => true, 'attempt' => attempt_payload(create_attempt($s['id'], $quizId, $ids, $isMock ? 'mock' : 'full'))]);
    }

    case 'student.answer': {
        $s = current_student();
        $a = load_attempt(int_in($in, 'attempt_id'), $s['id']);
        $qid = int_in($in, 'question_id');
        $choice = int_in($in, 'choice');
        if ($a['finished_at'] !== null) {
            fail('هذه المحاولة انتهت.');
        }
        if (!in_array($qid, $a['question_ids'], true)) {
            fail('السؤال غير موجود في هذه المحاولة.');
        }
        $question = questions_by_ids([$qid])[$qid] ?? null;
        if (!$question) {
            fail('تم حذف هذا السؤال.');
        }
        $mock = $a['mode'] === 'mock';
        // -1 = skipped, or the question's time ran out (mock exams only).
        if (($choice < 0 && !($mock && $choice === -1)) || $choice >= count($question['options'])) {
            fail('اختيار غير صالح.');
        }
        if (!array_key_exists((string)$qid, $a['answers'])) {
            $a['answers'][(string)$qid] = $choice;
            $correctCount = (int)$a['correct_count'] + ($choice === $question['correct'] ? 1 : 0);
            $pdo->prepare('UPDATE attempts SET answers = ?, correct_count = ? WHERE id = ?')
                ->execute([json_encode($a['answers'], JSON_FORCE_OBJECT), $correctCount, $a['id']]);
        }
        $chosen = (int)$a['answers'][(string)$qid];
        if ($mock && settings()['mock_feedback'] !== '1') {
            json_out(['ok' => true, 'chosen' => $chosen]); // answers are shown at the end
        }
        if ($chosen < 0) {
            json_out(['ok' => true, 'chosen' => $chosen, 'skipped' => true, 'correct_index' => $question['correct'], 'explanation' => $question['explanation']]);
        }
        json_out([
            'ok' => true,
            'chosen' => $chosen,
            'correct' => $chosen === $question['correct'],
            'correct_index' => $question['correct'],
            'explanation' => $question['explanation'],
        ]);
    }

    case 'student.finish': {
        $s = current_student();
        $a = load_attempt(int_in($in, 'attempt_id'), $s['id']);
        if ($a['finished_at'] === null) {
            $pdo->prepare('UPDATE attempts SET finished_at = ? WHERE id = ?')->execute([time(), $a['id']]);
            $a['finished_at'] = time();
        }
        json_out(['ok' => true, 'attempt' => attempt_payload($a)]);
    }

    case 'student.attempt': {
        $s = current_student();
        $a = load_attempt(int_in($in, 'attempt_id'), $s['id']);
        json_out(['ok' => true, 'attempt' => attempt_payload($a)]);
    }

    case 'student.history': {
        $s = current_student();
        json_out(['ok' => true, 'me' => student_me($s), 'attempts' => student_history($s['id'])]);
    }

    // ----- Teacher -----

    case 'admin.status':
        json_out(['ok' => true, 'needs_setup' => admin_count() === 0, 'logged_in' => !empty($_SESSION['admin_id'])]);

    case 'admin.setup': {
        if (admin_count() > 0) {
            fail('تم إنشاء حساب المسؤول من قبل.', 403);
        }
        $username = clean_username(str_in($in, 'username', 100));
        $password = (string)($in['password'] ?? '');
        if ($username === '' || mb_strlen($password) < 8) {
            fail('اكتب اسم مستخدم وكلمة مرور لا تقل عن 8 أحرف.');
        }
        $pdo->prepare('INSERT INTO admins (username, password_hash, created_at) VALUES (?, ?, ?)')
            ->execute([$username, password_hash($password, PASSWORD_DEFAULT), time()]);
        if (str_in($in, 'platform_name', 200) !== '') {
            save_settings(['platform_name' => str_in($in, 'platform_name', 200)]);
        }
        session_regenerate_id(true);
        $_SESSION['admin_id'] = (int)$pdo->lastInsertId();
        json_out(['ok' => true]);
    }

    case 'admin.login': {
        $username = clean_username(str_in($in, 'username', 100));
        $key = 'admin:' . mb_strtolower($username);
        $ipKey = 'ip:' . ($_SERVER['REMOTE_ADDR'] ?? '');
        if (too_many_failures($key) || too_many_failures($ipKey)) {
            fail('محاولات كثيرة خاطئة. انتظر 15 دقيقة ثم حاول مرة أخرى.', 429);
        }
        $stmt = $pdo->prepare('SELECT id, password_hash FROM admins WHERE username = ?');
        $stmt->execute([$username]);
        $row = $stmt->fetch();
        if (!$row || !password_verify((string)($in['password'] ?? ''), $row['password_hash'])) {
            record_failure($key);
            record_failure($ipKey);
            fail('اسم المستخدم أو كلمة المرور غير صحيحة.', 401);
        }
        clear_failures($key);
        session_regenerate_id(true);
        $_SESSION['admin_id'] = (int)$row['id'];
        json_out(['ok' => true]);
    }

    case 'admin.logout':
        unset($_SESSION['admin_id']);
        json_out(['ok' => true]);

    case 'admin.me': {
        $admin = current_admin();
        $pool = mock_pool();
        json_out([
            'ok' => true,
            'admin' => $admin,
            'settings' => settings(),
            'mock_pool' => ['questions' => array_sum(array_map('count', $pool)), 'quizzes' => count($pool)],
        ]);
    }

    case 'admin.students': {
        current_admin();
        $rows = $pdo->query('SELECT * FROM students ORDER BY id DESC')->fetchAll();
        $stats = [];
        foreach ($pdo->query('SELECT student_id, mode, question_ids, correct_count FROM attempts WHERE finished_at IS NOT NULL ORDER BY finished_at, id') as $a) {
            $sid = (int)$a['student_id'];
            if (!isset($stats[$sid])) {
                $stats[$sid] = ['attempts' => 0, 'pct_sum' => 0, 'full' => []];
            }
            $p = pct((int)$a['correct_count'], count(json_decode($a['question_ids'], true) ?: []));
            $stats[$sid]['attempts']++;
            $stats[$sid]['pct_sum'] += $p;
            if ($a['mode'] !== 'wrong') {
                $stats[$sid]['full'][] = $p;
            }
        }
        $out = [];
        foreach ($rows as $r) {
            $s = load_student((int)$r['id']);
            $st = $stats[$s['id']] ?? ['attempts' => 0, 'pct_sum' => 0, 'full' => []];
            $out[] = [
                'id' => $s['id'],
                'name' => $s['name'],
                'username' => $s['username'],
                'notes' => $s['notes'],
                'active' => (bool)$s['active'],
                'created_at' => (int)$s['created_at'],
                'last_login_at' => $s['last_login_at'],
                'subscription' => subscription_state($s),
                'attempts' => $st['attempts'],
                'avg_pct' => $st['attempts'] ? (int)round($st['pct_sum'] / $st['attempts']) : null,
                'last_pct' => $st['full'] ? end($st['full']) : null,
                'trend' => score_trend($st['full']),
            ];
        }
        json_out(['ok' => true, 'students' => $out]);
    }

    case 'admin.student.save': {
        current_admin();
        $id = int_in($in, 'id');
        $name = str_in($in, 'name', 200);
        $username = clean_username(str_in($in, 'username', 100));
        $password = (string)($in['password'] ?? '');
        $notes = str_in($in, 'notes', 2000);
        if ($name === '' || $username === '') {
            fail('اكتب اسم الطالب واسم المستخدم.');
        }
        if ((!$id || $password !== '') && mb_strlen($password) < 6) {
            fail('كلمة المرور لا تقل عن 6 أحرف.');
        }
        $stmt = $pdo->prepare('SELECT id FROM students WHERE username = ? AND id != ?');
        $stmt->execute([$username, $id]);
        if ($stmt->fetch()) {
            fail('اسم المستخدم مستخدم لطالب آخر.');
        }
        if ($id) {
            $pdo->prepare('UPDATE students SET name = ?, username = ?, notes = ? WHERE id = ?')->execute([$name, $username, $notes, $id]);
            if ($password !== '') {
                $pdo->prepare('UPDATE students SET password_hash = ?, session_token = NULL WHERE id = ?')
                    ->execute([password_hash($password, PASSWORD_DEFAULT), $id]);
            }
        } else {
            $pdo->prepare('INSERT INTO students (name, username, password_hash, notes, created_at) VALUES (?, ?, ?, ?, ?)')
                ->execute([$name, $username, password_hash($password, PASSWORD_DEFAULT), $notes, time()]);
        }
        json_out(['ok' => true]);
    }

    case 'admin.student.action': {
        current_admin();
        $s = load_student(int_in($in, 'id'));
        if (!$s) {
            fail('الطالب غير موجود.', 404);
        }
        $now = time();
        $months = max(1, (int)settings()['subscription_months']);
        switch (str_in($in, 'action', 20)) {
            case 'renew':
                // Extends from today if expired, otherwise from the current end date.
                $base = max($now, $s['expires_at'] ?? $now);
                $pdo->prepare('UPDATE students SET expires_at = ?, first_login_at = COALESCE(first_login_at, ?) WHERE id = ?')
                    ->execute([add_months($base, $months), $now, $s['id']]);
                break;
            case 'expire':
                $pdo->prepare('UPDATE students SET expires_at = ?, first_login_at = COALESCE(first_login_at, ?) WHERE id = ?')
                    ->execute([$now, $now, $s['id']]);
                break;
            case 'reset':
                $pdo->prepare('UPDATE students SET first_login_at = NULL, expires_at = NULL WHERE id = ?')->execute([$s['id']]);
                break;
            case 'set_expiry': {
                $date = DateTimeImmutable::createFromFormat('!Y-m-d', str_in($in, 'value', 10));
                if (!$date) {
                    fail('تاريخ غير صالح.');
                }
                $end = $date->setTime(23, 59, 59)->getTimestamp();
                $pdo->prepare('UPDATE students SET expires_at = ?, first_login_at = COALESCE(first_login_at, ?) WHERE id = ?')
                    ->execute([$end, min($now, $end), $s['id']]);
                break;
            }
            case 'suspend':
                $pdo->prepare('UPDATE students SET active = 0 WHERE id = ?')->execute([$s['id']]);
                break;
            case 'activate':
                $pdo->prepare('UPDATE students SET active = 1 WHERE id = ?')->execute([$s['id']]);
                break;
            case 'logout':
                $pdo->prepare('UPDATE students SET session_token = NULL WHERE id = ?')->execute([$s['id']]);
                break;
            case 'delete':
                $pdo->prepare('DELETE FROM students WHERE id = ?')->execute([$s['id']]);
                break;
            default:
                fail('إجراء غير معروف.');
        }
        json_out(['ok' => true]);
    }

    case 'admin.student.history': {
        current_admin();
        $s = load_student(int_in($in, 'id'));
        if (!$s) {
            fail('الطالب غير موجود.', 404);
        }
        json_out([
            'ok' => true,
            'student' => ['id' => $s['id'], 'name' => $s['name'], 'username' => $s['username'], 'subscription' => subscription_state($s)],
            'attempts' => student_history($s['id']),
        ]);
    }

    case 'admin.attempt': {
        current_admin();
        $stmt = $pdo->prepare('SELECT student_id FROM attempts WHERE id = ?');
        $stmt->execute([int_in($in, 'id')]);
        $sid = $stmt->fetchColumn();
        if ($sid === false) {
            fail('المحاولة غير موجودة.', 404);
        }
        json_out(['ok' => true, 'attempt' => attempt_payload(load_attempt(int_in($in, 'id'), (int)$sid))]);
    }

    case 'admin.quizzes': {
        current_admin();
        $rows = $pdo->query(
            "SELECT q.*, (SELECT COUNT(*) FROM questions WHERE quiz_id = q.id) AS total,
                    (SELECT COUNT(*) FROM attempts WHERE quiz_id = q.id AND finished_at IS NOT NULL) AS attempts
             FROM quizzes q WHERE q.kind = 'normal' ORDER BY q.position, q.id"
        )->fetchAll();
        foreach ($rows as &$r) {
            foreach (['id', 'published', 'position', 'total', 'attempts', 'created_at', 'updated_at'] as $k) {
                $r[$k] = (int)$r[$k];
            }
        }
        json_out(['ok' => true, 'quizzes' => $rows]);
    }

    case 'admin.quiz.get': {
        current_admin();
        $stmt = $pdo->prepare("SELECT * FROM quizzes WHERE id = ? AND kind = 'normal'");
        $stmt->execute([int_in($in, 'id')]);
        $quiz = $stmt->fetch();
        if (!$quiz) {
            fail('الاختبار غير موجود.', 404);
        }
        $quiz['id'] = (int)$quiz['id'];
        $quiz['published'] = (int)$quiz['published'];
        $quiz['questions'] = array_map(function ($q) {
            return ['id' => $q['id'], 'text' => $q['text'], 'image' => $q['image'], 'options' => $q['options'], 'correct' => $q['correct'], 'explanation' => $q['explanation']];
        }, quiz_questions($quiz['id']));
        json_out(['ok' => true, 'quiz' => $quiz]);
    }

    case 'admin.quiz.save': {
        current_admin();
        $id = int_in($in, 'id');
        $title = str_in($in, 'title', 300);
        if ($title === '') {
            fail('اكتب عنوان الاختبار.');
        }
        $questions = validate_questions((array)($in['questions'] ?? []));
        $now = time();
        $pdo->beginTransaction();
        if ($id && $id === mock_quiz_id()) {
            fail('لا يمكن تعديل الاختبار التجريبي من هنا.');
        }
        if ($id) {
            $pdo->prepare('UPDATE quizzes SET title = ?, description = ?, published = ?, updated_at = ? WHERE id = ?')
                ->execute([$title, str_in($in, 'description', 2000), !empty($in['published']) ? 1 : 0, $now, $id]);
        } else {
            $pos = (int)$pdo->query('SELECT COALESCE(MAX(position), 0) + 1 FROM quizzes')->fetchColumn();
            $pdo->prepare('INSERT INTO quizzes (title, description, published, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
                ->execute([$title, str_in($in, 'description', 2000), !empty($in['published']) ? 1 : 0, $pos, $now, $now]);
            $id = (int)$pdo->lastInsertId();
        }
        // Keep existing question ids so students' attempts still line up after edits.
        $existing = array_column(quiz_questions($id), 'id');
        $kept = [];
        $update = $pdo->prepare('UPDATE questions SET position = ?, text = ?, options = ?, correct = ?, explanation = ?, image = ? WHERE id = ? AND quiz_id = ?');
        $insert = $pdo->prepare('INSERT INTO questions (quiz_id, position, text, options, correct, explanation, image) VALUES (?, ?, ?, ?, ?, ?, ?)');
        foreach ($questions as $pos => $q) {
            $options = json_encode($q['options'], JSON_UNESCAPED_UNICODE);
            if ($q['id'] && in_array($q['id'], $existing, true)) {
                $update->execute([$pos, $q['text'], $options, $q['correct'], $q['explanation'], $q['image'], $q['id'], $id]);
                $kept[] = $q['id'];
            } else {
                $insert->execute([$id, $pos, $q['text'], $options, $q['correct'], $q['explanation'], $q['image']]);
            }
        }
        $removed = array_diff($existing, $kept);
        if ($removed) {
            $pdo->prepare('DELETE FROM questions WHERE id IN (' . implode(',', array_fill(0, count($removed), '?')) . ')')
                ->execute(array_values($removed));
        }
        $pdo->commit();
        sweep_media();
        json_out(['ok' => true, 'id' => $id]);
    }

    case 'admin.quiz.publish':
        current_admin();
        $pdo->prepare("UPDATE quizzes SET published = ? WHERE id = ? AND kind = 'normal'")->execute([!empty($in['published']) ? 1 : 0, int_in($in, 'id')]);
        json_out(['ok' => true]);

    case 'admin.quiz.move': {
        current_admin();
        $ids = array_map('intval', $pdo->query("SELECT id FROM quizzes WHERE kind = 'normal' ORDER BY position, id")->fetchAll(PDO::FETCH_COLUMN));
        $i = array_search(int_in($in, 'id'), $ids, true);
        $j = $i === false ? false : $i + (int_in($in, 'dir') < 0 ? -1 : 1);
        if ($i !== false && isset($ids[$j])) {
            [$ids[$i], $ids[$j]] = [$ids[$j], $ids[$i]];
            $stmt = $pdo->prepare('UPDATE quizzes SET position = ? WHERE id = ?');
            foreach ($ids as $pos => $qid) {
                $stmt->execute([$pos, $qid]);
            }
        }
        json_out(['ok' => true]);
    }

    case 'admin.quiz.delete':
        current_admin();
        $pdo->prepare("DELETE FROM quizzes WHERE id = ? AND kind = 'normal'")->execute([int_in($in, 'id')]);
        sweep_media();
        json_out(['ok' => true]);

    case 'admin.media.upload': {
        current_admin();
        try {
            $name = save_media((string)($in['data'] ?? ''));
        } catch (InvalidArgumentException $e) {
            fail($e->getMessage());
        }
        json_out(['ok' => true, 'name' => $name]);
    }

    case 'admin.results': {
        current_admin();
        $where = ['a.finished_at IS NOT NULL'];
        $args = [];
        if ($sid = int_in($in, 'student_id')) {
            $where[] = 'a.student_id = ?';
            $args[] = $sid;
        }
        if ($qid = int_in($in, 'quiz_id')) {
            $where[] = 'a.quiz_id = ?';
            $args[] = $qid;
        }
        $stmt = $pdo->prepare(
            'SELECT a.id, a.student_id, a.quiz_id, a.mode, a.question_ids, a.correct_count, a.started_at, a.finished_at, s.name AS student, q.title AS quiz
             FROM attempts a JOIN students s ON s.id = a.student_id JOIN quizzes q ON q.id = a.quiz_id
             WHERE ' . implode(' AND ', $where) . ' ORDER BY a.finished_at DESC, a.id DESC LIMIT 500'
        );
        $stmt->execute($args);
        $rows = [];
        foreach ($stmt as $r) {
            $total = count(json_decode($r['question_ids'], true) ?: []);
            $rows[] = [
                'id' => (int)$r['id'],
                'student_id' => (int)$r['student_id'],
                'student' => $r['student'],
                'quiz_id' => (int)$r['quiz_id'],
                'quiz' => $r['quiz'],
                'mode' => $r['mode'],
                'correct' => (int)$r['correct_count'],
                'total' => $total,
                'pct' => pct((int)$r['correct_count'], $total),
                'finished_at' => (int)$r['finished_at'],
                'minutes' => max(1, (int)round(((int)$r['finished_at'] - (int)$r['started_at']) / 60)),
            ];
        }
        json_out(['ok' => true, 'results' => $rows]);
    }

    case 'admin.settings.save': {
        current_admin();
        $values = (array)($in['settings'] ?? []);
        if (isset($values['subscription_months'])) {
            $values['subscription_months'] = (string)min(36, max(1, (int)$values['subscription_months']));
        }
        if (isset($values['warn_days'])) {
            $values['warn_days'] = (string)min(60, max(0, (int)$values['warn_days']));
        }
        foreach (['contact_whatsapp', 'services_whatsapp'] as $key) {
            if (isset($values[$key])) {
                $values[$key] = preg_replace('/\D+/', '', clean_username((string)$values[$key]));
            }
        }
        foreach (['single_device', 'mock_enabled', 'mock_feedback', 'services_enabled'] as $key) {
            if (isset($values[$key])) {
                $values[$key] = $values[$key] ? '1' : '0';
            }
        }
        if (isset($values['mock_size'])) {
            $values['mock_size'] = (string)min(1000, max(5, (int)$values['mock_size']));
        }
        if (isset($values['mock_seconds'])) {
            $values['mock_seconds'] = (string)min(600, max(10, (int)$values['mock_seconds']));
        }
        foreach (['mock_title' => 200, 'services_title' => 200, 'services_text' => 5000] as $key => $max) {
            if (isset($values[$key])) {
                $values[$key] = mb_substr(trim((string)$values[$key]), 0, $max);
            }
        }
        save_settings($values);
        if (isset($values['mock_title']) && $values['mock_title'] !== '') {
            $pdo->prepare("UPDATE quizzes SET title = ? WHERE kind = 'mock'")->execute([$values['mock_title']]);
        }
        json_out(['ok' => true]);
    }

    case 'admin.password': {
        $admin = current_admin();
        $stmt = $pdo->prepare('SELECT password_hash FROM admins WHERE id = ?');
        $stmt->execute([$admin['id']]);
        if (!password_verify((string)($in['current'] ?? ''), (string)$stmt->fetchColumn())) {
            fail('كلمة المرور الحالية غير صحيحة.');
        }
        $new = (string)($in['new'] ?? '');
        if (mb_strlen($new) < 8) {
            fail('كلمة المرور الجديدة لا تقل عن 8 أحرف.');
        }
        $pdo->prepare('UPDATE admins SET password_hash = ? WHERE id = ?')->execute([password_hash($new, PASSWORD_DEFAULT), $admin['id']]);
        json_out(['ok' => true]);
    }

    default:
        fail('Unknown action', 404);
}
