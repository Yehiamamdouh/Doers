"""Turn the crawl of the live site into data the Astro site renders.

  python3 scripts/crawl.py          # once: fetch the live pages (crawl/)
  python3 scripts/build_legacy.py   # rebuild src/data/legacy-pages.json, src/content/blog/, public/img/legacy/

Every service page keeps its live URL, title, meta description and H1. Posts become
Markdown entries in the blog collection (editable from /admin/). Images are downloaded
from wp-content once, resized and served locally so the WordPress uploads can go.
"""
import collections, html, io, json, pathlib, re, subprocess

from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
CRAWL = ROOT / 'crawl'
IMG_DIR = ROOT / 'public/img/legacy'
CACHE = CRAWL / 'img-cache'
BLOG = ROOT / 'src/content/blog'
SITE = 'https://doersadv.com'

# Pages the new site already renders with its own templates.
SKIP_PAGES = {'/', '/contact-us/', '/blog/'}
# Live URLs that already 301 elsewhere (kept as redirects in .htaccess, not as pages).
NOISE = re.compile(r'^(WhatsApp us|SEO Intro|Read More|Submit a Comment|Welcome to Doers Portal|Contact Us|Get In Touch|Let\'?s talk|تواصل معنا)$', re.I)
STOP = re.compile(r'^(Submit a Comment|Welcome to Doers Portal|أرسل تعليقاً|إرسال تعليق)', re.I)

def path_of(url):
    return re.sub(r'^https?://[^/]+', '', url) or '/'

def load():
    recs = []
    for f in sorted(CRAWL.glob('*.json')):
        if f.name.startswith('_'): continue
        r = json.loads(f.read_text())
        if r.get('status') != 200 or 'blocks' not in r: continue
        # A page whose live URL already redirects is only a redirect in the new site.
        if path_of(r['final_url']).rstrip('/') != path_of(r['url']).rstrip('/'): continue
        recs.append(r)
    return recs

# ---------- images ----------
def local_img(src, used):
    """Download a wp-content image once, save a web-sized copy, return its public path."""
    if not src or 'wp-content/uploads' not in src: return None
    src = re.sub(r'-\d+x\d+(?=\.\w+$)', '', src.split('?')[0])  # prefer the original over WP thumbnails
    m = re.search(r'uploads/(\d{4})/(\d{2})/([^/]+)$', src)
    name = (f'{m.group(1)}-{m.group(2)}-{m.group(3)}' if m else src.rsplit('/', 1)[-1]).lower()
    stem, ext = name.rsplit('.', 1)
    if ext in ('svg', 'gif'): return None
    CACHE.mkdir(parents=True, exist_ok=True)
    raw = CACHE / name
    if not raw.exists():
        r = subprocess.run(['curl', '-sSL', '-m', '60', '-o', str(raw), '-w', '%{http_code}', src], capture_output=True, text=True)
        if r.stdout.strip() != '200':
            raw.unlink(missing_ok=True); return None
    out_name = stem + ('.png' if ext == 'png' else '.jpg')
    out = IMG_DIR / out_name
    if not out.exists():
        try:
            im = Image.open(raw)
        except Exception:
            return None
        im.thumbnail((1600, 1600))
        IMG_DIR.mkdir(parents=True, exist_ok=True)
        if ext == 'png' and im.mode in ('RGBA', 'LA', 'P'):
            im.save(out, optimize=True)
        else:
            im.convert('RGB').save(out, quality=80, optimize=True, progressive=True)
    used.add(out_name)
    w, h = Image.open(out).size
    return {'src': f'/img/legacy/{out_name}', 'w': w, 'h': h}

# ---------- content ----------
def fix_links(s, lang):
    """Internal links become root-relative; Arabic pages keep readers in Arabic."""
    def rep(m):
        href = html.unescape(m.group(1))
        if href.startswith(SITE):
            href = path_of(href)
            if lang == 'ar' and not href.startswith('/ar/') and not href.startswith('/wp-content'):
                href = '/ar' + href
        return f'href="{html.escape(href)}"'
    return re.sub(r'href="([^"]*)"', rep, s)

