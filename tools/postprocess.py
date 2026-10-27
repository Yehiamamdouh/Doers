#!/usr/bin/env python3
"""Step 2: turn the raw wget mirror into a self-contained static site.

Usage: postprocess.py RAW_DIR SITE_DIR

Content is left as it is on the live site. Only links and file names are
changed so the copy loads its own files and works on a static host:
  * fonts.googleapis.com / fonts.gstatic.com folders move inside the site
  * Elementor's lazily loaded scripts (webpack chunks, share-link, emoji)
    are downloaded, since wget cannot see them in the HTML
  * absolute links to the live domain inside inline JSON become root-relative
  * WordPress short links (?p=123) are pointed at the real page
  * files saved as "name.js@ver=1.2" get a real extension so hosts send
    the right Content-Type (Cloudflare sends X-Content-Type-Options: nosniff)
"""
import os
import re
import shutil
import sys
import urllib.request

SITE_URL = 'https://almajnaadvisors.com'
HOST = 'almajnaadvisors.com'
OK_EXT = {'html', 'css', 'js', 'jpg', 'jpeg', 'png', 'webp', 'svg', 'gif', 'woff', 'woff2',
          'ttf', 'eot', 'otf', 'json', 'ico', 'txt', 'xml', 'mp4', 'webm', 'pdf'}


def walk(root, exts=None):
    for dp, dn, fn in os.walk(root):
        for f in fn:
            if exts is None or f.rsplit('.', 1)[-1] in exts:
                yield os.path.join(dp, f)


def read(p):
    with open(p, encoding='utf-8') as fh:
        return fh.read()


def write(p, s):
    with open(p, 'w', encoding='utf-8') as fh:
        fh.write(s)


def fetch(url, dest):
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=60) as r, open(dest, 'wb') as fh:
        fh.write(r.read())


def copy_tree(raw, site):
    if os.path.exists(site):
        shutil.rmtree(site)
    shutil.copytree(os.path.join(raw, HOST), site)
    for d in ('fonts.googleapis.com', 'fonts.gstatic.com'):
        if os.path.isdir(os.path.join(raw, d)):
            shutil.copytree(os.path.join(raw, d), os.path.join(site, d))


def fetch_lazy_scripts(site):
    """Webpack chunks named in Elementor's runtimes, plus a few libs loaded by URL."""
    n = 0
    for plugin, runtime in (('elementor', 'webpack.runtime.min.js'), ('elementor-pro', 'webpack-pro.runtime.min.js')):
        jsdir = os.path.join(site, 'wp-content/plugins', plugin, 'assets/js')
        rt = [f for f in os.listdir(jsdir) if f.startswith(runtime)]
        if not rt:
            continue
        for chunk in sorted(set(re.findall(r'"([a-z0-9-]*\.?[0-9a-f]{20}\.bundle\.min\.js)"', read(os.path.join(jsdir, rt[0]))))):
            dest = os.path.join(jsdir, chunk)
            if not os.path.exists(dest):
                fetch(f'{SITE_URL}/wp-content/plugins/{plugin}/assets/js/{chunk}', dest)
                n += 1
    for path in ('wp-includes/js/wp-emoji-release.min.js',
                 'wp-content/plugins/elementor/assets/lib/share-link/share-link.min.js'):
        dest = os.path.join(site, path)
        if not os.path.exists(dest):
            fetch(f'{SITE_URL}/{path}', dest)
            n += 1
    print('lazy scripts downloaded:', n)


def rewrite_inline_urls(site):
    for p in walk(site, {'html'}):
        s = read(p)
        s2 = re.sub(r'https:\\/\\/almajnaadvisors\.com\\/(?!wp-admin|wp-json)', r'\\/', s)
        s2 = s2.replace('data-url="https://almajnaadvisors.com/', 'data-url="/')
        s2 = s2.replace('"concatemoji":"https://almajnaadvisors.com/', '"concatemoji":"/')
        s2 = s2.replace('"siteurl":"https://almajnaadvisors.com"', '"siteurl":""')
        if s2 != s:
            write(p, s2)


def fix_short_links(site):
    """Menus link to /?p=ID; wget saved those as index.html@p=ID.html copies."""
    idmap = {}
    for p in walk(site, {'html'}):
        if os.path.basename(p) != 'index.html':
            continue
        m = re.search(r"<link rel=['\"]shortlink['\"] href=['\"][^'\"]*index\.html@p=(\d+)\.html", read(p))
        if m:
            rel = os.path.relpath(os.path.dirname(p), site)
            idmap.setdefault(m.group(1), '' if rel == '.' else rel.replace(os.sep, '/') + '/')
    for f in os.listdir(site):
        if f.startswith('index.html@p='):
            os.remove(os.path.join(site, f))
    pat = re.compile(r'((?:\.\./)*)index\.html@p=(\d+)\.html')
    unknown = set()
    for p in walk(site, {'html'}):
        rel = os.path.relpath(os.path.dirname(p), site)
        depth = 0 if rel == '.' else rel.count(os.sep) + 1

        def rep(m):
            t = idmap.get(m.group(2))
            if t is None:
                unknown.add(m.group(2))
                return m.group(0)
            return '../' * depth + t + 'index.html'
        s = read(p)
        s2 = pat.sub(rep, s)
        if s2 != s:
            write(p, s2)
    print('short links mapped:', len(idmap), 'unknown:', sorted(unknown))
    if unknown:
        sys.exit('short links without a target page; see above')


def fix_extensions(site):
    ren = {}
    for p in list(walk(site)):
        d, f = os.path.split(p)
        ext = f.rsplit('.', 1)[-1].lower() if '.' in f else ''
        if ext in OK_EXT:
            continue
        m = re.match(r'^(.*?\.([A-Za-z0-9]+))@', f)
        if not m or m.group(2).lower() not in OK_EXT:
            print('  left as is:', os.path.relpath(p, site))
            continue
        new = f + '.' + m.group(2).lower()
        os.rename(p, os.path.join(d, new))
        ren[f] = new
    pats = [(re.compile(re.escape(o) + r'(?![A-Za-z0-9._=@-])'), n) for o, n in sorted(ren.items(), key=lambda x: -len(x[0]))]
    for p in walk(site, {'html', 'css', 'js', 'json'}):
        try:
            s = read(p)
        except UnicodeDecodeError:
            continue
        s2 = s
        for rx, n in pats:
            s2 = rx.sub(n, s2)
        if s2 != s:
            write(p, s2)
    print('files given a real extension:', len(ren))


def main():
    raw, site = sys.argv[1], sys.argv[2]
    copy_tree(raw, site)
    fetch_lazy_scripts(site)
    rewrite_inline_urls(site)
    fix_short_links(site)
    fix_extensions(site)


if __name__ == '__main__':
    main()
