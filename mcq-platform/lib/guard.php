<?php
// Loaded first by every entry file. Written in old PHP syntax on purpose, so that on a host
// with an old PHP version the visitor sees why instead of a blank error page.

if (version_compare(PHP_VERSION, '7.2.0', '<')) {
    header('HTTP/1.1 500 Internal Server Error');
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><meta charset="utf-8"><title>Setup needed</title><p style="font-family:sans-serif">'
        . 'Setup needed: PHP ' . PHP_VERSION . ' is too old. Choose PHP 7.2 or newer (8.1+ recommended) in cPanel &rarr; Select PHP Version.</p>';
    exit;
}

// Show the reason for a fatal error (without server paths) instead of an empty 500 page.
register_shutdown_function(function () {
    $e = error_get_last();
    if ($e && in_array($e['type'], array(E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR), true)) {
        $root = dirname(__DIR__);
        $msg = str_replace($root, '', $e['message']) . ' (' . str_replace($root, '', $e['file']) . ':' . $e['line'] . ')';
        if (!headers_sent()) {
            header('HTTP/1.1 500 Internal Server Error');
            header('Content-Type: text/plain; charset=utf-8');
        }
        echo "\nServer error: " . $msg;
    }
});
