"""Builds src/data/services/webdev.json from the original custom web development page (service-pages*.json) plus city copy."""
import json, re, html
U = html.unescape
def parse(p):
    h = p['proof_html']
    return dict(
        disc=[(U(a), U(b), U(c)) for a, b, c in re.findall(r'<h3>(.*?)</h3><p>(.*?)</p><p class="stk">(.*?)</p>', h)],
        stack=[(U(a), U(b)) for a, b in re.findall(r'<span class="label">(.*?)</span><p>(.*?)</p>', h)],
        inc=[U(x) for x in re.findall(r'<li>(.*?)</li>', h)],
        links=[(U(n), u, U(s).replace(' ↗', '')) for u, n, s in re.findall(r'<a[^>]*href="([^"]+)"[^>]*>\s*<b>(.*?)</b>\s*<span>(.*?)</span>', h)],
        stats=[(U(a), U(b)) for a, b in re.findall(r'<div><b>(.*?)</b><span>(.*?)</span></div>', h)])
en_p = json.load(open('src/data/service-pages.json'))[0]; ar_p = json.load(open('src/data/service-pages.ar.json'))[0]
E_, A_ = parse(en_p), parse(ar_p)
def base(P, X, ar):
    sites = [l for l in X['links'] if 'play.google' not in l[1]]
    apps = [l for l in X['links'] if 'play.google' in l[1]]
    return {
        "crumb": "تطوير المواقع" if ar else "Website Development",
        "stats": [list(s) for s in X['stats'][:4]],
        "servicesH": "عشرة تخصصات. <em>وفريق واحد مسؤول.</em>" if ar else "Ten disciplines. <em>One accountable team.</em>",
        "servicesP": "من أول فكرة لحد الصيانة بعد الإطلاق، كل حاجة عند فريق واحد." if ar else "From the first idea to maintenance after launch, all under one team.",
        "services": [{"t": t, "d": d, "tags": [x.strip() for x in s.split('·')]} for t, d, s in X['disc']],
        "processH": "إزاي <em>بنشتغل.</em>" if ar else "How we <em>build.</em>",
        "processP": "ست مراحل، بمراجعة وموافقة في آخر كل مرحلة." if ar else "Six stages, each ending with a review and your sign-off.",
        "process": [list(s) for s in P['steps']],
        "introH": P['why_h'], "intro": P['why'],
        "cases": case(ar),
        "casesH": "زيارات <em>تتحول لعملاء.</em>" if ar else "Traffic that <em>converts.</em>",
        "casesP": ("فريق المواقع قاعد جنب فريق الأداء والـSEO، فكل موقع بيتخطط حوالين الحملات اللي هتبعتله الزوار." if ar else
                   "Our web team sits next to our performance and SEO teams, so every site is planned around the campaigns that will send people to it."),
        "lists": [
            {"h": "<em>التقنيات.</em>" if ar else "The <em>stack.</em>", "rows": [list(s) for s in X['stack']]},
            {"h": "موجود في <em>كل مشروع.</em>" if ar else "Included in <em>every build.</em>", "rows": X['inc']}],
        "sites": {"h": "مواقع <em>تعمل الآن.</em>" if ar else "Live <em>work.</em>",
                  "p": "افتحها وجرّبها بنفسك." if ar else "Open them and try them yourself.",
                  "groups": [{"t": "مواقع" if ar else "Websites", "items": [list(x) for x in sites]},
                             {"t": "تطبيقات على Google Play" if ar else "Apps on Google Play", "items": [[n, u, "Google Play"] for n, u, _ in apps]}]},
        "chipsH": "أدوات <em>نثق فيها.</em>" if ar else "Tools we <em>trust.</em>",
        "chips": P['tags'],
    }
def case(ar):
    return [
        {"tag": "أغذية · حملة أداء" if ar else "Food & beverage · Performance campaign", "client": "Safi",
         "text": ("حملة وصلت لأكثر من 6 مليون مستخدم بميزانية 20 ألف دولار، وودّت 500 ألف نقرة للموقع." if ar else
                  "A campaign that reached more than 6 million unique users on a $20K budget and sent 500K clicks to the site."),
         "img": "/img/digital/safi-reel.jpg", "metrics": [["6M+", "مستخدم" if ar else "Users reached"], ["500K", "نقرة" if ar else "Clicks"], ["$20K", "الميزانية" if ar else "Budget"]]},
        {"tag": "عقارات · توليد عملاء" if ar else "Real estate · Lead generation", "client": "عقارات" if ar else "Real estate developer",
         "text": ("صفحات هبوط سريعة مربوطة بحملات مدفوعة ونماذج تتبع، بتكلفة 7.5 دولار للعميل المحتمل." if ar else
                  "Fast landing pages wired to paid campaigns and tracked forms, at $7.5 per lead."),
         "img": "/img/digital/real-estate-post.jpg", "metrics": [["$7.5", "تكلفة العميل" if ar else "Cost per lead"], ["$1.51", "تكلفة النقرة" if ar else "Effective CPC"]]}]
