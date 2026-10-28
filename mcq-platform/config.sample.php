<?php
// Optional. Copy to config.php to create the teacher account (and demo content) on first run
// instead of using the setup screen. Only password hashes go here, made with:
//   php -r 'echo password_hash("the-password", PASSWORD_DEFAULT), "\n";'
return [
    'admin_username' => 'admin',
    'admin_password_hash' => '$2y$10$...',
    'settings' => ['platform_name' => 'منصة الاختبارات'],
    'students' => [
        // ['name' => 'طالب تجريبي', 'username' => 'demo', 'password_hash' => '$2y$10$...'],
    ],
    'quizzes_file' => 'demo/sample-quizzes.json',
];
