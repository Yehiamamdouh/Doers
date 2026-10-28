<?php
// Shared setup: database, sessions, settings and JSON helpers.

declare(strict_types=1);

const APP_ROOT = __DIR__ . '/..';
const DATA_DIR = APP_ROOT . '/data';
const DB_FILE = DATA_DIR . '/platform.sqlite';

const DEFAULT_SETTINGS = [
    'platform_name' => 'منصة الاختبارات',
    'subscription_months' => '3',
    'warn_days' => '7',
    'contact_whatsapp' => '',
    'expired_message' => 'انتهت مدة اشتراكك. تواصل معنا لتجديد الاشتراك والعودة للمنصة.',
    'single_device' => '1',
];

date_default_timezone_set('Africa/Cairo');
ini_set('display_errors', '0');

// Returns a readable reason when the server can't run the platform, or null when it can.
function requirements_error(): ?string
{
    if (version_compare(PHP_VERSION, '7.2.0', '<')) {
        return 'PHP ' . PHP_VERSION . ' is too old: choose PHP 7.2 or newer (8.1+ recommended) in cPanel → Select PHP Version.';
    }
    if (!extension_loaded('pdo_sqlite')) {
        return 'The pdo_sqlite PHP extension is off: enable it in cPanel → Select PHP Version → Extensions.';
    }
    if (!extension_loaded('mbstring')) {
        return 'The mbstring PHP extension is off: enable it in cPanel → Select PHP Version → Extensions.';
    }
    if (!is_dir(DATA_DIR)) {
        @mkdir(DATA_DIR, 0750, true);
    }
    if (!is_writable(DATA_DIR)) {
        return 'PHP cannot write to the data/ folder: set its permissions to 755 (or 775).';
    }
    return null;
}

function requirements_page(string $reason): void
{
    http_response_code(500);
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex"><title>Setup needed</title>'
        . '<div style="font-family:system-ui,sans-serif;max-width:560px;margin:15vh auto;padding:0 16px;line-height:1.6">'
        . '<h1 style="font-size:1.3rem">المنصة تحتاج إعداداً على السيرفر</h1><p>Setup needed: ' . htmlspecialchars($reason) . '</p></div>';
    exit;
}

function db(): PDO
{
    static $pdo = null;
    if ($pdo) {
        return $pdo;
    }
    if (!is_dir(DATA_DIR)) {
        mkdir(DATA_DIR, 0750, true);
    }
    $pdo = new PDO('sqlite:' . DB_FILE, null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        // PHP < 8.1 returns every column as a string; do the same everywhere so the code
        // (which casts what it needs) behaves identically on the PHP 7.2 host and newer PHP.
        PDO::ATTR_STRINGIFY_FETCHES => true,
    ]);
    $pdo->exec('PRAGMA foreign_keys = ON');
    $pdo->exec('PRAGMA journal_mode = WAL');
    $pdo->exec('PRAGMA busy_timeout = 5000');
    migrate($pdo);
    if (is_file(APP_ROOT . '/config.php')) {
        require_once __DIR__ . '/seed.php';
        seed_from_config($pdo, require APP_ROOT . '/config.php');
    }
    return $pdo;
}

function migrate(PDO $pdo): void
{
    $pdo->exec(<<<'SQL'
CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    active INTEGER NOT NULL DEFAULT 1,
    first_login_at INTEGER,
    expires_at INTEGER,
    session_token TEXT,
    last_login_at INTEGER,
    created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS quizzes (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    published INTEGER NOT NULL DEFAULT 1,
    position INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY,
    quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    position INTEGER NOT NULL DEFAULT 0,
    text TEXT NOT NULL,
    options TEXT NOT NULL,
    correct INTEGER NOT NULL,
    explanation TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS questions_quiz ON questions(quiz_id, position);
CREATE TABLE IF NOT EXISTS attempts (
    id INTEGER PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    question_ids TEXT NOT NULL,
    answers TEXT NOT NULL DEFAULT '{}',
    correct_count INTEGER NOT NULL DEFAULT 0,
    started_at INTEGER NOT NULL,
    finished_at INTEGER
);
CREATE INDEX IF NOT EXISTS attempts_student ON attempts(student_id, quiz_id);
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS login_failures (
    key TEXT NOT NULL,
    at INTEGER NOT NULL
);
SQL
    );
}

function settings(): array
{
    static $cache = null;
    if ($cache === null) {
        $cache = DEFAULT_SETTINGS;
        foreach (db()->query('SELECT key, value FROM settings') as $row) {
            if (array_key_exists($row['key'], DEFAULT_SETTINGS)) {
                $cache[$row['key']] = $row['value'];
            }
        }
    }
    return $cache;
}

function save_settings(array $values): void
{
    $stmt = db()->prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    foreach (DEFAULT_SETTINGS as $key => $_) {
        if (array_key_exists($key, $values)) {
            $stmt->execute([$key, trim((string)$values[$key])]);
        }
    }
}

function start_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    session_name('mcq_session');
    $secure = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
    if (PHP_VERSION_ID >= 70300) {
        session_set_cookie_params(['lifetime' => 0, 'path' => '/', 'secure' => $secure, 'httponly' => true, 'samesite' => 'Lax']);
    } else {
        session_set_cookie_params(0, '/; samesite=Lax', '', $secure, true);
    }
    session_start();
    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(16));
    }
}

