<?php
// Optional first-run setup from config.php (see config.sample.php), used for demo deployments
// so the teacher account exists before anyone can open the setup screen. Runs only while there is no teacher.

declare(strict_types=1);

function seed_from_config(PDO $pdo, $config): void
{
    if (!is_array($config) || empty($config['admin_username']) || empty($config['admin_password_hash'])) {
        return;
    }
    if ((int)$pdo->query('SELECT COUNT(*) FROM admins')->fetchColumn() > 0) {
        return;
    }
    $now = time();
    $pdo->beginTransaction();
    $pdo->prepare('INSERT INTO admins (username, password_hash, created_at) VALUES (?, ?, ?)')
        ->execute([$config['admin_username'], $config['admin_password_hash'], $now]);

    foreach ((array)($config['settings'] ?? []) as $key => $value) {
        if (array_key_exists($key, DEFAULT_SETTINGS)) {
            $pdo->prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')->execute([$key, (string)$value]);
        }
    }

    foreach ((array)($config['students'] ?? []) as $s) {
        $pdo->prepare('INSERT OR IGNORE INTO students (name, username, password_hash, notes, created_at) VALUES (?, ?, ?, ?, ?)')
            ->execute([$s['name'], $s['username'], $s['password_hash'], $s['notes'] ?? '', $now]);
    }

    $file = $config['quizzes_file'] ?? '';
    $quizzes = $file && is_file(APP_ROOT . '/' . $file) ? json_decode((string)file_get_contents(APP_ROOT . '/' . $file), true) : [];
    foreach ((array)$quizzes as $pos => $quiz) {
        $pdo->prepare('INSERT INTO quizzes (title, description, published, position, created_at, updated_at) VALUES (?, ?, 1, ?, ?, ?)')
            ->execute([$quiz['title'], $quiz['description'] ?? '', $pos, $now, $now]);
        $quizId = (int)$pdo->lastInsertId();
        $insert = $pdo->prepare('INSERT INTO questions (quiz_id, position, text, options, correct, explanation) VALUES (?, ?, ?, ?, ?, ?)');
        foreach ($quiz['questions'] as $i => $q) {
            $insert->execute([$quizId, $i, $q['text'], json_encode($q['options'], JSON_UNESCAPED_UNICODE), (int)$q['correct'], $q['explanation'] ?? '']);
        }
    }
    $pdo->commit();
}