def boilerplate(recs):
    """Text that repeats on many pages (footer blurbs, widgets) is not page content."""
    count = collections.Counter()
    for r in recs:
        for t in {b.get('text') for b in r['blocks'] if b['type'] != 'img'}:
            count[t] += 1
    limit = max(4, len(recs) * 0.12)
    return {t for t, n in count.items() if n >= limit}

def clean_blocks(r, common):
    out = []
    for b in r['blocks']:
        t = b.get('text', '')
        if b['type'] != 'img' and STOP.search(t): break
        if b['type'] != 'img' and (t in common or NOISE.match(t)): continue
        if re.match(r'^by \|', t) or re.match(r'^بواسطة \|', t): continue
        out.append(b)
    return out

def to_nodes(blocks, lang, used):
    """Blocks -> render nodes; consecutive list items become one list."""
    nodes = []
    for b in blocks:
        if b['type'] == 'img':
            im = local_img(b['src'], used)
            if im and not any(n.get('src') == im['src'] for n in nodes):
                nodes.append({'t': 'img', 'alt': b.get('alt') or '', **im})
        elif b['type'] == 'li':
            h = fix_links(b.get('html') or html.escape(b['text']), lang)
            if nodes and nodes[-1]['t'] == 'ul': nodes[-1]['items'].append(h)
            else: nodes.append({'t': 'ul', 'items': [h]})
        else:
            t = {'h4': 'h3'}.get(b['type'], b['type'])
            nodes.append({'t': t, 'html': fix_links(b.get('html') or html.escape(b['text']), lang), 'text': b['text']})
    return nodes

def clip(s, n=158):
    s = re.sub(r'\s+', ' ', s).strip()
    return s if len(s) <= n else s[:n].rsplit(' ', 1)[0].rstrip('،,.;:') + '…'

# ---------- pages ----------
def build_page(r, common, used, en_by_path):
    lang = r['lang']
    path = path_of(r['url'])
    nodes = to_nodes(clean_blocks(r, common), lang, used)
    h1i = next((i for i, n in enumerate(nodes) if n['t'] == 'h1'), None)
    eyebrow, h1, lead, hero_img = '', '', '', None
    if h1i is not None:
        h1 = nodes[h1i]['text']
        pre = nodes[:h1i]
        eb = next((n for n in pre if n['t'] in ('h2', 'h3', 'p')), None)
        if eb: eyebrow = re.sub(r'^[—–\-\sٍ]+', '', eb['text']).strip()
        hero_img = next((n for n in pre if n['t'] == 'img'), None)
        rest = nodes[h1i + 1:]
    else:
        rest = nodes
    if rest and rest[0]['t'] == 'p':
        lead = rest[0]['html']; rest = rest[1:]
    if not hero_img and rest and rest[0]['t'] == 'img':
        hero_img = rest[0]; rest = rest[1:]
    sections, cur = [], None
    for n in rest:
        if n['t'] == 'h2':
            cur = {'h2': n['text'], 'nodes': []}; sections.append(cur)
        else:
            if cur is None:
                cur = {'h2': '', 'nodes': []}; sections.append(cur)
            cur['nodes'].append(n)
    sections = [s for s in sections if s['h2'] or s['nodes']]
    for s in sections:
        s['cards'] = sum(1 for n in s['nodes'] if n['t'] == 'h3') >= 3
        for n in s['nodes']: n.pop('text', None)
    title, desc = r['title'], r['description']
    if lang == 'ar':
        en = en_by_path.get(path[3:])
        # TranslatePress never translated the Arabic titles and descriptions; write them from the Arabic page itself.
        if en and title == en['title'] and h1:
            title = f'{h1} | دورز'
        if en and desc == en['description'] and lead:
            desc = clip(re.sub(r'<[^>]+>', '', html.unescape(lead)))
    og = local_img(r.get('og_image'), used)
    return {
        'path': path, 'lang': lang, 'title': title, 'description': desc,
        'og': og['src'] if og else None, 'published': r.get('published'), 'modified': r.get('modified'),
        'eyebrow': eyebrow, 'h1': h1 or title, 'lead': lead, 'hero': hero_img, 'sections': sections,
    }

