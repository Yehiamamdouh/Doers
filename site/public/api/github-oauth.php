<?php
/**
 * GitHub OAuth for the Decap CMS dashboard (/admin/), for Namecheap PHP hosting.
 *
 * Put the OAuth app credentials OUTSIDE the web root, in a file named
 * decap-oauth-config.php one level above public_html:
 *   <?php return ['client_id' => '...', 'client_secret' => '...'];
 * Create the app at GitHub → Settings → Developer settings → OAuth Apps,
 * with callback URL https://doersadv.com/api/github-oauth.php?callback=1
 */
declare(strict_types=1);
session_start();

$config = @include dirname($_SERVER['DOCUMENT_ROOT']) . '/decap-oauth-config.php';
if (!is_array($config) || empty($config['client_id']) || empty($config['client_secret'])) {
    http_response_code(500); exit('Dashboard login is not configured yet.');
}
$self = 'https://' . $_SERVER['HTTP_HOST'] . strtok($_SERVER['REQUEST_URI'], '?');

function finish(string $status, array $content): void {
    $msg = json_encode('authorization:github:' . $status . ':' . json_encode($content));
    header('Content-Type: text/html; charset=utf-8');
    echo "<!doctype html><script>
      (function(){
        function receive(e){ window.opener.postMessage($msg, e.origin); window.removeEventListener('message', receive); }
        window.addEventListener('message', receive, false);
        window.opener.postMessage('authorizing:github', '*');
      })();
    </script>";
    exit;
}

if (!isset($_GET['callback'])) {
    $state = bin2hex(random_bytes(16));
    $_SESSION['decap_state'] = $state;
    header('Location: https://github.com/login/oauth/authorize?' . http_build_query([
        'client_id' => $config['client_id'],
        'redirect_uri' => $self . '?callback=1',
        'scope' => 'repo,user',
        'state' => $state,
    ]));
    exit;
}

if (empty($_GET['state']) || !hash_equals($_SESSION['decap_state'] ?? '', (string)$_GET['state'])) {
    finish('error', ['message' => 'Login expired. Close this window and try again.']);
}
$ch = curl_init('https://github.com/login/oauth/access_token');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => ['Accept: application/json'],
    CURLOPT_POSTFIELDS => http_build_query([
        'client_id' => $config['client_id'],
        'client_secret' => $config['client_secret'],
        'code' => (string)($_GET['code'] ?? ''),
        'redirect_uri' => $self . '?callback=1',
    ]),
]);
$res = json_decode((string)curl_exec($ch), true);
curl_close($ch);
if (empty($res['access_token'])) finish('error', ['message' => 'GitHub did not return a token.']);
finish('success', ['token' => $res['access_token'], 'provider' => 'github']);
