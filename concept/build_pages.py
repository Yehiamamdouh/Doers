"""Build the Doers service pages from one shared template.

Run: python3 concept/build_pages.py
Each page is written to concept/<slug>/index.html, matching its live URL /<slug>/.
"""
import html
import json
import pathlib

ROOT = pathlib.Path(__file__).parent
SITE = "https://doersadv.com"

# Services menu: (name, Cairo URL, Jeddah URL). New pages use a leading "*" = built here, not live yet.
SERVICES = [
    ("Branding", "/branding-agency-egypt/", "/ksa/branding-agency-in-jeddah/"),
    ("Event Management", "/event-management-cairo-egypt/", "/ksa/event-management-agency-in-jeddah/"),
    ("Booth Production", "/booth-production-egypt/", "/ksa/booth-production-in-jeddah/"),
    ("Signage & Internal Branding", "*/signage-internal-branding-egypt/", None),
    ("Digital Marketing", "/digital-marketing-egypt-cairo/", "/ksa/digital-marketing-agency-in-jeddah/"),
    ("SEO", "/seo/", "/ksa/seo-agency-in-jeddah/"),
    ("Web Development", "*/website-development-company-egypt/", "/ksa/website-development-company-in-jeddah/"),
    ("Media Production", "/media-production-egypt/", None),
    ("Outdoor (OOH)", "/outdoor-advertising-egypt/", "/ksa/ooh-outdoor-agency-in-jeddah/"),
    ("TV Advertising", "/tv-advertising/", "/ksa/tv-advertising-in-jeddah/"),
    ("Radio Advertising", "/radio-advertising-egypt/", "/ksa/radio-advertising-agencies-in-jeddah/"),
    ("Reputation Management", "/listening-and-reputation-management/", "/ksa/listening-and-reputation-management-in-jeddah/"),
]


def href(path, depth):
    """New pages link relatively (so the preview works); existing pages link to the live site."""
    if path.startswith("*"):
        return "../" * depth + path[2:]
    return SITE + path


def menu(depth):
    eg = "".join(f'<a href="{href(u, depth)}">{n}</a>' for n, u, _ in SERVICES if u)
    ksa = "".join(f'<a href="{href(u, depth)}">{n}</a>' for n, _, u in SERVICES if u)
    return eg, ksa


