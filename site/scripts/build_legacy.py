"""Turn the crawl of the live site into data the Astro site renders.

  python3 scripts/crawl.py          # once: fetch the live pages (crawl/)
  python3 scripts/build_legacy.py   # rebuild src/data/legacy-pages.json, src/content/blog/, public/img/legacy/

Every service page keeps its live URL, title, meta description and H1. Posts become
Markdown entries in the blog collection (editable from /admin/). Images are downloaded
from wp-content once, resized and served locally so the WordPress uploads can go.
"""
import collections, html, io, json, pathlib, re, subprocess
import rank_claims
import link_posts

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
NOISE = re.compile(r'^(\d{1,2}\.?|WhatsApp us|SEO Intro|Read More|Submit a Comment|Welcome to Doers Portal|Contact Us|Get In Touch|Creative|Let\'?s talk|تواصل معنا)$', re.I)
STOP = re.compile(r'^(Submit a Comment|Welcome to Doers Portal|أرسل تعليقاً|إرسال تعليق)', re.I)

# Topic label (EN, AR) and the service page each post points readers to.
TOPICS = {
    'branding': ('Branding', 'الهوية والبراندنج', '/branding-agency-egypt/'),
    'advertising': ('Advertising', 'الإعلان', '/'),
    'digital': ('Digital marketing', 'التسويق الرقمي', '/digital-marketing-egypt-cairo/'),
    'social': ('Social media', 'السوشيال ميديا', '/digital-marketing-egypt-cairo/'),
    'seo': ('SEO', 'تحسين محركات البحث', '/seo/'),
    'events': ('Events', 'الفعاليات', '/event-management-cairo-egypt/'),
    'web': ('Web development', 'تطوير المواقع', '/website-development-company-egypt/'),
    'ooh': ('Outdoor advertising', 'إعلانات الطرق', '/outdoor-advertising-egypt/'),
}
CATEGORY_TOPIC = {
    'branding agency in egypt': 'branding', 'advertising agency': 'advertising', 'digital marketing': 'digital',
    'digital marketing agency in egypt': 'digital', 'social media agency in egypt': 'social', 'seo services': 'seo',
    'event management agency': 'events', 'content management systems': 'web', 'website development company': 'web',
}
# Posts whose best next step is a specific page (off-topic posts point to the closest service).
SLUG_TOPIC = {
    'what-is-python-mainly-used-for': 'web', 'how-to-clone-a-website-like-a-pros': 'web',
    'how-ecommerce-marketers-can-successfully-compete-with-amazon': 'web',
    'why-you-need-a-website-development-company-for-your-business': 'web',
    'digital-content-strategy-from-conceptualization-to-engagement': 'digital', 'top-5-digital-content-strategy-development-steps': 'digital',
    'beyond-words-visual-contents-role-in-a-digital-strategy': 'digital', 'the-art-of-storytelling-in-creative-content-creation': 'digital',
    'practical-marketing-tips-for-black-friday': 'digital', 'linkedin-ads-and-b2b-digital-campaigns-using-seo-and-google-search-ads': 'digital',
    'the-future-of-online-advertising-advantages-and-challenges-in-2022': 'digital', '5-advertising-strategies-that-work-well-for-you': 'digital',
    '5-ways-how-outdoor-advertising-can-benefit-your-business': 'ooh', '6-different-types-of-advertisement-to-make-your-business-successful': 'ooh',
    '6-reasons-why-you-should-pick-a-professional-event-management-agency': 'events', 'largest-annual-exhibitions-in-the-middle-east': 'events',
    'how-is-branding-the-real-mind-game-for-any-business': 'branding', 'behind-the-logo-decoding-the-symbolism-and-design-choices': 'branding',
    'brand-identity-unveiling-the-core-elements-that-shape-strong-brands': 'branding', 'typography-matters-how-fonts-convey-brand-personality-and-values': 'branding',
    'how-to-do-market-research-a-guide-and-template': 'branding', '6-majors-ways-your-creative-agency-can-make-money': 'branding',
    'listening-market-intelligence-and-competitive-benchmarking-techniques': 'seo',
}
SLUG_SERVICE = {
    'largest-annual-exhibitions-in-the-middle-east': '/booth-production-egypt/',
    'listening-market-intelligence-and-competitive-benchmarking-techniques': '/listening-and-reputation-management/',
}
# Hand-written pages (src/data/pages/<path with / as __>.<lang>.json) replace the crawl for that page and language.
PAGES_DIR = ROOT / 'src/data/pages'

def page_key(path):
    return path.strip('/').removeprefix('ar/').replace('/', '__')

def topic_of(slug, en_cat):
    return SLUG_TOPIC.get(slug) or CATEGORY_TOPIC.get((en_cat or '').lower()) or 'advertising'

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
    # The Arabic copy of a page whose English URL redirects is redirected too (see .htaccess).
    gone = {path_of(json.loads(f.read_text())['url']) for f in CRAWL.glob('*.json') if not f.name.startswith(('_', 'ar__'))} - {path_of(r['url']) for r in recs}
    return [r for r in recs if not (r['lang'] == 'ar' and path_of(r['url'])[3:] in gone)]