eg_en = {"eyebrow": "Websites, apps and AI agents · Cairo", "slogan": en_p['h1'], "lead": en_p['lead'],
         "heroPanel": {"t": "doers · build checklist", "rows": [["Arabic & English", "RTL ✓"], ["Core Web Vitals", "Green ✓"], ["Payments", "Local & global gateways"], ["SEO foundations", "Schema · Sitemap ✓"], ["Security", "SSL · Backups ✓"], ["Handover", "Source + training"]], "foot": "Every launch passes this list before it goes live."}}
eg_ar = {"eyebrow": "مواقع وتطبيقات ووكلاء ذكاء اصطناعي · القاهرة", "slogan": ar_p['h1'], "lead": ar_p['lead'],
         "heroPanel": {"t": "doers · قائمة الإطلاق", "rows": [["عربي وإنجليزي", "RTL ✓"], ["Core Web Vitals", "✓ أخضر"], ["الدفع", "بوابات محلية وعالمية"], ["أساسيات SEO", "Schema · Sitemap ✓"], ["الأمان", "SSL · نسخ احتياطية ✓"], ["التسليم", "الكود + التدريب"]], "foot": "كل موقع بيعدّي على القائمة دي قبل ما يتنشر."}}
ksa_en = {"eyebrow": "Website development company in Jeddah", "slogan": "Built for <em>the Kingdom.</em>",
          "lead": "From our Jeddah office we design and build Arabic-first websites, online stores, web apps and mobile apps for Saudi businesses, with mada, Apple Pay, STC Pay, Tabby and Tamara built in.",
          "introH": "Saudi customers <em>expect more.</em>",
          "intro": ["Saudi Arabia is one of the most mobile, most online markets in the world. Customers compare you with the best apps they use every day, pay with mada and Apple Pay, and expect Arabic that reads naturally, not a translation.",
                    "We build for that: Arabic-first interfaces, local payment gateways such as HyperPay, Moyasar, PayTabs and Tap, fast hosting close to the Gulf, and the tracking your marketing team needs from day one. The same group runs your campaigns, so launch day comes with traffic."],
          "heroPanel": {"t": "doers · KSA build checklist", "rows": [["Arabic-first UX", "RTL ✓"], ["mada · Apple Pay · STC Pay", "✓"], ["Tabby · Tamara", "BNPL ✓"], ["Gateways", "HyperPay · Moyasar · Tap"], ["Core Web Vitals", "Green ✓"], ["Support", "SLA from Jeddah"]], "foot": "Payment, language and speed checks for the Saudi market."},
          "chipsH": "Payments and tools <em>we integrate.</em>", "chips": ["mada", "Apple Pay", "STC Pay", "Tabby", "Tamara", "HyperPay", "Moyasar", "PayTabs", "Tap", "Shopify", "WordPress", "Next.js", "Laravel", "Flutter"]}
ksa_ar = {"eyebrow": "شركة تطوير مواقع في جدة", "slogan": "مبني <em>للسوق السعودي.</em>",
          "lead": "من مكتبنا في جدة نصمم ونبني مواقع ومتاجر وتطبيقات ويب وموبايل للشركات السعودية بالعربي أولاً، مع مدى وApple Pay وSTC Pay وتابي وتمارا.",
          "introH": "العميل السعودي <em>يتوقع أكثر.</em>",
          "intro": ["السعودية من أكثر الأسواق استخداماً للموبايل والإنترنت في العالم. عميلك يقارنك بأفضل التطبيقات اللي يستخدمها كل يوم، ويدفع بمدى وApple Pay، ويتوقع عربي طبيعي مو ترجمة.",
                    "نبني لهذا: واجهات عربية أولاً، وبوابات دفع محلية مثل HyperPay وMoyasar وPayTabs وTap، واستضافة سريعة قريبة من الخليج، وتتبع جاهز لفريق التسويق من أول يوم. ونفس المجموعة تدير حملاتك، فيجي يوم الإطلاق ومعه زوار."],
          "heroPanel": {"t": "doers · قائمة السوق السعودي", "rows": [["تجربة عربية أولاً", "RTL ✓"], ["مدى · Apple Pay · STC Pay", "✓"], ["تابي · تمارا", "تقسيط ✓"], ["بوابات الدفع", "HyperPay · Moyasar · Tap"], ["Core Web Vitals", "✓ أخضر"], ["الدعم", "اتفاقية خدمة من جدة"]], "foot": "فحص الدفع واللغة والسرعة للسوق السعودي."},
          "chipsH": "مدفوعات وأدوات <em>نربطها.</em>", "chips": ["مدى", "Apple Pay", "STC Pay", "تابي", "تمارا", "HyperPay", "Moyasar", "PayTabs", "Tap", "Shopify", "WordPress", "Next.js", "Laravel", "Flutter"]}
d = {"id": "webdev", "paths": {"eg": "/website-development-company-egypt/", "ksa": "/ksa/website-development-company-in-jeddah/"},
     "en": {"base": base(en_p, E_, False), "eg": eg_en, "ksa": ksa_en}, "ar": {"base": base(ar_p, A_, True), "eg": eg_ar, "ksa": ksa_ar}}
json.dump(d, open('src/data/services/webdev.json', 'w'), ensure_ascii=False, indent=1)
print('ok', len(d['en']['base']['services']), len(d['ar']['base']['sites']['groups'][0]['items']))
