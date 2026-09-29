"""Contextual links from blog posts to the service pages that get the fewest links.

For each post, the first mention of a service (e.g. "radio advertising", «إعلانات الراديو») inside a paragraph is
linked to that service's page, at most two new links per post and never twice to the same page. Text already inside
a link, headings and the byline paragraph are left alone. Branding and digital marketing are skipped: posts already
link to them heavily. Run by scripts/build_legacy.py after posts are written, and safe to run again."""
import re, pathlib

EN = [  # (pattern, Cairo page); earlier entries win when a paragraph mentions several services
    (r"outdoor advertising|out-of-home|OOH|billboards?", '/outdoor-advertising-egypt/'),
    (r"TV advertising|television advertising|TV commercials?|TV ads?", '/tv-advertising/'),
    (r"radio advertising|radio ads?|radio spots?", '/radio-advertising-egypt/'),
    (r"exhibition stands?|exhibition booths?|booth production|trade show booths?", '/booth-production-egypt/'),
    (r"signage|shop signs?|wayfinding", '/signage-internal-branding-egypt/'),
    (r"video production|motion graphics|explainer videos?|animated videos?|media production", '/media-production-egypt/'),
    (r"reputation management|social listening|online reputation", '/listening-and-reputation-management/'),
    (r"event management|event planning|corporate events?|product launch(?:es)?", '/event-management-cairo-egypt/'),
    (r"website development|web development|web design", '/website-development-company-egypt/'),
    (r"search engine optimi[sz]ation|SEO", '/seo/'),
]
AR = [
    (r"إعلانات الطرق|الإعلانات الخارجية|الإعلان الخارجي|اللوحات الإعلانية", '/outdoor-advertising-egypt/'),
    (r"إعلانات التلفزيون|الإعلانات التلفزيونية|الإعلان التلفزيوني", '/tv-advertising/'),
    (r"إعلانات الراديو|الإعلانات الإذاعية|الإعلان الإذاعي", '/radio-advertising-egypt/'),
    (r"أجنحة المعارض|جناح المعرض|جناح معرض", '/booth-production-egypt/'),
    (r"اللافتات", '/signage-internal-branding-egypt/'),
    (r"إنتاج الفيديو|الموشن جرافيك|الإنتاج الإعلامي|الفيديوهات المتحركة", '/media-production-egypt/'),
    (r"إدارة السمعة|السمعة الرقمية|الاستماع الاجتماعي", '/listening-and-reputation-management/'),
    (r"تنظيم الفعاليات|إدارة الفعاليات|إطلاق المنتجات|فعاليات الشركات", '/event-management-cairo-egypt/'),
    (r"تطوير المواقع|تصميم المواقع|تطوير الويب", '/website-development-company-egypt/'),
    (r"تحسين محركات البحث", '/seo/'),
]
MAX_NEW = 2
TOKEN = re.compile(r'(<a\b.*?</a>|<[^>]+>)', re.S)


def link(md, lang, own):
    head, sep, body = md.partition('\n---\n')
    if not sep:
        return md
    rules = AR if lang == 'ar' else EN
    pre = '/ar' if lang == 'ar' else ''
    linked = set(re.findall(r'href="([^"#?]+)"', body))
    added = body.count('class="auto-link"')  # links this script added on earlier runs count towards the limit
    paras = re.split(r'(<p>.*?</p>)', body, flags=re.S)
    first_p = True
    for i, para in enumerate(paras):
        if added >= MAX_NEW or not para.startswith('<p>'):
            continue
        if first_p:  # the "by … | date | category" byline carried over from WordPress
            first_p = False
            if re.search(r'\|\s*<a', para):
                continue
        for pat, path in rules:
            target = pre + path
            if target in linked or target == own:
                continue
            rx = re.compile(r'(?<![\w؀-ۿ])(' + pat + r')(?![\w؀-ۿ])', 0 if lang == 'ar' else re.I)
            parts = TOKEN.split(para)
            done = False
            for k, part in enumerate(parts):
                if done or not part or part.startswith('<'):
                    continue
                m = rx.search(part)
                if m:
                    parts[k] = part[:m.start()] + f'<a class="auto-link" href="{target}">{m.group(1)}</a>' + part[m.end():]
                    done = True
            if done:
                para = ''.join(parts); paras[i] = para
                linked.add(target); added += 1
                break  # one new link per paragraph
    return head + sep + ''.join(paras)


def run(blog_dir):
    n = 0
    for f in pathlib.Path(blog_dir).rglob('*.md'):
        lang = 'ar' if f.parent.name == 'ar' else 'en'
        own = ('/ar/' if lang == 'ar' else '/') + f.stem + '/'
        t = f.read_text(); u = link(t, lang, own)
        if u != t:
            f.write_text(u); n += 1
    return n


if __name__ == '__main__':
    root = pathlib.Path(__file__).resolve().parent.parent
    print(run(root / 'src/content/blog'), 'posts linked')