def page(p):
    depth = 1
    up = "../" * depth
    eg, ksa = menu(depth)
    url = f"{SITE}/{p['slug']}/"
    esc = html.escape
    schema = {
        "@context": "https://schema.org",
        "@graph": [
            {"@type": "WebPage", "@id": url, "url": url, "name": p["title"], "description": p["desc"],
             "inLanguage": "en-US", "isPartOf": {"@id": f"{SITE}/#website"},
             "breadcrumb": {"@id": url + "#breadcrumb"}},
            {"@type": "Service", "name": p["service"], "serviceType": p["service"], "areaServed": p["areas"],
             "provider": {"@id": f"{SITE}/#organization"}, "url": url},
            {"@type": "BreadcrumbList", "@id": url + "#breadcrumb", "itemListElement": [
                {"@type": "ListItem", "position": 1, "name": "Home", "item": SITE + "/"},
                {"@type": "ListItem", "position": 2, "name": p["crumb"]}]},
            {"@type": "FAQPage", "mainEntity": [
                {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}}
                for q, a in p["faq"]]},
            {"@type": "Organization", "@id": f"{SITE}/#organization", "name": "Doers Advertising Agency", "url": SITE + "/"},
        ],
    }
    faq = "".join(f"<details><summary>{esc(q)}</summary><p>{esc(a)}</p></details>" for q, a in p["faq"])
    feats = "".join(f'<div><span class="label">{esc(k)}</span><h3>{esc(t)}</h3><p>{esc(d)}</p></div>' for k, t, d in p["feats"])
    steps = "".join(f"<li><h3>{esc(t)}</h3><p>{esc(d)}</p></li>" for t, d in p["steps"])
    tags = "".join(f"<span>{esc(t)}</span>" for t in p["tags"])
    proof = p["proof"](up)
    return f"""<!doctype html>
<html lang="en" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(p['title'])}</title>
<meta name="description" content="{esc(p['desc'])}">
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">
<link rel="canonical" href="{url}">
<link rel="alternate" hreflang="en" href="{url}">
<link rel="alternate" hreflang="ar" href="{SITE}/ar/{p['slug']}/">
<meta property="og:locale" content="en_US">
<meta property="og:type" content="article">
<meta property="og:title" content="{esc(p['title'])}">
<meta property="og:description" content="{esc(p['desc'])}">
<meta property="og:url" content="{url}">
<meta property="og:site_name" content="Doers Advertising Agency">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="{SITE}/wp-content/uploads/2023/09/favicon-32.jpg" sizes="32x32">
<script type="application/ld+json">{json.dumps(schema, ensure_ascii=False)}</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="{up}assets/site.css">
</head>
<body>
<header class="nav">
  <div class="wrap">
    <a class="logo" href="{up}"><img src="{up}img/logo.png" alt="Doers Advertising Agency" width="500" height="322"></a>
    <ul class="menu">
      <li><a href="{up}#work">Selected work</a></li>
      <li class="dd"><a href="{up}#services">What we do</a>
        <div class="mega"><div><div class="label">Cairo</div>{eg}</div><div><div class="label">Jeddah</div>{ksa}</div></div>
      </li>
      <li><a href="{up}#who">Who we are</a></li>
      <li><a href="{SITE}/blog/">Blog</a></li>
    </ul>
    <div class="nav-r">
      <a class="lang" href="{SITE}/ar/{p['slug']}/" hreflang="ar" lang="ar">عربي</a>
      <a class="btn btn-line" href="{SITE}/contact-us/">Start a project <span class="arrow">↗</span></a>
    </div>
  </div>
</header>
<main>
<div class="wrap">
  <nav class="crumbs label" aria-label="Breadcrumb"><a href="{up}">Home</a><span>/</span><span>{esc(p['crumb'])}</span></nav>
  <section class="p-hero">
    <div>
      <h1 class="label eyebrow">{esc(p['eyebrow'])}</h1>
      <p class="disp">{p['h1']}</p>
    </div>
    <div>
      <p>{esc(p['lead'])}</p>
      <div class="cta-row">
        <a class="btn btn-o" href="{SITE}/contact-us/">{esc(p['cta'])} <span class="arrow">↗</span></a>
        <a class="btn btn-line" href="https://wa.me/201101000255">WhatsApp us</a>
      </div>
    </div>
  </section>

  <section class="p-sec">
    <h2>{p['feat_h']}</h2>
    <div class="feat">{feats}</div>
  </section>

  {proof}

  <section class="p-sec">
    <h2>How we <em>work.</em></h2>
    <ol class="steps">{steps}</ol>
  </section>

  <section class="p-sec two">
    <div><h2 style="margin-bottom:0">{p['why_h']}</h2></div>
    <div>{''.join(f'<p>{esc(x)}</p>' for x in p['why'])}<div class="tags" style="margin-top:20px">{tags}</div></div>
  </section>

  <section class="p-sec faq">
    <h2>Questions, <em>answered.</em></h2>
    {faq}
  </section>
</div>

<section class="cta">
  <div class="wrap">
    <h2>{p['cta_h']}</h2>
    <div class="row2">
      <p>{esc(p['cta_p'])}</p>
      <a class="btn" href="{SITE}/contact-us/">Start a project <span class="arrow">↗</span></a>
    </div>
  </div>
</section>
</main>
<footer>
  <div class="wrap">
    <div class="fgrid">
      <div><p class="ftag">Doers<br><em>do it all.</em></p></div>
      <div><span class="label">What we do</span><ul>{''.join(f'<li><a href="{href(e or k, depth)}">{n}</a></li>' for n, e, k in SERVICES)}</ul></div>
      <div><span class="label">Cairo</span><p>Raslan St, Nasr City, 9th Area, Block 23, Tower 3</p><p dir="ltr" style="margin-top:8px"><a href="tel:+201101000255">+20 110 1000 255</a></p></div>
      <div><span class="label">Jeddah</span><p>Zahran Building Center, Tower B, 12th Floor</p><p dir="ltr" style="margin-top:8px"><a href="tel:+966509881646">+966 50 988 1646</a></p></div>
      <div><span class="label">Follow</span><ul><li><a href="https://www.facebook.com/DoersAdv/">Facebook</a></li><li><a href="https://www.instagram.com/doersadvertising/">Instagram</a></li><li><a href="https://www.linkedin.com/company/doers-advertising">LinkedIn</a></li><li><a href="https://vimeo.com/doersadvertising">Vimeo</a></li></ul></div>
    </div>
    <div class="fbot"><span>© Doers Advertising LTD</span><span>Sun–Thu · 10:00–18:00</span></div>
  </div>
</footer>
<a class="wa" href="https://wa.me/201101000255" aria-label="WhatsApp"><svg width="28" height="28" viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.3 14.2c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.5-3.9-4.7-4.1-.1-.2-1.1-1.5-1.1-2.9s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.3.5-.4.4c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.3.1.5.1.6-.1l.9-1.1c.2-.3.4-.2.6-.1l1.9.9c.3.1.5.2.5.3.1.2.1.7-.1 1.2z"/></svg></a>
</body>
</html>
"""


