#!/usr/bin/env python3
"""Step 3: save live pages that wget cannot mirror as files in SITE_DIR.

Usage: livepage.py SITE_DIR LIVE_URL OUT_PATH [LIVE_URL OUT_PATH ...]

Used for the "page not found" page (served by the host for any missing URL)
and the search results templates. Each can be served at any depth, so every
link in it is made root-relative; assets only these pages use are downloaded.
"""
import html
import os
import re
import sys
import urllib.error
import urllib.request

SITE_URL = 'https://almajnaadvisors.com'


def get(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.read()
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return e.read()
        raise


def save(site, url, out):
    s = get(url).decode('utf-8')

    def local_for(path, q):
        path = path.lstrip('/')
        name = path.rsplit('/', 1)[-1]
        ext = name.rsplit('.', 1)[-1] if '.' in name else ''
        if q:
            base = path + '@' + q
            for c in (base, base + '.' + ext, base + '.html'):
                if os.path.isfile(os.path.join(site, c)):
                    return c
        if path == '' or os.path.isfile(os.path.join(site, path)) or os.path.isfile(os.path.join(site, path, 'index.html')):
            return path
        if ext:  # an asset only this page uses
            dest = os.path.join(site, path)
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            with open(dest, 'wb') as fh:
                fh.write(get(SITE_URL + '/' + path + ('?' + q if q else '')))
            print('  downloaded', path)
            return path
        return None

    def fix(m):
        url = html.unescape(m.group(2))
        rest = url[len(SITE_URL):]
        if re.match(r'/(wp-admin|wp-json|xmlrpc)', rest) or re.search(r'(^|/)feed/', rest):
            return m.group(0)
        path, _, q = rest.partition('?')
        path, _, frag = path.partition('#')
        loc = local_for(path, q)
        if loc is None:
            print('  no local page for', url)
            return m.group(0)
        return m.group(1) + '/' + loc + ('#' + frag if frag else '') + m.group(3)

    s = re.sub(r'''((?:href|src|action|content|data-url)=["'])(https://almajnaadvisors\.com[^"' ]*)(["' ])''', fix, s)
    # srcset lists: "url 300w, url 600w"
    s = re.sub(r'https://almajnaadvisors\.com(/wp-content/[^"\' ,?]+)', r'\1', s)
    s = re.sub(r'https:\\/\\/almajnaadvisors\.com\\/(?!wp-admin|wp-json)', r'\\/', s)
    s = s.replace('"concatemoji":"https://almajnaadvisors.com/', '"concatemoji":"/')
    s = s.replace('"siteurl":"https://almajnaadvisors.com"', '"siteurl":""')
    dest = os.path.join(site, out)
    os.makedirs(os.path.dirname(dest) or '.', exist_ok=True)
    with open(dest, 'w', encoding='utf-8') as fh:
        fh.write(s)
    print(out, 'written')


def main():
    site, pairs = sys.argv[1], sys.argv[2:]
    for url, out in zip(pairs[::2], pairs[1::2]):
        save(site, url, out)


if __name__ == '__main__':
    main()
