#!/usr/bin/env python3
"""Checks every <a href> and data-url in SITE_DIR points at a file that exists."""
import os, re, sys, html
from urllib.parse import urlsplit, unquote
from collections import defaultdict
root = sys.argv[1]
missing = defaultdict(set); external = defaultdict(int); ok = 0
pat = re.compile(r'<a\b[^>]*?\bhref="([^"]*)"', re.I)
pat2 = re.compile(r'data-url="([^"]*)"')
for dp, dn, fn in os.walk(root):
    if '.git' in dp: continue
    for f in fn:
        if not f.endswith('.html'): continue
        p = os.path.join(dp, f); src = open(p, encoding='utf-8', errors='ignore').read()
        for h in pat.findall(src) + pat2.findall(src):
            h = html.unescape(h).strip()
            if not h or h.startswith(('#','mailto:','tel:','javascript:','whatsapp:')): continue
            u = urlsplit(h)
            if u.scheme in ('http','https'):
                external[u.netloc] += 1; continue
            path = unquote(u.path)
            if not path: continue
            t = os.path.normpath(os.path.join(root, path.lstrip('/')) if path.startswith('/') else os.path.join(dp, path))
            cands = [t, os.path.join(t, 'index.html'), t + '.html']
            if any(os.path.isfile(c) for c in cands): ok += 1
            else: missing[os.path.relpath(t, root)].add(os.path.relpath(p, root))
print('ok', ok)
print('external hosts:', dict(sorted(external.items(), key=lambda x:-x[1])))
print('missing', len(missing))
for m, s in sorted(missing.items()): print(' ', m, '<-', len(s), 'pages e.g.', sorted(s)[0])
