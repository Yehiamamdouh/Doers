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
    ("Signage & Internal Branding", "*/signage-internal-branding-egypt/", "*/ksa/signage-internal-branding-in-jeddah/"),
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
    depth = p["slug"].count("/") + 1
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
    feats = "".join(
        (f'<div class="has-img"><img src="{up}img/signage/{f[3]}.jpg" alt="{esc(f[1])}" loading="lazy">' if len(f) > 3 else '<div>')
        + f'<span class="label">{esc(f[0])}</span><h3>{esc(f[1])}</h3><p>{esc(f[2])}</p></div>' for f in p["feats"])
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
  {p['mosaic'](up) if p.get('mosaic') else ''}

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


DISCIPLINES = [
    ("Website Development", "Corporate, marketing and product websites built from scratch, responsive, bilingual and tuned for Core Web Vitals.", "HTML5 · CSS3 · Tailwind · React · Next.js · PHP · Laravel · WordPress"),
    ("UI/UX Design", "Research, wireframes, design systems and clickable prototypes, with a WCAG 2.1 accessibility baseline.", "Figma · Adobe XD · Maze · Hotjar · Lottie"),
    ("E-Commerce", "Multi-currency, multi-language stores for GCC and MENA, with checkout flows built to cut abandonment.", "Shopify · WooCommerce · Magento · Laravel"),
    ("Web Applications", "CRMs, ERPs, dashboards and SaaS platforms with role-based access, audit logs and real-time features.", "Laravel · Node.js · NestJS · Vue · PostgreSQL · MongoDB · Redis · Docker"),
    ("Mobile Apps", "Cross-platform and native iOS and Android apps, published and maintained on both stores.", "React Native · Flutter · Swift · Kotlin · Firebase"),
    ("Payment Gateways", "Local and global gateways, wallets and Buy Now Pay Later, with tokenization and 3D Secure 2.", "HyperPay · PayTabs · Tap · MyFatoorah · Moyasar · Stripe"),
    ("Content Management", "Custom and headless CMSs with Arabic editorial tools, roles, approvals and scheduling.", "WordPress · Strapi · Sanity · Contentful · Drupal"),
    ("SEO", "Technical audits, Arabic keyword research, content clusters and monthly reporting tied to business KPIs.", "Search Console · Ahrefs · SEMrush · Screaming Frog · GA4"),
    ("Maintenance", "Security patches, daily backups, uptime monitoring and a named technical contact with SLA response times.", "Cloudflare · UptimeRobot · New Relic · Sentry · Wazuh"),
    ("AI Agents", "Chat and support agents connected to your website, knowledge base and CRM, answering in Arabic and English.", "LLM APIs · RAG · WhatsApp & web chat"),
]

STACK = [
    ("Frontend", "HTML5, CSS3, Tailwind, React, Next.js, Vue"),
    ("Backend", "PHP, Laravel, Node.js, NestJS, REST & GraphQL APIs"),
    ("Data", "PostgreSQL, MySQL, MongoDB, Redis"),
    ("Mobile", "React Native, Flutter, Swift, Kotlin, Firebase, TestFlight"),
    ("CMS", "WordPress, Strapi, Sanity, Contentful, Drupal"),
    ("Commerce", "Shopify, WooCommerce, Magento"),
    ("Saudi & GCC payments", "HyperPay, PayTabs, Tap, MyFatoorah, Moyasar"),
    ("Global payments", "Stripe, PayPal, Adyen, Checkout.com, 2Checkout"),
    ("Wallets & BNPL", "Apple Pay, Google Pay, mada, STC Pay, KNET, Tabby, Tamara"),
    ("Cloud & DevOps", "AWS, Cloudflare, Docker, auto-scaling, zero-downtime releases"),
    ("Monitoring & security", "Sentry, New Relic, UptimeRobot, Wazuh, SSL, daily backups"),
    ("Analytics", "GA4, Tag Manager, Mixpanel, Hotjar, Looker Studio"),
]

INCLUDED = [
    "Arabic and English with proper right-to-left layouts",
    "Responsive on desktop, tablet and mobile",
    "Core Web Vitals tuning: image optimization, lazy loading, caching",
    "SEO foundations: meta, schema, sitemap, clean URLs",
    "SSL, secure hosting setup, daily backups and uptime monitoring",
    "PCI-aware payments with tokenization and 3D Secure 2",
    "Analytics and conversion tracking from day one",
    "Full source code and admin handover documentation",
    "Training session for your team",
    "30 days of post-launch support",
]

