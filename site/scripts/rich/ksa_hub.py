"""Builds src/data/services/ksa-hub.json: the Saudi agency pages (/ksa/ = Riyadh, /ksa/advertising-agency-in-jeddah/ = Jeddah)."""
import json
menu = json.load(open('src/data/services-menu.json'))
DESC = {
 "Branding": ("Strategy, naming, identity and guidelines for Saudi brands.", "استراتيجية وأسماء وهويات وأدلة للعلامات السعودية."),
 "Event Management": ("Conferences, launches and gala nights, produced end to end.", "مؤتمرات وإطلاقات وحفلات، من الفكرة للتنفيذ."),
 "Booth Production": ("Exhibition stands designed and built for Saudi shows.", "أجنحة معارض مصممة ومنفذة لمعارض السعودية."),
 "Signage & Internal Branding": ("Shop signs, facades and office branding, installed across the Kingdom.", "لافتات محلات وواجهات وهوية مكاتب، مركّبة في كل المملكة."),
 "Digital Marketing": ("Social media, paid campaigns and content in Saudi Arabic.", "سوشيال ميديا وحملات مدفوعة ومحتوى باللهجة السعودية."),
 "SEO": ("Rank on Google in Arabic and English, city by city.", "تصدّر في جوجل بالعربي والإنجليزي، مدينة مدينة."),
 "Web Development": ("Websites, stores and apps with mada, Apple Pay and Tabby.", "مواقع ومتاجر وتطبيقات مع مدى وApple Pay وتابي."),
 "Media Production": ("TV commercials, films, motion graphics and reels.", "إعلانات تلفزيون وأفلام وموشن جرافيك وريلز."),
 "Outdoor (OOH)": ("Billboards, unipoles and digital screens on Saudi roads.", "لوحات ويونيبول وشاشات رقمية على طرق المملكة."),
 "TV Advertising": ("Channel planning and airtime buying on Saudi and pan-Arab networks.", "تخطيط القنوات وشراء المساحات على الشبكات السعودية والعربية."),
 "Radio Advertising": ("Drive-time radio plans, scripts and Saudi voice-over.", "خطط راديو في أوقات الذروة وسيناريو وأصوات سعودية."),
 "Reputation Management": ("Listening, sentiment, reviews and crisis alerts.", "رصد وتحليل انطباع وتقييمات وتنبيهات أزمات."),
}


def services(ar):
    out = []
    for m in menu:
        link = (m.get('ksa') or m.get('eg') or '').lstrip('*')
        d = DESC.get(m['name'])
        if link and d:
            out.append({"t": m['ar'] if ar else m['name'], "d": d[1] if ar else d[0], "href": link})
    return out


C = {
 'intra': ({"tag": "Defence · Booth production · Jeddah", "client": "INTRA", "text": "A stand for INTRA at the Defense Show in Jeddah, built around a large tilted circular screen.", "img": "/img/legacy/2026-08-inter-01-scaled.jpg"},
           {"tag": "دفاع · أجنحة المعارض · جدة", "client": "INTRA", "text": "جناح INTRA في معرض الدفاع بجدة، مبني حول شاشة دائرية كبيرة مائلة.", "img": "/img/legacy/2026-08-inter-01-scaled.jpg"}),
 'sanofi': ({"tag": "Healthcare · Office branding · Jeddah & Riyadh", "client": "Sanofi", "text": "Office branding for Sanofi in Jeddah, Riyadh and Dubai, one standard across three cities.", "img": "/img/signage/sanofi-office.jpg"},
            {"tag": "رعاية صحية · هوية المكاتب · جدة والرياض", "client": "سانوفي", "text": "هوية مكاتب سانوفي في جدة والرياض ودبي، بمعيار واحد في ثلاث مدن.", "img": "/img/signage/sanofi-office.jpg"}),
 'argan': ({"tag": "FMCG · Brand launch", "client": "Argan", "text": "Launch creative for Argan's hair colour range in Saudi Arabia, with Arabic product visuals made for social and retail.", "img": "/img/digital/argan-launch-sa.jpg"},
           {"tag": "سلع استهلاكية · إطلاق علامة", "client": "Argan", "text": "تصميمات إطلاق مجموعة صبغات Argan في السعودية، بصور منتجات عربية للسوشيال ومنافذ البيع.", "img": "/img/digital/argan-launch-sa.jpg"}),
 'maarif': ({"tag": "Education · Booth production", "client": "Maarif", "text": "A clean, technology-driven stand with digital screens and open meeting space.", "img": "/img/legacy/2026-08-maa-01-scaled.jpg"},
            {"tag": "تعليم · أجنحة المعارض", "client": "معارف", "text": "جناح بتصميم تقني نظيف بشاشات رقمية ومساحة اجتماعات مفتوحة.", "img": "/img/legacy/2026-08-maa-01-scaled.jpg"}),
 'qudra': ({"tag": "Energy · Booth production", "client": "Arabian Qudra", "text": "An energy-inspired stand combining bold structure with the brand's colours.", "img": "/img/legacy/2026-08-picture12-018-01-scaled.jpg"},
           {"tag": "طاقة · أجنحة المعارض", "client": "القدرة العربية", "text": "جناح مستوحى من الطاقة يجمع بين هيكل جريء وألوان العلامة.", "img": "/img/legacy/2026-08-picture12-018-01-scaled.jpg"}),
}


