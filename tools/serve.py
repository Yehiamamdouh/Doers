#!/usr/bin/env python3
"""Local preview that behaves like Cloudflare Pages for testing:
sends X-Content-Type-Options: nosniff, serves folder/index.html, and /404.html
for missing paths. Usage: serve.py SITE_DIR PORT"""
import functools, http.server, os, sys
from urllib.parse import unquote, urlsplit

class H(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, '.js': 'application/javascript',
                      '.json': 'application/json', '.woff2': 'font/woff2', '.webp': 'image/webp', '.svg': 'image/svg+xml'}
    def end_headers(self):
        self.send_header('X-Content-Type-Options', 'nosniff')
        super().end_headers()
    def send_head(self):
        path = self.translate_path(self.path)
        if not os.path.exists(path) and not os.path.exists(path.rstrip('/') + '/index.html'):
            self.send_response(404); self.send_header('Content-Type', 'text/html; charset=utf-8'); self.end_headers()
            return open(os.path.join(self.directory, '404.html'), 'rb')
        return super().send_head()
    def log_message(self, *a): pass

http.server.ThreadingHTTPServer(('127.0.0.1', int(sys.argv[2])), functools.partial(H, directory=sys.argv[1])).serve_forever()