WEBSITES = [
    ("AMHZ Group", "https://www.amhz-group.com/ar"), ("Haya Karima", "https://www.hayakarima.com/"),
    ("5 Quarters Edu", "https://5quartersedu.com/"), ("Spider Bees", "https://spiderbees.com/en"),
    ("AMAS Edu", "https://amasedu.com/"), ("Maestros Hoteleros", "https://maestroshoteleros.com/"),
    ("Three Egypt", "https://three-egypt.com"), ("Kafiil", "https://kafiil.com/"),
    ("Innvii Rent", "https://innvii-rent.com"), ("Ziydia", "https://ziydia.com"),
    ("Sadany Khalifa", "https://sadanykhalifa.com/ar"), ("Sera Cars", "https://seracars.com/en"),
    ("The Laundry Hub", "https://thelaundryhub.com.eg"), ("Matrix Clouds", "http://matrixclouds.com"),
    ("Tasahel", "http://www.tasahel.net"), ("Fly Aram", "https://flyaram.com"),
    ("Estedama Plus", "https://estedamaplus.com/en"), ("Nile Wise", "https://www.nilewisect.com/"),
]
APPS = [
    ("Innvii Rent", "com.Innvii.rent"), ("Dacktra", "com.dacktra.user"), ("FOF Clinic", "com.fofclinic"),
    ("Sera Cars", "com.sera.cars"), ("Qanoni", "app.qanoniapp.com"), ("Tomy", "com.Tomy"),
    ("GCI", "com.app.gci"), ("Shoglana", "com.shoglana"), ("DigEarth", "com.app.digearth"), ("Bkamthis", "com.Bkamthis.app"),
]


def web_proof(up):
    e = html.escape
    disc = "".join(
        f'<div class="disc-row"><span class="n">{i:02d}</span><h3>{e(n)}</h3><p>{e(d)}</p><p class="stk">{e(s)}</p></div>'
        for i, (n, d, s) in enumerate(DISCIPLINES, 1))
    stack = "".join(f'<div><span class="label">{e(g)}</span><p>{e(t)}</p></div>' for g, t in STACK)
    inc = "".join(f"<li>{e(x)}</li>" for x in INCLUDED)
    sites = "".join(f'<a href="{u}" rel="noopener" target="_blank"><b>{e(n)}</b><span>{e(u.split("//")[1].split("/")[0].replace("www.", ""))} ↗</span></a>' for n, u in WEBSITES)
    apps = "".join(f'<a href="https://play.google.com/store/apps/details?id={i}" rel="noopener" target="_blank"><b>{e(n)}</b><span>Google Play ↗</span></a>' for n, i in APPS)
    return f"""<section class="p-sec">
    <div class="stats-row">
      <div><b>80+</b><span>Projects delivered across web, mobile and enterprise platforms</span></div>
      <div><b>10</b><span>Service disciplines, from UI/UX to AI agents</span></div>
      <div><b>6</b><span>Countries: Egypt, Saudi Arabia, UAE, Kuwait, Jordan, Qatar</span></div>
      <div><b>12+</b><span>Industries, including government, real estate, healthcare and retail</span></div>
    </div>
  </section>

  <section class="p-sec">
    <h2>Ten disciplines. <em>One accountable team.</em></h2>
    <div class="disc">{disc}</div>
  </section>

  <section class="p-sec">
    <h2>The <em>stack.</em></h2>
    <div class="stack">{stack}</div>
  </section>

  <section class="p-sec two">
    <div><h2 style="margin-bottom:0">Included in <em>every build.</em></h2></div>
    <ul class="checks">{inc}</ul>
  </section>

  <section class="p-sec">
    <h2>Live <em>websites.</em></h2>
    <div class="folio">{sites}</div>
    <h2 style="margin-top:64px">Apps on the <em>stores.</em></h2>
    <div class="folio">{apps}</div>
  </section>

  <section class="p-sec">
    <h2>Traffic that <em>converts.</em></h2>
    <div class="names">
      <div><b>6M+</b><span>Unique users reached for Safi on a $20K budget</span></div>
      <div><b>500K</b><span>Clicks, Safi campaign</span></div>
      <div><b>$7.5</b><span>Cost per lead, real estate campaign</span></div>
      <div><b>$1.51</b><span>Effective CPC, real estate campaign</span></div>
    </div>
    <p class="note">Our web team sits next to our performance and SEO teams, so every site is planned around the campaigns that will send people to it.</p>
  </section>"""