# ---------- posts ----------
def yaml_str(s):
    return json.dumps(s or '', ensure_ascii=False)

def body_html(nodes):
    out = []
    for n in nodes:
        if n['t'] == 'img':
            out.append(f'<figure><img src="{n["src"]}" alt="{html.escape(n["alt"])}" width="{n["w"]}" height="{n["h"]}" loading="lazy"></figure>')
        elif n['t'] == 'ul':
            out.append('<ul>' + ''.join(f'<li>{i}</li>' for i in n['items']) + '</ul>')
        elif n['t'] in ('h2', 'h3', 'p'):
            out.append(f'<{n["t"]}>{n["html"]}</{n["t"]}>')
    return '\n\n'.join(out)

def build_post(r, common, used, en_by_path):
    lang = r['lang']
    path = path_of(r['url'])
    slug = path.strip('/').removeprefix('ar/')
    nodes = to_nodes(clean_blocks(r, common), lang, used)
    h1 = next((n['text'] for n in nodes if n['t'] == 'h1'), r['title'])
    nodes = [n for n in nodes if n['t'] != 'h1']
    cover = local_img(r.get('og_image'), used)
    if cover:
        nodes = [n for n in nodes if not (n['t'] == 'img' and n['src'] == cover['src'])]
    cat = ''
    for b in r['blocks']:
        m = re.match(r'^(?:by|بواسطة) \|.*?\|\s*(.*?),?\s*\|', b.get('text', ''))
        if m: cat = m.group(1).strip(' ,'); break
    title, desc = r['title'], r['description']
    if lang == 'ar':
        en = en_by_path.get(path[3:])
        if en and title == en['title']: title = f'{h1} | دورز'
        if en and desc == en['description']:
            first = next((n['html'] for n in nodes if n['t'] == 'p'), '')
            if first: desc = clip(re.sub(r'<[^>]+>', '', html.unescape(first)))
    fm = [
        '---',
        f'title: {yaml_str(title)}',
        f'h1: {yaml_str(h1)}',
        f'description: {yaml_str(desc)}',
        f'lang: {lang}',
        f'date: {r.get("published") or "2020-01-01"}',
    ]
    if r.get('modified'): fm.append(f'updated: {r["modified"]}')
    if cover: fm.append(f'cover: {cover["src"]}')
    if cat: fm.append(f'category: {yaml_str(cat)}')
    fm.append('---')
    dest = BLOG / ('ar' if lang == 'ar' else '') / f'{slug}.md'
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text('\n'.join(fm) + '\n\n' + body_html(nodes) + '\n')
    return slug

def main():
    recs = load()
    en_by_path = {path_of(r['url']): r for r in recs if r['lang'] == 'en'}
    used = set()
    pages, posts = [], collections.Counter()
    for kind in ('page', 'post'):
        group = [r for r in recs if r['kind'] == kind]
        for lang in ('en', 'ar'):
            common = boilerplate([r for r in group if r['lang'] == lang])
            for r in group:
                if r['lang'] != lang: continue
                p = path_of(r['url'])
                if kind == 'page':
                    if p.removeprefix('/ar') in SKIP_PAGES or p == '/ar/': continue
                    pages.append(build_page(r, common, used, en_by_path))
                else:
                    build_post(r, common, used, en_by_path); posts[lang] += 1
    (ROOT / 'src/data/legacy-pages.json').write_text(json.dumps(pages, ensure_ascii=False, indent=1))
    for f in IMG_DIR.glob('*'):
        if f.name not in used: f.unlink()
    print(f'{len(pages)} pages, posts {dict(posts)}, {len(used)} images')

if __name__ == '__main__':
    main()
