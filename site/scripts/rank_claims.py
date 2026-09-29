"""Doers' ranking claims: say "top" (Arabic أبرز), never "best" (أفضل), and "ranked" for the TechBehemoths award.
Only claims about Doers or its services change; everyday uses like "best practices" or "best results" stay.
Used by scripts/build_legacy.py for pages carried over from the old site (titles and descriptions included),
and run directly (python3 scripts/rank_claims.py) on the hand-written sources."""
import re, sys, pathlib

NOUNS = r'(?i:agency|agencies|company|companies|service|services|provider|providers|partner|firm|choice)'
RULES = [
    (re.compile(r"Named one of Egypt's best"), "Ranked among Egypt's top"),
    (re.compile(r"\b(Doers\s+)?[Ii]s\s+[Tt]he\s+Best\s+for\b"), lambda m: (m.group(1) or '') + 'Is the Top Choice for'),
    (re.compile(r"\b[Tt]he\s+[Bb]est\s+for\s+[Yy]ou\b"), 'the Top Choice for You'),
    # best/Best + up to five words + agency/company/service... (the claim noun)
    (re.compile(r"\b(B|b)est(?=(?:\s+(?:&#38;|&amp;|&|[\w’'-]+)){0,6}?\s+" + NOUNS + r"\b)"), lambda m: 'Top' if m.group(1) == 'B' else 'top'),
    (re.compile(r"\b[Tt]he\s+best\b(?=\s*</)"), 'a top agency'),
    (re.compile(r"Discover the Best TV"), 'Discover Top TV'),
    (re.compile(r"Doers(\s*[,–-]\s*)the best\b"), lambda m: 'Doers' + m.group(1) + 'a top'),
    (re.compile(r"خيارك الأفضل"), 'خيارك الأول'),
    (re.compile(r"(Doers(?:&quot;|\W){0,3}\s*)هي الأفضل"), lambda m: m.group(1) + 'هي الخيار الأول'),
    (re.compile(r"(Doers(?:&quot;|\W){0,3}\s*)الأفضل لك"), lambda m: m.group(1) + 'الخيار الأول لك'),
    (re.compile(r"(Doers\s*[-–،,]\s*)(?:ال)?أفضل"), lambda m: m.group(1) + 'الأبرز'),
    (re.compile(r"فلا تبحث عن أفضل من"), 'فلا تبحث أبعد من'),
    (re.compile(r"أفضل(?=\s+(?:الحلول|خيارات الوسائط))"), 'أبرز'),
    (re.compile(r"أفضل(?=\s+(?:ال)?(?:وكالة|وكالات|شركة|شركات|خدمات|خدمة|مزود|شريك))"), 'أبرز'),
    (re.compile(r"(?:من\s+)?أفضل شركات"), 'من أبرز شركات'),
]


def fix(text):
    for pat, rep in RULES:
        text = pat.sub(rep, text)
    return text


if __name__ == '__main__':
    root = pathlib.Path(__file__).resolve().parent.parent
    files = [*root.glob('src/data/services/*.json'), root / 'src/data/faqs.json', root / 'src/data/service-pages.json', root / 'src/data/service-pages.ar.json',
             root / 'src/content/home.html', root / 'src/i18n/home.ar.json', root / 'src/data/video-bands.json', root / 'src/data/home-services.json', root / 'src/data/home-schema.json',
             *root.glob('src/data/pages/*.json'), *root.glob('src/content/blog/**/*.md'), *root.glob('src/pages/**/*.astro'), *root.glob('src/components/*.astro'),
             *root.glob('scripts/rich/*.py')]  # not copy_fixes.json: its 'find' strings must match the old site's text
    changed = 0
    for f in files:
        if not f.exists(): continue
        s = f.read_text(); t = fix(s)
        if s != t:
            f.write_text(t); changed += 1; print('fixed', f.relative_to(root))
    print(changed, 'files')