from PIL import Image as _Img

SIGNAGE_GALLERY = [
    # (file, client, caption, category)
    ("arab-bank-night", "Arab Bank", "Illuminated facade letters and logo", "facades"),
    ("sheraton", "Sheraton", "Hotel facade letters", "hotels"),
    ("trivium-pylon", "Trivium Square", "Illuminated mall pylon", "malls"),
    ("axa-world-map", "AXA", "Head office wall graphics", "offices"),
    ("mcvities", "McVitie's", "Illuminated logo sign", "facades"),
    ("serenity-alpha-beach", "Serenity Alpha Beach", "Resort entrance sign", "hotels"),
    ("sway-mall", "Sway Mall", "Facade lighting and letters", "malls"),
    ("mash-vision", "Mash Premier", "Vision & values wall", "offices"),
    ("arab-bank-day", "Arab Bank", "Branch facade", "facades"),
    ("meat-moot", "Meat Moot", "Backlit restaurant sign", "facades"),
    ("serenity-stamina", "Serenity Hotels", "Backlit venue sign", "hotels"),
    ("axa-history-wall", "AXA", "“Proud of our history” wall", "offices"),
    ("trivium-facade", "Trivium Square", "Mall facade signage at night", "malls"),
    ("gourmet-wall", "Gourmet Food Stores", "3D letters and app signage", "facades"),
    ("serenity-alma-heights", "Serenity Alma Heights", "Resort entrance sign", "hotels"),
    ("mash-manifesto", "Mash Premier", "Manifesto wall", "offices"),
    ("marriott-pylon", "Marriott Hotels", "Wayfinding pylon", "hotels"),
    ("itsa-wood", "ITSA Wood", "Showroom facade sign", "facades"),
    ("axa-partition", "AXA", "Branded partition", "offices"),
    ("serenity-aurora", "Serenity Hotels", "Restaurant name sign", "hotels"),
    ("gourmet-3d", "Gourmet Food Stores", "3D logo letters", "facades"),
    ("mash-focus", "Mash Premier", "Feature wall", "offices"),
    ("serenity-stardust", "Serenity Hotels", "StarDust restaurant sign", "hotels"),
    ("dina-farms", "Dina Farms", "Building branding", "facades"),
    ("sanofi-office", "Sanofi", "Office branding, Jeddah, Riyadh & Dubai", "offices"),
    ("serenity-tau", "Serenity Hotels", "Illuminated letters at night", "hotels"),
    ("arab-bank-install", "Arab Bank", "Letters during installation", "facades"),
    ("msd-dubai", "MSD", "Dubai office graphics", "offices"),
    ("serenity-monterey", "Serenity Hotels", "Restaurant entrance", "hotels"),
    ("axa-reception", "AXA", "Reception branding", "offices"),
    ("serenity-ma-ligure", "Serenity Hotels", "Backlit logo wall", "hotels"),
    ("rsa-wall-of-fame", "RSA", "Glass wall of fame", "offices"),
    ("axa-kitchen", "AXA", "Pantry illustrations", "offices"),
    ("mash-never-try", "Mash Premier", "Motivational panel", "offices"),
    ("serenity-infinity", "Serenity Hotels", "Brushed metal letters", "hotels"),
    ("axa-print-less", "AXA", "Sustainability wall graphic", "offices"),
]
CATS = [("all", "All work"), ("facades", "Facades & shops"), ("hotels", "Hotels & resorts"), ("malls", "Malls"), ("offices", "Offices")]


def _size(up_img, name):
    im = _Img.open(ROOT / "img" / "signage" / f"{name}.jpg")
    return im.size


def signage_mosaic(up, names=("arab-bank-night", "trivium-pylon", "axa-world-map", "sheraton")):
    items = {f: (c, t) for f, c, t, _ in SIGNAGE_GALLERY}
    cells = ""
    for i, n in enumerate(names):
        w, h = _size(up, n)
        c, t = items[n]
        load = 'fetchpriority="high"' if i == 0 else 'loading="lazy"'
        cells += (f'<figure class="m{i}"><img src="{up}img/signage/{n}.jpg" alt="{html.escape(c)}: {html.escape(t)}" '
                  f'width="{w}" height="{h}" {load}><figcaption>{html.escape(c)}</figcaption></figure>')
    return f'<div class="mosaic">{cells}</div>'


