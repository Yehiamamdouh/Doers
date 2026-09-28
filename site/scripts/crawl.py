"""Crawl the live WordPress site: every page and post in the Yoast sitemaps, English and Arabic.

Saves one JSON per URL with the SEO fields and the main content, so the new
site can rebuild each page on the same URL. Run: python3 scripts/crawl.py   (add --from-raw to re-parse the saved HTML offline)
"""
import json, re, subprocess, pathlib, html, sys, time
from html.parser import HTMLParser

OUT = pathlib.Path(__file__).resolve().parent.parent / 'crawl'
RAW = OUT / 'raw'
RAW.mkdir(parents=True, exist_ok=True)
UA = 'Mozilla/5.0 (compatible; DoersMigration/1.0)'

def get(url):
    r = subprocess.run(['curl', '-sSL', '-m', '40', '-A', UA, '-w', '\n%{http_code} %{url_effective}', url], capture_output=True, text=True)
    body, _, tail = r.stdout.rpartition('\n')
    code, _, final = tail.partition(' ')
    return int(code or 0), final, body

def locs(xml):
    return re.findall(r'<loc>([^<]+)</loc>', xml)

def meta(doc, pattern):
    m = re.search(pattern, doc, re.I | re.S)
    return html.unescape(m.group(1).strip()) if m else ''

class Content(HTMLParser):
    """Collects headings, paragraphs, list items and images from the Divi content area."""
    SKIP = {'script', 'style', 'noscript', 'header', 'footer', 'nav', 'form', 'svg'}
    VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'}
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.blocks, self.stack, self.buf, self.skip = [], [], [], 0
    def skip_region(self, tag, a):
        cls = a.get('class') or ''
        return (tag in self.SKIP or a.get('id') in ('main-header', 'main-footer', 'top-header', 'comments', 'comment-wrap', 'respond')
                or any(c in cls for c in ('et-l--header', 'et-l--footer', 'et_pb_comments_module', 'commentlist', 'comment-respond')))
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        # Inside a skipped region, count nested elements so we know where it ends.
        if self.skip:
            if tag not in self.VOID: self.skip += 1
            return
        if tag not in self.VOID and self.skip_region(tag, a):
            self.skip = 1; return
        if tag in ('h1', 'h2', 'h3', 'h4', 'p', 'li'):
            self.stack.append(tag); self.buf = []
        elif tag == 'img':
            src = a.get('data-src') or a.get('src') or ''
            if 'wp-content/uploads' in src and not re.search(r'logo|flag|favicon|Shape-2', src, re.I):
                self.blocks.append({'type': 'img', 'src': src, 'alt': a.get('alt', ''), 'w': a.get('width'), 'h': a.get('height')})
        elif tag == 'a' and self.stack:
            self.buf.append(('a', a.get('href', '')))
        elif tag in ('strong', 'b', 'em', 'i') and self.stack:
            self.buf.append(('open', 'strong' if tag in ('strong', 'b') else 'em'))
        elif tag == 'br' and self.stack:
            self.buf.append(' ')
    def handle_endtag(self, tag):
        if self.skip:
            if tag not in self.VOID: self.skip -= 1
            return
        if tag == 'a' and self.stack:
            self.buf.append(('/a', ''))
        elif tag in ('strong', 'b', 'em', 'i') and self.stack:
            self.buf.append(('close', 'strong' if tag in ('strong', 'b') else 'em'))
        elif self.stack and tag == self.stack[-1]:
            self.stack.pop()
            text, links, inline, open_a = '', [], '', False
            for b in self.buf:
                if isinstance(b, tuple):
                    kind, val = b
                    if kind == 'a':
                        if val: links.append(val)
                        if open_a: inline += '</a>'
                        inline += f'<a href="{html.escape(val)}">'; open_a = True
                    elif kind == '/a' and open_a:
                        inline += '</a>'; open_a = False
                    elif kind == 'open': inline += f'<{val}>'
                    elif kind == 'close': inline += f'</{val}>'
                else:
                    text += b; inline += html.escape(b, quote=False)
            if open_a: inline += '</a>'
            text = re.sub(r'\s+', ' ', text).strip()
            inline = re.sub(r'\s+', ' ', inline).strip()
            if text:
                self.blocks.append({'type': tag, 'text': text, 'html': inline, 'links': links})
            self.buf = []
    def handle_data(self, data):
        if self.stack and not self.skip: self.buf.append(data)

def parse(url, doc):
    body = doc[doc.find('<body'):]
    start = body.find('id="et-main-area"')
    if start > 0: body = body[start:]
    p = Content(); p.feed(body)
    blocks, seen = [], set()
    for b in p.blocks:
        key = (b['type'], b.get('text') or b.get('src'))
        if key in seen: continue
        seen.add(key); blocks.append(b)
    return {
        'url': url,
        'title': meta(doc, r'<title>(.*?)</title>'),
        'description': meta(doc, r'<meta name="description" content="([^"]*)"'),
        'canonical': meta(doc, r'<link rel="canonical" href="([^"]*)"'),
        'og_image': meta(doc, r'<meta property="og:image" content="([^"]*)"'),
        'robots': meta(doc, r"<meta name='robots' content='([^']*)'"),
        'published': meta(doc, r'"datePublished":"([^"]+)"'),
        'modified': meta(doc, r'"dateModified":"([^"]+)"'),
        'hreflang': dict(re.findall(r'<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"', doc)),
        'blocks': blocks,
    }

def slugify(url):
    path = re.sub(r'^https?://[^/]+', '', url).strip('/') or 'home'
    return path.replace('/', '__')

def main():
    index = []
    for kind in ('page', 'post'):
        _, _, xml = get(f'https://doersadv.com/{kind}-sitemap.xml')
        for url in locs(xml):
            if re.search(r'\.(jpe?g|png|webp|gif)$', url, re.I): continue
            for lang, u in (('en', url), ('ar', url.replace('https://doersadv.com/', 'https://doersadv.com/ar/', 1))):
                code, final, doc = get(u)
                name = ('ar__' if lang == 'ar' else '') + slugify(url)
                (RAW / f'{name}.html').write_text(doc)
                rec = {'kind': kind, 'lang': lang, 'status': code, 'final_url': final}
                if code == 200 and doc:
                    rec.update(parse(u, doc))
                else:
                    rec['url'] = u
                (OUT / f'{name}.json').write_text(json.dumps(rec, ensure_ascii=False, indent=1))
                index.append({'kind': kind, 'lang': lang, 'url': u, 'status': code, 'final': final, 'file': f'{name}.json', 'title': rec.get('title', '')})
                print(code, lang, u, file=sys.stderr)
                time.sleep(0.3)
    (OUT / '_index.json').write_text(json.dumps(index, ensure_ascii=False, indent=1))

def reparse():
    """Rebuild the JSON files from the saved HTML in crawl/raw/ without fetching again."""
    for f in OUT.glob('*.json'):
        if f.name.startswith('_'): continue
        rec = json.loads(f.read_text())
        raw = RAW / (f.stem + '.html')
        if rec.get('status') != 200 or not raw.exists(): continue
        keep = {k: rec[k] for k in ('kind', 'lang', 'status', 'final_url')}
        keep.update(parse(rec['url'], raw.read_text()))
        f.write_text(json.dumps(keep, ensure_ascii=False, indent=1))

if __name__ == '__main__':
    reparse() if '--from-raw' in sys.argv else main()