def web_proof(up):
    return """<section class="p-sec">
    <h2>Built on <em>results.</em></h2>
    <div class="two">
      <div>
        <p>A website only pays off when people find it and act on it. Our web team sits next to our performance and SEO teams, so the site is planned around the campaigns that will drive traffic to it.</p>
        <p>Recent digital work from the same team: paid social for Safi reached 6M+ unique users and 500K clicks on a $20K budget, and a real estate lead campaign on Instagram and TikTok delivered leads at $7.5 each.</p>
      </div>
      <div class="names" style="grid-template-columns:1fr 1fr">
        <div><b>6M+</b><span>Unique users reached, Safi</span></div>
        <div><b>500K</b><span>Clicks, Safi</span></div>
        <div><b>$7.5</b><span>Cost per lead, real estate</span></div>
        <div><b>$1.51</b><span>Effective CPC, real estate</span></div>
      </div>
    </div>
    <p class="note">Strategy work for Dubai Future Foundation and a Gen Z investor-education platform concept for Dubai Financial Market came from the same digital team.</p>
  </section>"""


def signage_proof(up):
    clients = [
        ("AXA", "Cairo head office · design, print, production, installation"),
        ("Bosch", "Signage & internal branding"),
        ("Arab Bank", "Signage & internal branding"),
        ("Nestlé", "Signage & internal branding"),
        ("McVitie's", "Signage & internal branding"),
        ("Dina Farms", "Signage & internal branding"),
        ("Marriott Hotels", "Hotel signage"),
        ("Sheraton", "Hotel signage"),
        ("Serenity Hotels & Resorts", "Resort signage & branding"),
        ("Sway Mall", "Mall signage"),
        ("Trivium Square Mall", "Mall signage"),
        ("IGNITE Arcade Nation", "Venue branding"),
        ("RSA", "New Cairo building · internal branding"),
        ("Sanofi", "Offices in Jeddah, Riyadh & Dubai"),
        ("MSD", "Dubai office branding"),
        ("Mash Premier", "Head office branding"),
    ]
    cells = "".join(f"<div><b>{html.escape(n)}</b><span>{html.escape(d)}</span></div>" for n, d in clients)
    return f"""<section class="p-sec">
    <h2>Trusted <em>on site.</em></h2>
    <div class="names">{cells}</div>
  </section>"""