def arabic_share(r):
    text = ' '.join(b.get('text', '') for b in r['blocks'] if b['type'] != 'img')
    letters = re.findall(r'[A-Za-z\u0600-\u06FF]', text)
    return sum(1 for c in letters if c >= '\u0600') / max(1, len(letters))

def write_ar_redirects(paths):
    """Arabic URLs whose page was never translated send readers to the English page."""
    ht = ROOT / 'public/.htaccess'
    s = ht.read_text()
    a, b = '# ---- BEGIN untranslated Arabic pages (scripts/build_legacy.py) ----', '# ---- END untranslated Arabic pages ----'
    rules = '\n'.join(f'RewriteRule ^ar{re.escape(p)}$ {p} [L,R=301]' for p in sorted(paths))
    block = f'{a}\n{rules}\n{b}'
    s = re.sub(re.escape(a) + '.*?' + re.escape(b), lambda m: block, s, flags=re.S) if a in s else s.replace('</IfModule>', block + '\n</IfModule>', 1)
    ht.write_text(s)

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
    # A block of images with no heading belongs to the section after it.
    merged, carry = [], []
    for s in sections:
        if not s['h2'] and all(n['t'] == 'img' for n in s['nodes']):
            carry += s['nodes']; continue
        s['nodes'] = carry + s['nodes']; carry = []
        merged.append(s)
    if carry and merged: merged[-1]['nodes'] += carry
    sections = [s for s in merged if s['h2'] or s['nodes']]
    for s in sections:
        # The first image sits beside the heading; the rest stay in the text.
        first = next((n for n in s['nodes'] if n['t'] == 'img'), None)
        if first and s['h2']:
            s['img'] = first; s['nodes'] = [n for n in s['nodes'] if n is not first]
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
    en_cat = cat
    if lang == 'ar':
        en_rec = en_by_path.get(path[3:]) or {}
        m = next((re.match(r'^by \|.*?\|\s*(.*?),?\s*\|', b.get('text', '')) for b in en_rec.get('blocks', []) if b.get('text', '').startswith('by |')), None)
        en_cat = m.group(1).strip(' ,') if m else ''
    topic = topic_of(slug, en_cat)
    label_en, label_ar, service = TOPICS[topic]
    service = SLUG_SERVICE.get(slug, service)
    cat = label_ar if lang == 'ar' else label_en
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
    fm.append(f'category: {yaml_str(cat)}')
    fm.append(f'service: {service}')
    fm.append('---')
    dest = BLOG / ('ar' if lang == 'ar' else '') / f'{slug}.md'
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(rank_claims.fix('\n'.join(fm) + '\n\n' + body_html(nodes) + '\n'))
    return slug

def redirect_rules():
    ht = (ROOT / 'public/.htaccess').read_text()
    return [(re.compile(m.group(1)), m.group(2)) for m in re.finditer(r'^RewriteRule (\^\S+) (/\S*) \[L,R=301\]', ht, re.M) if m.group(1) != '^(.*)$']

def final_links(pages):
    """Point internal links at their final URL (no redirect hops) and keep Arabic readers in Arabic."""
    rules = redirect_rules()
    exists = {p['path'] for p in pages} | {'/', '/ar/', '/contact-us/', '/ar/contact-us/', '/blog/', '/ar/blog/', '/privacy-policy/', '/ar/privacy-policy/',
              '/website-development-company-egypt/', '/signage-internal-branding-egypt/', '/ksa/signage-internal-branding-in-jeddah/'}
    exists |= {'/ar/' + p['slug'] + '/' for p in json.loads((ROOT / 'src/data/service-pages.ar.json').read_text())}
    exists |= {'/' + f.stem + '/' for f in BLOG.glob('*.md')} | {'/ar/' + f.stem + '/' for f in (BLOG / 'ar').glob('*.md')}
    def resolve(path):
        for _ in range(4):
            if path in exists: return path
            for rx, to in rules:
                m = rx.match(path[1:])
                if m:
                    path = re.sub(r'\$(\d)', lambda g: m.group(int(g.group(1))) or '', to); break
            else:
                return None
        return path if path in exists else None
    # Old URLs that the live site redirects to Jeddah pages, while the posts link them with Cairo/Egypt anchor text.
    intent = {'/digital-marketing/': '/digital-marketing-egypt-cairo/', '/ooh-3/': '/', '/event-managementbtl/': '/event-management-cairo-egypt/',
              '/ar/digital-marketing/': '/ar/digital-marketing-egypt-cairo/', '/ar/ooh-3/': '/ar/', '/ar/event-managementbtl/': '/ar/event-management-cairo-egypt/'}
    def fix(text, lang):
        def rep(m):
            href = intent.get(m.group(2), m.group(2))
            if not href.startswith('/') or href.startswith(('/img/', '/css/', '/js/')): return m.group(0)
            path = href.split('#')[0].split('?')[0]
            if not path.endswith('/') and '.' not in path.rsplit('/', 1)[-1]: path += '/'
            target = resolve(path) or path
            if lang == 'ar' and not target.startswith('/ar/'):
                ar = resolve('/ar' + target if target != '/' else '/ar/')
                if ar and ar.startswith('/ar'): target = ar
            return f'href={m.group(1)}"{target}{m.group(1)}"'
        # Page data is JSON text, where the quotes are escaped (href=\"...\").
        return re.sub(r'href=(\\?)"([^"\\]*)\1"', rep, text)
    for f in list(BLOG.glob('*.md')) + list((BLOG / 'ar').glob('*.md')):
        lang = 'ar' if f.parent.name == 'ar' else 'en'
        t = f.read_text(); n = fix(t, lang)
        if n != t: f.write_text(n)
    for f in PAGES_DIR.glob('*.json'):
        t = f.read_text(); n = fix(t, 'ar' if f.name.endswith('.ar.json') else 'en')
        if n != t: f.write_text(n)
    return [json.loads(fix(json.dumps(p, ensure_ascii=False), p['lang'])) for p in pages]