def base(ar):
    return {
        "crumb": "السعودية" if ar else "Saudi Arabia",
        "stats": [["+15", "سنة خبرة في التسويق"], ["2", "مكاتب: جدة والقاهرة"], ["12", "خدمة تحت سقف واحد"], ["360°", "من الاستراتيجية للتنفيذ"]] if ar else
                 [["15+", "Years of marketing experience"], ["2", "Offices: Jeddah and Cairo"], ["12", "Services under one roof"], ["360°", "From strategy to execution"]],
        "servicesH": "كل اللي علامتك <em>تحتاجه.</em>" if ar else "Everything your brand <em>needs.</em>",
        "servicesP": "اضغط على أي خدمة لتفاصيلها في السعودية." if ar else "Open any service for the details in Saudi Arabia.",
        "services": services(ar),
        "processH": "كيف <em>نشتغل.</em>" if ar else "How we <em>work.</em>",
        "processP": "فريق واحد من أول اجتماع لآخر تقرير." if ar else "One team from the first meeting to the last report.",
        "process": [["نسمع", "أهدافك وجمهورك وسوقك ومنافسينك."], ["نخطط", "استراتيجية واحدة تربط العلامة والإعلام والمحتوى."], ["نبدع", "أفكار وتصميمات ومحتوى بالعربي والإنجليزي."], ["ننفذ", "حملات وفعاليات وأجنحة ومواقع، بفريقنا."], ["نقيس", "لوحات وتقارير ونتائج مربوطة بأهدافك."]] if ar else
                   [["Listen", "Your goals, audience, market and competitors."], ["Plan", "One strategy linking brand, media and content."], ["Create", "Ideas, design and content in Arabic and English."], ["Deliver", "Campaigns, events, stands and websites, by our own team."], ["Measure", "Dashboards, reports and results tied to your goals."]],
        "casesH": "شغل <em>في المملكة.</em>" if ar else "Work <em>in the Kingdom.</em>",
    }


en = {
 "ksa": {"eyebrow": "Advertising & marketing agency in Jeddah", "slogan": "One agency for <em>the whole brand.</em>",
         "lead": "From our office in Jeddah we plan, create and deliver branding, digital marketing, events, exhibition stands, signage, outdoor, TV and radio for businesses across Saudi Arabia.",
         "heroReels": ["1065803522", "1075555689", "1075554730"],
         "introH": "Jeddah moves <em>fast.</em>", "intro": ["Jeddah is the Kingdom's gateway: its port, its retail capital and a city of events, from the Corniche to the Red Sea. Brands here compete for attention online, on the road and at the show, all at once.", "Doers brings all of that under one roof. Our Jeddah team works with our Cairo studio, so you get strategy, creative, media and production from one accountable partner, in Saudi Arabic and English."],
         "cases": [C[k][0] for k in ['intra', 'argan', 'sanofi', 'qudra']]},
 "riyadh": {"eyebrow": "Advertising & marketing agency in Riyadh, Saudi Arabia", "slogan": "Built for <em>Vision 2030 ambitions.</em>",
            "lead": "Doers is a full-service advertising agency serving Riyadh and the whole Kingdom: branding, digital marketing, events and exhibitions, media production, outdoor, TV and radio, from our office in Jeddah.",
            "heroImg": {"src": "/img/legacy/2026-08-inter-01-scaled.jpg", "alt": "INTRA stand at the Defense Show, designed and built by Doers", "cap": "INTRA at the Defense Show, designed and built by Doers."},
            "introH": "Riyadh is where <em>decisions happen.</em>", "intro": ["Riyadh is home to the Kingdom's ministries, giga-projects and head offices, and to its biggest conferences and exhibitions. Winning here means looking world class, speaking the local language and delivering on time.", "We combine 15+ years of marketing experience with a team that plans, designs and produces in-house, so a campaign, a launch event and an exhibition stand all tell the same story."],
            "cases": [C[k][0] for k in ['sanofi', 'intra', 'maarif', 'argan']]}}
