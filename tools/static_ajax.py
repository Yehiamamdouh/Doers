#!/usr/bin/env python3
"""Step 4b: install recorded AJAX answers into the site.

Usage: static_ajax.py SITE_DIR RECORDED_DIR SHIM_JS

Copies the recorded JSON into SITE_DIR/static-ajax/, points the live-domain
URLs inside them at the local copy (downloading any file they need that the
mirror lacks), and loads the shim right after jQuery on every page.
"""
import os
import re
import shutil
import sys
import urllib.request

SITE_URL = 'https://almajnaadvisors.com'


def fetch(url, dest):
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=60) as r, open(dest, 'wb') as fh:
        fh.write(r.read())


def main():
    site, rec, shim = sys.argv[1:4]
    out = os.path.join(site, 'static-ajax')
    os.makedirs(out, exist_ok=True)
    shutil.copy(shim, os.path.join(out, 'shim.js'))

    def local(path, q):
        path = path.lstrip('/')
        name = path.rsplit('/', 1)[-1]
        ext = name.rsplit('.', 1)[-1] if '.' in name else ''
        if q:
            for c in (path + '@' + q, path + '@' + q + '.' + ext):
                if os.path.isfile(os.path.join(site, c)):
                    return c
        if os.path.isfile(os.path.join(site, path)) or os.path.isfile(os.path.join(site, path, 'index.html')):
            return path
        if ext:
            fetch(SITE_URL + '/' + path + ('?' + q if q else ''), os.path.join(site, path))
            print('  downloaded', path)
            return path
        return path  # a page link; served by its folder's index.html

    n = 0
    for f in sorted(os.listdir(rec)):
        if not f.endswith('.json'):
            continue
        s = open(os.path.join(rec, f), encoding='utf-8').read()

        def esc(m):
            url = m.group(0).replace('\\/', '/')
            rest = url[len(SITE_URL):]
            if re.match(r'/(wp-admin|wp-json)', rest):
                return m.group(0)
            path, _, q = rest.partition('?')
            q = q.replace('&#038;', '&')
            return ('/' + local(path, q)).replace('/', '\\/')
        s = re.sub(r'https:\\/\\/almajnaadvisors\.com(?:\\/[^"\\ <>\']*)*(?:\?[^"\\ <>\']*)?', esc, s)
        open(os.path.join(out, f), 'w', encoding='utf-8').write(s)
        n += 1
    print('responses installed:', n)

    tag = re.compile(r'(<script id="jquery-core-js" src="((?:\.\./)*|/)wp-includes/js/jquery/jquery\.min\.js[^"]*"></script>)')
    pages = 0
    for dp, dn, fn in os.walk(site):
        for f in fn:
            if not f.endswith('.html'):
                continue
            p = os.path.join(dp, f)
            s = open(p, encoding='utf-8').read()
            if 'static-ajax/shim.js' in s:
                continue
            s2 = tag.sub(lambda m: m.group(1) + '\n<script id="static-ajax-js" src="' + m.group(2) + 'static-ajax/shim.js"></script>', s, count=1)
            if s2 != s:
                open(p, 'w', encoding='utf-8').write(s2)
                pages += 1
    print('pages loading the shim:', pages)


if __name__ == '__main__':
    main()