def signage_gallery(up, cats=CATS, only=None):
    rows = [g for g in SIGNAGE_GALLERY if not only or g[0] in only]
    chips = "".join(f'<button class="chip{" on" if k == "all" else ""}" data-f="{k}">{html.escape(v)}</button>' for k, v in cats)
    figs = ""
    for f, c, t, cat in rows:
        w, h = _size(up, f)
        figs += (f'<figure class="g-item" data-c="{cat}"><button type="button" class="g-open" aria-label="Open {html.escape(c)} photo">'
                 f'<img src="{up}img/signage/{f}.jpg" alt="{html.escape(c)}: {html.escape(t)}" width="{w}" height="{h}" loading="lazy"></button>'
                 f'<figcaption><b>{html.escape(c)}</b><span>{html.escape(t)}</span></figcaption></figure>')
    return f"""<section class="p-sec" id="gallery">
    <div class="idx-head"><h2 style="margin-bottom:0">The <em>work.</em></h2><div class="chips" role="group" aria-label="Filter photos">{chips}</div></div>
    <div class="gallery">{figs}</div>
  </section>
  <dialog class="lb" id="lb"><button class="lb-x" type="button" aria-label="Close">×</button><img alt=""><p></p></dialog>
  <script>
  (()=>{{const g=document.querySelector('.gallery'),lb=document.getElementById('lb');
  document.querySelectorAll('#gallery .chip').forEach(b=>b.addEventListener('click',()=>{{document.querySelectorAll('#gallery .chip').forEach(x=>x.classList.toggle('on',x===b));
  g.querySelectorAll('.g-item').forEach(it=>it.hidden=!(b.dataset.f==='all'||it.dataset.c===b.dataset.f));}}));
  g.addEventListener('click',e=>{{const o=e.target.closest('.g-open');if(!o)return;const im=o.querySelector('img');
  lb.querySelector('img').src=im.src;lb.querySelector('img').alt=im.alt;lb.querySelector('p').textContent=im.alt;lb.showModal();}});
  lb.addEventListener('click',e=>{{if(e.target===lb||e.target.classList.contains('lb-x'))lb.close();}});}})();
  </script>"""


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


def ksa_signage_proof(up):
    rows = [
        ("Sanofi", "Office branding · Jeddah, Riyadh & Dubai"),
        ("MSD", "Dubai office branding"),
        ("Jeddah Defense Show", "Production & AV · Hilton Jeddah"),
        ("AXA", "Cairo head office · design to installation"),
        ("Bosch", "Signage & internal branding"),
        ("Arab Bank", "Signage & internal branding"),
        ("Nestlé", "Signage & internal branding"),
        ("Marriott Hotels", "Hotel signage"),
    ]
    cells = "".join(f"<div><b>{html.escape(n)}</b><span>{html.escape(d)}</span></div>" for n, d in rows)
    return f"""<section class="p-sec">
    <h2>Trusted in <em>the Kingdom</em> and beyond.</h2>
    <div class="names">{cells}</div>
  </section>"""


