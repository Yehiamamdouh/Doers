<?php
// Serves question images (data/media) to a logged-in teacher, a student whose subscription is active,
// or a visitor whose free trial includes a question with that image.
require __DIR__ . '/lib/guard.php';
require __DIR__ . '/lib/bootstrap.php';

if (requirements_error()) {
    http_response_code(500);
    exit;
}
$name = (string)($_GET['f'] ?? '');
if (!preg_match(MEDIA_NAME, $name) || !is_file(MEDIA_DIR . '/' . $name)) {
    http_response_code(404);
    exit;
}
start_session();
$allowed = session_admin_ok() || session_student_check()[0] !== null || trial_has_image((int)($_SESSION['trial_id'] ?? 0), $name);
session_write_close();
if (!$allowed) {
    http_response_code(403);
    exit;
}
$types = ['jpg' => 'image/jpeg', 'png' => 'image/png', 'gif' => 'image/gif', 'webp' => 'image/webp'];
$path = MEDIA_DIR . '/' . $name;
header('Content-Type: ' . $types[pathinfo($name, PATHINFO_EXTENSION)]);
header('Content-Length: ' . filesize($path));
header('Content-Disposition: inline');
header('X-Content-Type-Options: nosniff');
// File names are random and never reused, so the browser may keep its copy.
header('Cache-Control: private, max-age=604800, immutable');
readfile($path);

function trial_has_image(int $trialId, string $name): bool
{
    if ($trialId <= 0) {
        return false;
    }
    $stmt = db()->prepare('SELECT question_ids FROM trials WHERE id = ?');
    $stmt->execute([$trialId]);
    $ids = array_map('intval', json_decode((string)$stmt->fetchColumn(), true) ?: []);
    if (!$ids) {
        return false;
    }
    $stmt = db()->prepare('SELECT 1 FROM questions WHERE image = ? AND id IN (' . implode(',', array_fill(0, count($ids), '?')) . ') LIMIT 1');
    $stmt->execute(array_merge([$name], $ids));
    return (bool)$stmt->fetchColumn();
}