FIXES = json.loads((ROOT / 'scripts/copy_fixes.json').read_text())

def copy_fixes(page):
    """Corrections to carried-over copy (scripts/copy_fixes.json). Meta title and description stay as they were."""
    keep = {k: page[k] for k in ('title', 'description') if k in page}
    text = json.dumps(page, ensure_ascii=False)
    for where, find, repl in FIXES['replace']:
        if where in ('*', page['path']):
            text = text.replace(json.dumps(find, ensure_ascii=False)[1:-1] if not find.startswith('"') else find,
                                json.dumps(repl, ensure_ascii=False)[1:-1] if not repl.startswith('"') else repl)
    page = json.loads(text)
    page.update(keep)
    drop = set(FIXES['drop_p'].get(page['lang'], []))
    for s in page.get('sections', []):
        if s.get('nodes'):
            s['nodes'] = [n for n in s['nodes'] if not (n.get('t') in ('p', 'h3') and n.get('html', '').strip() in drop)]
    # "top", never "best", for Doers' ranking claims, titles and descriptions included (scripts/rank_claims.py).
    return json.loads(rank_claims.fix(json.dumps(page, ensure_ascii=False)))

def main():
    recs = load()
    untranslated = {path_of(r['url'])[3:] for r in recs if r['lang'] == 'ar' and arabic_share(r) < 0.5 and path_of(r['url'])[3:] not in SKIP_PAGES}
    # Hand translations (see README): posts live in src/content/blog/ar/ with `translated: true`, pages in src/data/translations/.
    manual_posts = {f'/{f.stem}/' for f in (BLOG / 'ar').glob('*.md') if re.search(r'^translated: true$', f.read_text(), re.M)}
    manual = {}
    for f in PAGES_DIR.glob('*.json'):
        page = json.loads(f.read_text())
        manual[(page_key(page['path']), page['lang'])] = page
    untranslated -= manual_posts | {'/' + k.replace('__', '/') + '/' for (k, lang) in manual if lang == 'ar'}
    recs = [r for r in recs if not (r['lang'] == 'ar' and path_of(r['url'])[3:] in untranslated)]
    write_ar_redirects(untranslated)
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
                    if (page_key(p), lang) in manual:
                        pages.append(manual[(page_key(p), lang)]); continue
                    pages.append(build_page(r, common, used, en_by_path))
                elif lang == 'ar' and p[3:] in manual_posts:
                    continue
                elif p.removeprefix('/ar') not in SKIP_PAGES:
                    build_post(r, common, used, en_by_path); posts[lang] += 1
    # Images used only by hand-written pages: rebuild them from the download cache and keep them.
    for page in manual.values():
        for name in set(re.findall(r'/img/legacy/([^"\s]+)', json.dumps(page))):
            stem = name.rsplit('.', 1)[0]
            src = next(CACHE.glob(stem + '.*'), None)
            m = re.match(r'(\d{4})-(\d{2})-(.+)$', src.name) if src else None
            if m:
                local_img(f'{SITE}/wp-content/uploads/{m.group(1)}/{m.group(2)}/{m.group(3)}', used)
    pages = [copy_fixes(p) for p in pages]
    pages = final_links(pages)
    (ROOT / 'src/data/legacy-pages.json').write_text(json.dumps(pages, ensure_ascii=False, indent=1))
    link_posts.run(BLOG)  # contextual links from posts to under-linked service pages
    for f in IMG_DIR.glob('*'):
        if f.name not in used: f.unlink()
    print(f'{len(pages)} pages, posts {dict(posts)}, {len(used)} images, {len(untranslated)} untranslated Arabic URLs redirected')

if __name__ == '__main__':
    main()