PAGES = [
    {
        "slug": "website-development-company-egypt",
        "title": "Website Development Company in Egypt | Doers Advertising Agency",
        "desc": "Websites, web apps, mobile apps, e-commerce and AI agents built by Doers in Cairo. 80+ projects across Egypt and the GCC, with local payment gateways and Arabic-first builds.",
        "service": "Website development",
        "areas": ["Egypt", "Saudi Arabia", "United Arab Emirates", "Kuwait", "Jordan", "Qatar"],
        "crumb": "Website Development",
        "eyebrow": "Website development company in Egypt",
        "h1": "We engineer <em>outcomes.</em>",
        "lead": "Websites, web apps, mobile apps, online stores and AI agents for ambitious organizations across the MENA region. Arabic-first, production-grade, and owned by us after launch.",
        "cta": "Plan my project",
        "feat_h": "Why clients <em>come back.</em>",
        "feats": [
            ("Strategy first", "A goal before a mockup", "Every project starts with a business goal, a target audience and a KPI, not a Figma file."),
            ("Bilingual by default", "Arabic-first", "Fully localized for Egypt, Saudi Arabia and the Gulf, and ready in English."),
            ("Engineering depth", "Code we can defend", "Clean, documented, scalable code that passes review, not throwaway prototypes."),
            ("Security & compliance", "Built to be trusted", "PCI-aware payments, SSL, privacy controls and government-grade access control."),
            ("Design that sells", "Clarity over decoration", "Interfaces tuned for clarity and conversion, tested with real users."),
            ("Ownership mindset", "We stay after launch", "Maintenance, optimization and growth as a long-term partner, not project-and-leave."),
        ],
        "proof": web_proof,
        "steps": [
            ("Discovery", "Business goal, audience, KPIs and the scope that really matters."),
            ("UX & architecture", "Research, sitemap, wireframes and the technical plan."),
            ("Design system", "High-fidelity UI, components and a clickable prototype for sign-off."),
            ("Engineering", "Build, integrations and payments, in reviewed, documented code."),
            ("Launch", "Security, speed, SEO and analytics checks, then go-live and training."),
            ("Grow", "Monitoring, monthly reports, updates and new features under an SLA."),
        ],
        "why_h": "Websites from an <em>advertising agency.</em>",
        "why": [
            "Most websites are built by one company and marketed by another. At Doers the same group plans the brand, runs the campaigns and engineers the platform, so the message, the design and the tracking line up.",
            "We have 15+ years of marketing experience, we're a Google Partner and a HubSpot Partner, and our web team has shipped 80+ projects for government, real estate, healthcare, education, retail and hospitality clients.",
        ],
        "tags": ["React", "Next.js", "Laravel", "Node.js", "Flutter", "Shopify", "WordPress", "AWS", "Cloudflare", "mada", "Apple Pay", "Tabby", "Tamara"],
        "faq": [
            ("What do you build?", "Websites, web applications, mobile apps for iOS and Android, e-commerce stores, content management systems and AI chat agents, plus the UI/UX design, SEO, payment integration and maintenance around them."),
            ("Which payment gateways can you integrate?", "Saudi and GCC gateways such as HyperPay, PayTabs, Tap, MyFatoorah and Moyasar; global gateways such as Stripe, PayPal, Adyen and Checkout.com; wallets including Apple Pay, mada, STC Pay and KNET; and Buy Now Pay Later with Tabby and Tamara."),
            ("Do you build in Arabic and English?", "Yes. We build Arabic-first with proper right-to-left layouts and Arabic editorial tools, and every site is ready in English."),
            ("What do I receive at handover?", "The live platform, full source code, admin documentation, a training session for your team and 30 days of post-launch support. Ongoing maintenance with SLA response times is available after that."),
            ("Can you redesign my current website without losing Google rankings?", "Yes. We keep your existing URLs where possible, map redirects for any that change, and check titles, descriptions and structured data against the old site before launch."),
            ("Do you build AI agents?", "Yes. We build chat and support agents connected to your website, knowledge base and CRM, answering customers in Arabic and English."),
        ],
        "cta_h": "Let's build<br>it right.",
        "cta_p": "Tell us what you need to launch. We'll reply within one business day with next steps.",
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
            ("Outdoor", "Building & shop signage", "3D letters, illuminated lightboxes, pylons and facade signs built for the sun and dust.", "arab-bank-day"),
            ("Indoor", "Office branding", "Reception walls, wall graphics, frosted-glass film and meeting room branding.", "axa-world-map"),
            ("Wayfinding", "Directional systems", "Floor directories, room signs and directional signs for offices, hospitals and malls.", "marriott-pylon"),
            ("Retail & malls", "Mall signage", "Storefronts, mall directories and in-store branding that follows landlord guidelines.", "trivium-facade"),
            ("Hospitality", "Hotel signage", "Signage packages for hotels and resorts, from arrival to room numbering.", "serenity-alpha-beach"),
            ("Rollouts", "Multi-site programs", "One standard applied across branches in Egypt, Saudi Arabia and the UAE.", "gourmet-3d"),
        ],
        "proof": signage_gallery,
        "mosaic": signage_mosaic,
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
    {
        "slug": "ksa/signage-internal-branding-in-jeddah",
        "title": "Signage & Internal Branding Company in Jeddah | Doers Advertising Agency",
        "desc": "Indoor and outdoor signage, wayfinding and office branding in Jeddah and Riyadh, designed, fabricated and installed by Doers. Office branding delivered for Sanofi in Jeddah, Riyadh and Dubai.",
        "service": "Signage and internal branding",
        "areas": ["Saudi Arabia", "Jeddah", "Riyadh", "United Arab Emirates"],
        "crumb": "Signage & Internal Branding, Jeddah",
        "eyebrow": "Signage & internal branding company in Jeddah",
        "h1": "Your brand, <em>on every wall.</em>",
        "lead": "From our Jeddah office we design, fabricate and install shop signs, building signage and office branding across Saudi Arabia, and roll the same standard out to your branches in the Gulf.",
        "cta": "Request a site survey",
        "feat_h": "What we <em>make.</em>",
        "feats": [
            ("Outdoor", "Shop & building signs", "Illuminated 3D letters, lightboxes, pylons and facade signs built for Saudi heat and sun.", "arab-bank-night"),
            ("Indoor", "Office branding", "Reception walls, wall graphics, frosted-glass film and meeting room branding.", "sanofi-office"),
            ("Wayfinding", "Directional systems", "Floor directories, room signs and directional signs for offices, clinics and malls.", "marriott-pylon"),
            ("Retail & malls", "Mall signage", "Storefronts and in-store branding that follow mall and landlord guidelines.", "sway-mall"),
            ("Hospitality", "Hotel & resort signage", "Entrance signs, venue names and wayfinding for hotels and resorts.", "serenity-alma-heights"),
            ("Rollouts", "Multi-branch programs", "One standard applied across branches in Saudi Arabia, the UAE and Egypt.", "gourmet-3d"),
        ],
        "proof": lambda up: ksa_signage_proof(up) + signage_gallery(up),
        "mosaic": lambda up: signage_mosaic(up, ("sanofi-office", "arab-bank-night", "msd-dubai", "serenity-alpha-beach")),
        "steps": [
            ("Site survey", "We visit your location in Jeddah or Riyadh, measure and photograph it."),
            ("Design", "Signage and branding designs with renders on your real walls and facade."),
            ("Approvals", "Drawings and specifications for your landlord, mall and municipality permits."),
            ("Fabrication", "Production with quality checks at each stage, before anything reaches site."),
            ("Installation", "Scheduled installation, after hours when needed so your business keeps running."),
            ("Aftercare", "Maintenance and replacements when your team, branches or brand change."),
        ],
        "why_h": "One team from <em>design to drill.</em>",
        "why": [
            "Signage usually passes between a designer, a print shop and an installer, and quality gets lost at every handover. Doers runs the whole job, so the sign that goes up matches the design you approved.",
            "We delivered office branding for Sanofi in Jeddah, Riyadh and Dubai, and production for the Jeddah Defense Show at Hilton Jeddah. In Egypt our signage clients include AXA, Bosch, Arab Bank, Nestlé and Marriott.",
        ],
        "tags": ["3D letters", "Lightboxes", "Pylons", "Acrylic & metal", "Wall graphics", "Frosted film", "Wayfinding", "Installation"],
        "faq": [
            ("Do you install signage in Jeddah and Riyadh?", "Yes. We survey, fabricate and install across Saudi Arabia from our Jeddah office, including office branding we delivered for Sanofi in Jeddah and Riyadh."),
            ("Do you help with municipality sign permits?", "Yes. We prepare the drawings and specifications that landlords, malls and the municipality ask for, and follow the approval through with you."),
            ("How long does an office branding project take?", "Most office branding projects take 2 to 4 weeks after design approval, depending on materials and the size of the space."),
            ("Can you roll out the same signage to branches in other countries?", "Yes. We apply one standard across branches in Saudi Arabia, the UAE and Egypt."),
            ("Can you install without disrupting our work?", "Yes. We schedule installation around your working hours, including evenings and weekends when needed."),
        ],
        "cta_h": "Let's put your<br>name up.",
        "cta_p": "Send us your location in Saudi Arabia and what you need. We'll book a site survey and reply within one business day.",
    },
]

if __name__ == "__main__":
    for p in PAGES:
        out = ROOT / p["slug"] / "index.html"
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(page(p), encoding="utf-8")
        print("wrote", out.relative_to(ROOT.parent))
