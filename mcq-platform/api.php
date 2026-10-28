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

function load_student(int $id): ?array
{
    $stmt = db()->prepare('SELECT * FROM students WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) {
        return null;
    }
    foreach (['id', 'active', 'first_login_at', 'expires_at', 'last_login_at', 'created_at'] as $k) {
        $row[$k] = $row[$k] === null ? null : (int)$row[$k];
    }
    return $row;
}

function student_blocked(array $s): ?array
{
    if (!$s['active']) {
        return ['تم إيقاف حسابك مؤقتاً. تواصل مع المسؤول.', 'suspended'];
    }
    if ($s['expires_at'] !== null && $s['expires_at'] <= time()) {
        return [settings()['expired_message'], 'expired'];
    }
    return null;
}

function current_student(): array
{
    $id = (int)($_SESSION['student_id'] ?? 0);
    $s = $id ? load_student($id) : null;
    if (!$s) {
        unset($_SESSION['student_id'], $_SESSION['student_token']);
        fail('سجّل الدخول أولاً.', 401, 'auth');
    }
    if (settings()['single_device'] === '1' && !hash_equals((string)$s['session_token'], (string)($_SESSION['student_token'] ?? ''))) {
        unset($_SESSION['student_id'], $_SESSION['student_token']);
        fail('تم تسجيل الدخول بحسابك من جهاز آخر، فتم إنهاء الجلسة هنا.', 401, 'other_device');
    }
    if ($blocked = student_blocked($s)) {
        fail($blocked[0], 403, $blocked[1]);
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
    $byId = [];
    foreach (quiz_questions((int)$a['quiz_id']) as $q) {
        $byId[$q['id']] = $q;
    }
    $finished = $a['finished_at'] !== null;
    $questions = [];
    foreach ($a['question_ids'] as $qid) {
        if (!isset($byId[$qid])) {
            continue;
        }
        $q = $byId[$qid];
        $item = ['id' => $q['id'], 'text' => $q['text'], 'options' => $q['options']];
        $chosen = $a['answers'][(string)$qid] ?? null;
        if ($chosen !== null) {
            $item['chosen'] = (int)$chosen;
        }
        if ($chosen !== null || $finished) {
            $item['correct_index'] = $q['correct'];
            $item['explanation'] = $q['explanation'];
        }
        $questions[] = $item;
    }
    return [
        'id' => (int)$a['id'],
        'quiz_id' => (int)$a['quiz_id'],
        'title' => $a['title'],
        'finished' => $finished,
        'correct_count' => (int)$a['correct_count'],
        'questions' => $questions,
    ];
}

function create_attempt(int $studentId, int $quizId, array $questionIds): array
{
    $pdo = db();
    $pdo->prepare('DELETE FROM attempts WHERE student_id = ? AND quiz_id = ? AND finished_at IS NULL')->execute([$studentId, $quizId]);
    $pdo->prepare('INSERT INTO attempts (student_id, quiz_id, question_ids, started_at) VALUES (?, ?, ?, ?)')
        ->execute([$studentId, $quizId, json_encode(array_values($questionIds)), time()]);
    return load_attempt((int)$pdo->lastInsertId(), $studentId);
}

function pct(int $correct, int $total): int
{
    return $total > 0 ? (int)round($correct * 100 / $total) : 0;
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
            'SELECT q.id, q.title, q.description, COUNT(qs.id) AS total
             FROM quizzes q JOIN questions qs ON qs.quiz_id = q.id
             WHERE q.published = 1 GROUP BY q.id ORDER BY q.position, q.id'
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
        json_out(['ok' => true, 'me' => student_me($s), 'quizzes' => $quizzes]);
    }

    case 'student.start': {
        $s = current_student();
        $quizId = int_in($in, 'quiz_id');
        $mode = str_in($in, 'mode', 10);
        $stmt = $pdo->prepare('SELECT id FROM quizzes WHERE id = ? AND published = 1');
        $stmt->execute([$quizId]);
        if (!$stmt->fetch()) {
            fail('الاختبار غير متاح.', 404);
        }
        $allIds = array_column(quiz_questions($quizId), 'id');
        if (!$allIds) {
            fail('لا توجد أسئلة في هذا الاختبار بعد.');
        }
        if ($mode === 'resume') {
            $stmt = $pdo->prepare('SELECT id FROM attempts WHERE student_id = ? AND quiz_id = ? AND finished_at IS NULL ORDER BY id DESC LIMIT 1');
            $stmt->execute([$s['id'], $quizId]);
            if ($open = $stmt->fetchColumn()) {
                json_out(['ok' => true, 'attempt' => attempt_payload(load_attempt((int)$open, $s['id']))]);
            }
        }
        $ids = $allIds;
        if ($mode === 'wrong') {
            $stmt = $pdo->prepare('SELECT id FROM attempts WHERE student_id = ? AND quiz_id = ? AND finished_at IS NOT NULL ORDER BY id DESC LIMIT 1');
            $stmt->execute([$s['id'], $quizId]);
            $lastId = $stmt->fetchColumn();
            if (!$lastId) {
                fail('لا توجد محاولة سابقة لمراجعة أخطائها.');
            }
            $last = load_attempt((int)$lastId, $s['id']);
            $correctById = array_column(quiz_questions($quizId), 'correct', 'id');
            $ids = array_values(array_filter($last['question_ids'], function ($qid) use ($last, $correctById) {
                if (!isset($correctById[$qid])) {
                    return false;
                }
                $chosen = $last['answers'][(string)$qid] ?? null;
                return $chosen === null || (int)$chosen !== $correctById[$qid];
            }));
            if (!$ids) {
                fail('أحسنت! لا توجد أخطاء في آخر محاولة.');
            }
        }
        json_out(['ok' => true, 'attempt' => attempt_payload(create_attempt($s['id'], $quizId, $ids))]);
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
        $question = null;
        foreach (quiz_questions((int)$a['quiz_id']) as $q) {
            if ($q['id'] === $qid) {
                $question = $q;
            }
        }
        if (!$question) {
            fail('تم حذف هذا السؤال.');
        }
        if ($choice < 0 || $choice >= count($question['options'])) {
            fail('اختيار غير صالح.');
        }
        if (!array_key_exists((string)$qid, $a['answers'])) {
            $a['answers'][(string)$qid] = $choice;
            $correctCount = (int)$a['correct_count'] + ($choice === $question['correct'] ? 1 : 0);
            $pdo->prepare('UPDATE attempts SET answers = ?, correct_count = ? WHERE id = ?')
                ->execute([json_encode($a['answers'], JSON_FORCE_OBJECT), $correctCount, $a['id']]);
        }
        $chosen = (int)$a['answers'][(string)$qid];
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

    case 'admin.me':
        json_out(['ok' => true, 'admin' => current_admin(), 'settings' => settings()]);

    case 'admin.students': {
        current_admin();
        $rows = $pdo->query('SELECT * FROM students ORDER BY id DESC')->fetchAll();
        $stats = [];
        foreach ($pdo->query('SELECT student_id, question_ids, correct_count FROM attempts WHERE finished_at IS NOT NULL') as $a) {
            $sid = (int)$a['student_id'];
            if (!isset($stats[$sid])) {
                $stats[$sid] = ['attempts' => 0, 'pct_sum' => 0];
            }
            $stats[$sid]['attempts']++;
            $stats[$sid]['pct_sum'] += pct((int)$a['correct_count'], count(json_decode($a['question_ids'], true) ?: []));
        }
        $out = [];
        foreach ($rows as $r) {
            $s = load_student((int)$r['id']);
            $st = $stats[$s['id']] ?? ['attempts' => 0, 'pct_sum' => 0];
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

    case 'admin.quizzes': {
        current_admin();
        $rows = $pdo->query(
            'SELECT q.*, (SELECT COUNT(*) FROM questions WHERE quiz_id = q.id) AS total,
                    (SELECT COUNT(*) FROM attempts WHERE quiz_id = q.id AND finished_at IS NOT NULL) AS attempts
             FROM quizzes q ORDER BY q.position, q.id'
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
        $stmt = $pdo->prepare('SELECT * FROM quizzes WHERE id = ?');
        $stmt->execute([int_in($in, 'id')]);
        $quiz = $stmt->fetch();
        if (!$quiz) {
            fail('الاختبار غير موجود.', 404);
        }
        $quiz['id'] = (int)$quiz['id'];
        $quiz['published'] = (int)$quiz['published'];
        $quiz['questions'] = array_map(function ($q) {
            return ['id' => $q['id'], 'text' => $q['text'], 'options' => $q['options'], 'correct' => $q['correct'], 'explanation' => $q['explanation']];
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
        $update = $pdo->prepare('UPDATE questions SET position = ?, text = ?, options = ?, correct = ?, explanation = ? WHERE id = ? AND quiz_id = ?');
        $insert = $pdo->prepare('INSERT INTO questions (quiz_id, position, text, options, correct, explanation) VALUES (?, ?, ?, ?, ?, ?)');
        foreach ($questions as $pos => $q) {
            $options = json_encode($q['options'], JSON_UNESCAPED_UNICODE);
            if ($q['id'] && in_array($q['id'], $existing, true)) {
                $update->execute([$pos, $q['text'], $options, $q['correct'], $q['explanation'], $q['id'], $id]);
                $kept[] = $q['id'];
            } else {
                $insert->execute([$id, $pos, $q['text'], $options, $q['correct'], $q['explanation']]);
            }
        }
        $removed = array_diff($existing, $kept);
        if ($removed) {
            $pdo->prepare('DELETE FROM questions WHERE id IN (' . implode(',', array_fill(0, count($removed), '?')) . ')')
                ->execute(array_values($removed));
        }
        $pdo->commit();
        json_out(['ok' => true, 'id' => $id]);
    }

    case 'admin.quiz.publish':
        current_admin();
        $pdo->prepare('UPDATE quizzes SET published = ? WHERE id = ?')->execute([!empty($in['published']) ? 1 : 0, int_in($in, 'id')]);
        json_out(['ok' => true]);

    case 'admin.quiz.move': {
        current_admin();
        $ids = array_map('intval', $pdo->query('SELECT id FROM quizzes ORDER BY position, id')->fetchAll(PDO::FETCH_COLUMN));
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
        $pdo->prepare('DELETE FROM quizzes WHERE id = ?')->execute([int_in($in, 'id')]);
        json_out(['ok' => true]);

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
            'SELECT a.id, a.student_id, a.quiz_id, a.question_ids, a.correct_count, a.started_at, a.finished_at, s.name AS student, q.title AS quiz
             FROM attempts a JOIN students s ON s.id = a.student_id JOIN quizzes q ON q.id = a.quiz_id
             WHERE ' . implode(' AND ', $where) . ' ORDER BY a.finished_at DESC LIMIT 500'
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
        if (isset($values['single_device'])) {
            $values['single_device'] = $values['single_device'] ? '1' : '0';
        }
        if (isset($values['contact_whatsapp'])) {
            $values['contact_whatsapp'] = preg_replace('/\D+/', '', clean_username((string)$values['contact_whatsapp']));
        }
        save_settings($values);
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
