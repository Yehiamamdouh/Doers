<?php
// Serves question images (data/media) to a logged-in teacher, or a student whose subscription is active.
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
$allowed = session_admin_ok() || session_student_check()[0] !== null;
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
