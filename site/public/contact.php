<?php
/**
 * Contact form handler for Namecheap shared hosting (PHP mail()).
 * Returns JSON for the page's fetch() and redirects plain form posts.
 */

const TO_EMAIL = 'yehia@doersadv.com';
const FROM_EMAIL = 'website@doersadv.com';
const MAX_PER_HOUR = 5;

$wantsJson = strpos($_SERVER['HTTP_ACCEPT'] ?? '', 'application/json') !== false;
function respond($ok, $code = 200) {
    global $wantsJson;
    http_response_code($code);
    if ($wantsJson) { header('Content-Type: application/json'); echo json_encode(['ok' => $ok]); }
    else { header('Location: ' . ($ok ? '/contact-us/?sent=1' : '/contact-us/?error=1')); }
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') respond(false, 405);
if (!empty($_POST['website'])) respond(true);           // honeypot: pretend success to bots
// Timing trap: the page sends how many milliseconds the visitor spent on the form (measured in their browser).
// A person needs more than 3 seconds; bots that post instantly get a fake success. No value (no JavaScript) is allowed.
$t = $_POST['t'] ?? '';
if ($t !== '' && (int)$t < 3000) respond(true);

// Cloudflare Turnstile, once the secret key is set in doers-site-config.php (one level above public_html):
//   <?php return ['turnstile_secret' => '...'];
$config = @include dirname($_SERVER['DOCUMENT_ROOT']) . '/doers-site-config.php';
$secret = is_array($config) ? ($config['turnstile_secret'] ?? '') : '';
if ($secret !== '') {
    $token = (string)($_POST['cf-turnstile-response'] ?? '');
    $ctx = stream_context_create(['http' => [
        'method' => 'POST', 'timeout' => 8,
        'header' => 'Content-Type: application/x-www-form-urlencoded',
        'content' => http_build_query(['secret' => $secret, 'response' => $token, 'remoteip' => $_SERVER['HTTP_CF_CONNECTING_IP'] ?? $_SERVER['REMOTE_ADDR'] ?? '']),
    ]]);
    $check = json_decode((string)@file_get_contents('https://challenges.cloudflare.com/turnstile/v0/siteverify', false, $ctx), true);
    if (empty($check['success'])) respond(false, 403);
}

// Works on PHP 7 and 8, with or without the mbstring extension.
function cut($s, $max) { return function_exists('mb_substr') ? mb_substr($s, 0, $max) : substr($s, 0, $max); }
$clean = function ($k, $max) { return trim(cut(str_replace(["\r", "\n"], ' ', (string)($_POST[$k] ?? '')), $max)); };
$name = $clean('name', 120);
$email = filter_var(trim((string)($_POST['email'] ?? '')), FILTER_VALIDATE_EMAIL) ?: '';
$message = trim(cut((string)($_POST['message'] ?? ''), 5000));
if ($name === '' || $email === '' || $message === '') respond(false, 422);

// Simple per-IP rate limit stored in the system temp folder.
$ip = $_SERVER['HTTP_CF_CONNECTING_IP'] ?? $_SERVER['REMOTE_ADDR'] ?? 'unknown';  // behind Cloudflare, REMOTE_ADDR is Cloudflare's
$bucket = sys_get_temp_dir() . '/doers_contact_' . md5($ip);
$hits = array_filter(explode(',', (string)@file_get_contents($bucket)), function ($t) { return (int)$t > time() - 3600; });
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
// Keep a copy of every enquiry outside the web root, so none is lost if email sending fails.
$row = array_merge([date('c')], array_values($fields), [str_replace(["\r", "\n"], ' ', $message)]);
$store = dirname($_SERVER['DOCUMENT_ROOT']) . '/doers-leads.csv';
$saved = false;
if ($fh = @fopen($store, 'a')) { $saved = fputcsv($fh, $row) !== false; fclose($fh); }

$sent = @mail(TO_EMAIL, $subject, $body, implode("\r\n", $headers), '-f' . FROM_EMAIL);
if (!$sent) $sent = @mail(TO_EMAIL, $subject, $body, implode("\r\n", $headers));
if (!$sent) error_log('contact.php: mail() failed; enquiry saved to doers-leads.csv: ' . ($saved ? 'yes' : 'no'));
respond($sent || $saved, ($sent || $saved) ? 200 : 500);