PAGES = [
    {
        "slug": "website-development-company-egypt",
        "title": "Website Development Company in Egypt | Doers Advertising Agency",
        "desc": "Fast, bilingual, SEO-ready websites and online stores built in Cairo by Doers: corporate sites, landing pages, Shopify and Salla stores, and custom web platforms.",
        "service": "Website development",
        "areas": ["Egypt", "Saudi Arabia", "United Arab Emirates"],
        "crumb": "Website Development",
        "eyebrow": "Website development company in Egypt",
        "h1": "Websites that <em>work hard.</em>",
        "lead": "We design and build fast, bilingual websites and online stores for brands in Egypt and the Gulf. Every site ships SEO-ready, measurable from day one, and easy for your team to update.",
        "cta": "Plan my website",
        "feat_h": "What we <em>build.</em>",
        "feats": [
            ("Corporate", "Company websites", "Clear structure, strong copy and fast pages that explain what you do and turn visitors into enquiries."),
            ("Campaigns", "Landing pages", "Focused pages for launches and ad campaigns, wired to your pixels and CRM so every lead is tracked."),
            ("E-commerce", "Online stores", "Shopify for brands selling internationally, Salla or Zid for Saudi-first stores, with local payments and shipping."),
            ("Platforms", "Custom web apps", "Portals, booking tools and learning platforms when an off-the-shelf builder won't fit."),
            ("Arabic & English", "Bilingual by design", "Proper right-to-left layouts and Arabic typography, not a translated copy of the English site."),
            ("Care", "Hosting & support", "Deployment, backups, security updates and monthly performance checks after launch."),
        ],
        "proof": web_proof,
        "steps": [
            ("Discovery", "Goals, audience, competitors and the pages you really need."),
            ("Sitemap & content", "Page structure, SEO keywords and copy, in Arabic and English."),
            ("Design", "Homepage and key templates first, reviewed on desktop and mobile."),
            ("Build", "Clean, fast code or the right platform, with analytics and tracking."),
            ("Launch", "Redirects, Search Console, speed and accessibility checks before go-live."),
            ("Grow", "Monthly reports, content updates and conversion improvements."),
        ],
        "why_h": "Why a website from an <em>agency?</em>",
        "why": [
            "Most websites are built by one team and marketed by another. At Doers the same people plan the brand, the campaigns and the site, so the message, the design and the tracking line up.",
            "We have 15+ years of marketing experience across Egypt, Saudi Arabia and the UAE, and we're a Google Partner and HubSpot Partner.",
        ],
        "tags": ["HTML & JavaScript", "WordPress", "Shopify", "Salla", "Zid", "Google Analytics 4", "Tag Manager", "HubSpot", "Core Web Vitals", "Arabic RTL"],
        "faq": [
            ("How long does a company website take?", "A typical corporate website takes 3 to 6 weeks from kickoff to launch, depending on the number of pages and how quickly content is approved. Landing pages can go live within a week."),
            ("Do you build websites in Arabic and English?", "Yes. We design both languages from the start, with right-to-left layouts, Arabic typography and separate SEO for each language."),
            ("Will I be able to update the website myself?", "Yes. We set up an editing dashboard for your team and walk them through it, and we can also handle updates for you on a monthly plan."),
            ("Can you redesign my current website without losing Google rankings?", "Yes. We keep your existing URLs where possible, map redirects for any that change, and check titles, meta descriptions and structured data against the old site before launch."),
            ("Do you build online stores?", "Yes. We recommend Shopify for brands that will sell internationally and Salla or Zid for Saudi-first stores, and we connect local payment and shipping providers."),
        ],
        "cta_h": "Let's build<br>it right.",
        "cta_p": "Tell us what the website needs to do. We'll reply within one business day with next steps.",
    },
    {
        "slug": "signage-internal-branding-egypt",
        "title": "Signage & Internal Branding Company in Egypt | Doers Advertising Agency",
        "desc": "Indoor and outdoor signage, wayfinding and office branding designed, fabricated and installed by Doers for AXA, Bosch, Arab Bank, Nestlé, Marriott and more across Egypt and the Gulf.",
        "service": "Signage and internal branding",
        "areas": ["Egypt", "Saudi Arabia", "United Arab Emirates"],
        "crumb": "Signage & Internal Branding",
        "eyebrow": "Signage & internal branding in Egypt",
        "h1": "Signs people <em>notice.</em>",
        "lead": "From the sign on your building to the walls of your meeting rooms, we design, fabricate and install signage and internal branding that make your space look like your brand.",
        "cta": "Request a site survey",
        "feat_h": "What we <em>make.</em>",
        "feats": [
            ("Outdoor", "Building & shop signage", "3D letters, illuminated lightboxes, pylons and facade signs built for the sun and dust."),
            ("Indoor", "Office branding", "Reception walls, wall graphics, frosted-glass film and meeting room branding."),
            ("Wayfinding", "Directional systems", "Floor directories, room signs and directional signs for offices, hospitals and malls."),
            ("Retail & malls", "Mall signage", "Storefronts, mall directories and in-store branding that follows landlord guidelines."),
            ("Hospitality", "Hotel signage", "Signage packages for hotels and resorts, from arrival to room numbering."),
            ("Rollouts", "Multi-site programs", "One standard applied across branches in Egypt, Saudi Arabia and the UAE."),
        ],
        "proof": signage_proof,
        "steps": [
            ("Site survey", "We measure the space, photograph it and check power and fixing points."),
            ("Design", "Signage and branding designs with renders on your real walls."),
            ("Samples & approvals", "Material samples and sign-off from you, the landlord and the authorities where needed."),
            ("Fabrication", "Production with quality checks at each stage, before anything reaches your site."),
            ("Installation", "Scheduled installation, often after hours so your business keeps running."),
            ("Aftercare", "Maintenance and replacements when your team or brand changes."),
        ],
        "why_h": "One team from <em>design to drill.</em>",
        "why": [
            "Signage usually passes between a designer, a print shop and an installer, and quality gets lost at every handover. Doers runs the whole job, so the sign that goes up matches the design you approved.",
            "We've branded head offices, banks, hotels and malls, including Sanofi offices in Jeddah, Riyadh and Dubai and the MSD office in Dubai.",
        ],
        "tags": ["3D letters", "Lightboxes", "Pylons", "Acrylic & metal", "Wall graphics", "Frosted film", "Wayfinding", "Installation"],
        "faq": [
            ("Do you handle installation as well as design?", "Yes. We handle the full job: site survey, design, fabrication and installation, plus maintenance after handover."),
            ("How long does an office branding project take?", "Most office branding projects take 2 to 4 weeks after design approval, depending on materials and the size of the space."),
            ("Can you work outside Egypt?", "Yes. We deliver signage and branding in Saudi Arabia and the UAE, including office branding for Sanofi in Jeddah, Riyadh and Dubai."),
            ("Can you install without disrupting our work?", "Yes. We schedule installation around your working hours, including evenings and weekends when needed."),
            ("Do you help with permits and landlord approvals?", "Yes. We prepare the drawings and specifications that malls, landlords and authorities ask for, and follow the approval through."),
        ],
        "cta_h": "Let's put your<br>name up.",
        "cta_p": "Send us your location and what you need. We'll book a site survey and reply within one business day.",
    },
]

if __name__ == "__main__":
    for p in PAGES:
        out = ROOT / p["slug"] / "index.html"
        out.parent.mkdir(exist_ok=True)
        out.write_text(page(p), encoding="utf-8")
        print("wrote", out.relative_to(ROOT.parent))