ar = {
 "ksa": {"eyebrow": "وكالة إعلان وتسويق في جدة", "slogan": "وكالة واحدة <em>للعلامة كلها.</em>",
         "lead": "من مكتبنا في جدة نخطط ونصمم وننفذ الهوية والتسويق الرقمي والفعاليات وأجنحة المعارض واللافتات والطرق والتلفزيون والراديو للشركات في كل السعودية.",
         "heroReels": ["1065803522", "1075555689", "1075554730"],
         "introH": "جدة <em>سريعة.</em>", "intro": ["جدة بوابة المملكة: ميناؤها، وعاصمة التجزئة، ومدينة الفعاليات من الكورنيش للبحر الأحمر. العلامات هنا تتنافس على الانتباه أونلاين وعلى الطريق وفي المعارض، كلها في نفس الوقت.", "دورز تجمع كل هذا تحت سقف واحد. فريقنا في جدة يشتغل مع استوديو القاهرة، فتحصل على الاستراتيجية والإبداع والإعلام والإنتاج من شريك واحد مسؤول، باللهجة السعودية والإنجليزي."],
         "cases": [C[k][1] for k in ['intra', 'argan', 'sanofi', 'qudra']]},
 "riyadh": {"eyebrow": "وكالة إعلان وتسويق في الرياض، السعودية", "slogan": "مبنية <em>لطموحات رؤية 2030.</em>",
            "lead": "دورز وكالة إعلان متكاملة تخدم الرياض وكل المملكة: الهوية والتسويق الرقمي والفعاليات والمعارض والإنتاج الإعلامي والطرق والتلفزيون والراديو، من مكتبنا في جدة.",
            "heroImg": {"src": "/img/legacy/2026-08-inter-01-scaled.jpg", "alt": "جناح INTRA في معرض الدفاع، من تصميم وتنفيذ دورز", "cap": "INTRA في معرض الدفاع، من تصميم وتنفيذ دورز."},
            "introH": "الرياض <em>مكان القرار.</em>", "intro": ["الرياض فيها الوزارات والمشاريع الكبرى والمقرات الرئيسية، وأكبر المؤتمرات والمعارض. النجاح هنا يعني إنك تظهر بمستوى عالمي، وتتكلم لغة السوق، وتسلّم في الوقت.", "نجمع أكثر من 15 سنة خبرة في التسويق مع فريق يخطط ويصمم وينتج داخلياً، فالحملة والإطلاق والجناح يحكوا نفس القصة."],
            "cases": [C[k][1] for k in ['sanofi', 'intra', 'maarif', 'argan']]}}
# The Riyadh page's reputation row points to the Riyadh reputation page.
def riyadh(ar):
    out = services(ar)
    for x in out:
        if x['href'] == '/ksa/listening-and-reputation-management-in-jeddah/':
            x['href'] = '/ksa/listening-and-reputation-management/'
    return out
en['riyadh']['services'] = riyadh(False); ar['riyadh']['services'] = riyadh(True)
d = {"id": "ksa-hub", "paths": {"eg": "/", "ksa": "/ksa/advertising-agency-in-jeddah/", "riyadh": "/ksa/"},
     "en": {"base": base(False), **en}, "ar": {"base": base(True), **ar}}
json.dump(d, open('src/data/services/ksa-hub.json', 'w'), ensure_ascii=False, indent=1)
print('ok', len(services(False)))
