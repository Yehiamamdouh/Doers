<?php
/**
 * Contact form handler for Namecheap shared hosting (PHP mail()).
 * Returns JSON for the page's fetch() and redirects plain form posts.
 */
declare(strict_types=1);

const TO_EMAIL = 'info@doersadv.com';
const FROM_EMAIL = 'website@doersadv.com';
const MAX_PER_HOUR = 5;

$wantsJson = str_contains($_SERVER['HTTP_ACCEPT'] ?? '', 'application/json');
function respond(bool $ok, int $code = 200): void {
    global $wantsJson;
    http_response_code($code);
    if ($wantsJson) { header('Content-Type: application/json'); echo json_encode(['ok' => $ok]); }
    else { header('Location: ' . ($ok ? '/contact-us/?sent=1' : '/contact-us/?error=1')); }
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') respond(false, 405);
if (!empty($_POST['website'])) respond(true);           // honeypot: pretend success to bots

$clean = fn(string $k, int $max) => trim(mb_substr(str_replace(["\r", "\n"], ' ', (string)($_POST[$k] ?? '')), 0, $max));
$name = $clean('name', 120);
$email = filter_var(trim((string)($_POST['email'] ?? '')), FILTER_VALIDATE_EMAIL) ?: '';
$message = trim(mb_substr((string)($_POST['message'] ?? ''), 0, 5000));
if ($name === '' || $email === '' || $message === '') respond(false, 422);

// Simple per-IP rate limit stored in the system temp folder.
$ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$bucket = sys_get_temp_dir() . '/doers_contact_' . md5($ip);
$hits = array_filter(explode(',', (string)@file_get_contents($bucket)), fn($t) => (int)$t > time() - 3600);
if (count($hits) >= MAX_PER_HOUR) respond(false, 429);
$hits[] = (string)time();
@file_put_contents($bucket, implode(',', $hits));

$fields = [
    'Name' => $name, 'Company' => $clean('company', 160), 'Email' => $email, 'Phone' => $clean('phone', 40),
    'Service' => $clean('service', 120), 'City' => $clean('city', 60), 'Language' => $clean('lang', 5),
];
$body = '';
foreach ($fields as $k => $v) $body .= "$k: $v\n";
$body .= "\nMessage:\n$message\n\nSent from doersadv.com/contact-us/";

$headers = [
    'From: Doers Website <' . FROM_EMAIL . '>',
    'Reply-To: ' . $email,
    'Content-Type: text/plain; charset=UTF-8',
];
$subject = '=?UTF-8?B?' . base64_encode('New enquiry: ' . ($fields['Service'] ?: 'General') . ' – ' . $name) . '?=';
$sent = mail(TO_EMAIL, $subject, $body, implode("\r\n", $headers));
respond($sent, $sent ? 200 : 500);