// Both end the request (exit). The code stays PHP 7.2-compatible because the staging host runs 7.2.
function json_out(array $data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function fail(string $message, int $status = 400, string $code = 'error'): void
{
    json_out(['ok' => false, 'error' => $message, 'code' => $code], $status);
}

// Adds whole calendar months, clamping to the last day (Jan 31 + 1 month = Feb 28/29).
function add_months(int $timestamp, int $months): int
{
    $date = (new DateTimeImmutable('@' . $timestamp))->setTimezone(new DateTimeZone(date_default_timezone_get()));
    $day = (int)$date->format('j');
    $target = $date->modify('first day of this month')->modify("+{$months} months");
    $day = min($day, (int)$target->format('t'));
    return $target->setDate((int)$target->format('Y'), (int)$target->format('n'), $day)->getTimestamp();
}

function too_many_failures(string $key): bool
{
    $pdo = db();
    $pdo->prepare('DELETE FROM login_failures WHERE at < ?')->execute([time() - 900]);
    $stmt = $pdo->prepare('SELECT COUNT(*) FROM login_failures WHERE key = ?');
    $stmt->execute([$key]);
    return (int)$stmt->fetchColumn() >= 10;
}

function record_failure(string $key): void
{
    db()->prepare('INSERT INTO login_failures (key, at) VALUES (?, ?)')->execute([$key, time()]);
}

function clear_failures(string $key): void
{
    db()->prepare('DELETE FROM login_failures WHERE key = ?')->execute([$key]);
}

function public_settings(): array
{
    $s = settings();
    return [
        'platform_name' => $s['platform_name'],
        'contact_whatsapp' => $s['contact_whatsapp'],
        'expired_message' => $s['expired_message'],
        'warn_days' => (int)$s['warn_days'],
    ];
}

function page_shell(string $title, array $scripts): void
{
    if ($reason = requirements_error()) {
        requirements_page($reason);
    }
    try {
        settings();
    } catch (Throwable $e) {
        error_log('[mcq] ' . $e);
        requirements_page('Database error: ' . $e->getMessage());
    }
    start_session();
    $boot = json_encode(['csrf' => $_SESSION['csrf'], 'settings' => public_settings()], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP);
    $name = htmlspecialchars(settings()['platform_name'], ENT_QUOTES);
    $title = htmlspecialchars($title, ENT_QUOTES);
    $tags = '';
    foreach (array_merge(['common.js'], $scripts) as $script) {
        $tags .= '<script src="assets/' . $script . '?v=' . filemtime(APP_ROOT . "/assets/$script") . '"></script>';
    }
    $version = filemtime(APP_ROOT . '/assets/app.css');
    header('Content-Type: text/html; charset=utf-8');
    header('X-Frame-Options: DENY');
    header('Referrer-Policy: same-origin');
    echo <<<HTML
<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>{$title} | {$name}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/app.css?v={$version}">
<script>try{var t=localStorage.getItem('mcq-theme');if(t)document.documentElement.dataset.theme=t;}catch(e){}</script>
</head>
<body>
<div id="app" class="boot"><div class="spinner"></div></div>
<div id="toast" role="status" aria-live="polite"></div>
<script>window.APP = {$boot};</script>
{$tags}
</body>
</html>
HTML;

}
