"""Builds src/data/services/booth.json. Galleries come from the booth pages' portfolio (legacy-pages.json)."""
import json
lg = {l['path']: l for l in json.load(open('src/data/legacy-pages.json'))}
def gal(path, skip=()):
    items = next(s for s in lg[path]['sections'] if s.get('kind') == 'gallery')['items']
    return [{"src": i['src'], "alt": i['client']} for i in items if i['client'] not in skip]
L = lambda n: f"/img/legacy/2026-08-{n}-scaled.jpg"
def base(ar):
    if ar:
        return {"crumb": "تصميم وتنفيذ الأجنحة", "band": "booth-build",
                "stats": [["+15", "سنة خبرة"], ["+100", "جناح نفذناه"], ["+8", "معارض كبرى"], ["24/7", "دعم في الموقع أثناء المعرض"]],
                "servicesH": "جناح كامل، <em>فريق واحد.</em>", "servicesP": "من أول رسمة ثلاثية الأبعاد لحد ما نفك آخر لوح بعد المعرض.",
                "services": [
                    {"t": "التصميم ثلاثي الأبعاد", "d": "أفكار أجنحة ثلاثية الأبعاد مبنية على علامتك ومساحتك وأهدافك في المعرض، مع صور واقعية قبل التنفيذ.", "tags": ["أفكار", "صور واقعية", "مخططات"]},
                    {"t": "الأجنحة المخصصة", "d": "أجنحة مصممة ومصنّعة خصيصاً لعلامتك، من الأقواس والأسقف المعلقة لحد غرف الاجتماعات.", "tags": ["خشب", "معدن", "أكريليك"]},
                    {"t": "الأجنحة المعيارية", "d": "أنظمة معيارية قابلة لإعادة الاستخدام للشركات اللي بتشارك في أكثر من معرض في السنة.", "tags": ["إعادة استخدام", "تركيب سريع"]},
                    {"t": "الشاشات والإضاءة والصوت", "d": "شاشات LED وجدران عرض وإضاءة وصوت متكاملة مع التصميم من البداية.", "tags": ["شاشات LED", "إضاءة", "صوت"]},
                    {"t": "الجرافيك والطباعة", "d": "كل الجرافيك مطبوع على الخامة الصح ومطابق لألوان علامتك.", "tags": ["طباعة", "ستيكرز", "حروف بارزة"]},
                    {"t": "الأثاث والتجهيزات", "d": "أثاث ومناطق عرض واستقبال وتخزين مصممة لحركة الزوار.", "tags": ["أثاث", "كاونترات", "تخزين"]},
                    {"t": "موافقات المنظم", "d": "مخططات إنشائية وكهربائية ومواصفات جاهزة لموافقة إدارة المعرض.", "tags": ["مخططات", "سلامة"]},
                    {"t": "التركيب والفك", "d": "تركيب في الوقت المحدد، ودعم أثناء أيام المعرض، وفك ونقل بعد الختام.", "tags": ["التركيب", "الدعم", "الفك"]}],
                "processH": "من الفكرة <em>ليوم الافتتاح.</em>", "processP": "ست مراحل، بجدول زمني واضح من أول يوم.",
                "process": [["الاستلام", "المعرض والمساحة والأهداف والميزانية والمواعيد."], ["الفكرة ثلاثية الأبعاد", "تصميم وصور واقعية وتعديلات لحد الاعتماد."], ["موافقة المنظم", "المخططات الفنية والكهرباء والسلامة لإدارة المعرض."], ["التصنيع", "التصنيع في ورشنا مع مراجعة الجودة قبل النقل."], ["التركيب", "التركيب في الموقع والتسليم قبل الافتتاح."], ["الفك", "الدعم أثناء المعرض، ثم الفك والنقل والتخزين."]],
                "casesH": "أجنحة <em>بنيناها.</em>", "galleryH": "من <em>قاعات المعارض.</em>",
                "chipsH": "معارض <em>شاركنا فيها.</em>"}
    return {"crumb": "Booth Production", "band": "booth-build",
            "stats": [["15+", "Years of experience"], ["100+", "Exhibition stands built"], ["8+", "Major exhibitions"], ["24/7", "On-site support during the show"]],
            "servicesH": "The whole stand, <em>one team.</em>", "servicesP": "From the first 3D sketch to the last panel taken down after the show.",
            "services": [
                {"t": "3D design", "d": "Stand concepts built around your brand, your space and your goals at the show, with photoreal renders before anything is built.", "tags": ["Concepts", "Renders", "Floor plans"]},
                {"t": "Custom stands", "d": "Stands designed and fabricated for your brand, from arches and hanging rigs to meeting rooms.", "tags": ["Wood", "Metal", "Acrylic"]},
                {"t": "Modular stands", "d": "Reusable modular systems for brands that exhibit at several shows a year.", "tags": ["Reusable", "Fast install"]},
                {"t": "LED, lighting & AV", "d": "LED screens, video walls, lighting and sound, designed into the stand from the start.", "tags": ["LED screens", "Lighting", "Sound"]},
                {"t": "Graphics & print", "d": "Every graphic printed on the right material and matched to your brand colours.", "tags": ["Print", "Vinyl", "3D letters"]},
                {"t": "Furniture & fit-out", "d": "Furniture, displays, reception and storage planned around how visitors move.", "tags": ["Furniture", "Counters", "Storage"]},
                {"t": "Organiser approvals", "d": "Structural and electrical drawings and specs ready for the organiser's approval.", "tags": ["Drawings", "Safety"]},
                {"t": "Installation & dismantling", "d": "On-time build-up, support through the show days, then dismantling, transport and storage.", "tags": ["Build-up", "Support", "Dismantling"]}],
            "processH": "From concept <em>to opening day.</em>", "processP": "Six stages, on a clear timeline from day one.",
            "process": [["Brief", "Show, stand size, goals, budget and deadlines."], ["3D concept", "Design, renders and revisions until sign-off."], ["Organiser approval", "Technical, electrical and safety drawings for the organiser."], ["Fabrication", "Built in our workshops, quality-checked before shipping."], ["Installation", "On-site build-up, handed over before the doors open."], ["Dismantling", "Support through the show, then dismantling, transport and storage."]],
            "casesH": "Stands <em>we built.</em>", "galleryH": "From <em>the show floor.</em>",
            "chipsH": "Shows <em>we've built at.</em>"}
CASES = {
 'technip': ({"tag": "Energy · EGYPES · Cairo", "client": "Technip Energies", "text": "A stand for Technip Energies at EGYPES, Egypt's energy show, with a suspended ring and screens for the leadership's presentations to visitors.", "img": "/img/work/technip-egypes-2.jpg", "alt": "Technip Energies stand at EGYPES during a presentation"},
             {"tag": "طاقة · إيجبس · القاهرة", "client": "Technip Energies", "text": "جناح Technip Energies في معرض إيجبس للطاقة، بحلقة معلقة وشاشات لعروض القيادات للزوار.", "img": "/img/work/technip-egypes-2.jpg", "alt": "جناح Technip Energies في إيجبس أثناء عرض"}),
 'isys': ({"tag": "Technology · AI Everything · Cairo", "client": "ISYS", "text": "A walk-through illuminated arch and demo zones for ISYS at AI Everything, the stand's entrance became the most photographed spot in the hall.", "img": "/img/work/isys-ai-everything-1.jpg", "alt": "The illuminated ISYS arch at AI Everything"},
          {"tag": "تكنولوجيا · AI Everything · القاهرة", "client": "ISYS", "text": "قوس مضيء يمشي الزوار من خلاله ومناطق عروض لشركة ISYS في AI Everything، وبقى مدخل الجناح أكثر مكان اتصور في القاعة.", "img": "/img/work/isys-ai-everything-1.jpg", "alt": "قوس ISYS المضيء في AI Everything"}),
 'dell': ({"tag": "Technology · Cairo ICT", "client": "Dell Technologies", "text": "A technology-focused stand for Dell at Cairo ICT, with product demo zones and a strong brand presence from every aisle.", "img": L("picture12-01l-01"), "alt": "Dell stand at Cairo ICT"},
          {"tag": "تكنولوجيا · Cairo ICT", "client": "Dell Technologies", "text": "جناح تقني لشركة Dell في Cairo ICT، بمناطق لعرض المنتجات وحضور قوي للعلامة من كل الممرات.", "img": L("picture12-01l-01"), "alt": "جناح Dell في Cairo ICT"}),
 'alkan': ({"tag": "Construction · Cairo", "client": "Alkan CIT", "text": "A futuristic stand with illuminated structures and digital screens for Alkan CIT.", "img": L("picture19-01"), "alt": "Alkan CIT stand"},
           {"tag": "مقاولات · القاهرة", "client": "Alkan CIT", "text": "جناح بمفهوم مستقبلي بهياكل مضيئة وشاشات رقمية لشركة Alkan CIT.", "img": L("picture19-01"), "alt": "جناح Alkan CIT"}),
 'intra': ({"tag": "Defence · KSA Defense Show · Jeddah", "client": "INTRA", "text": "A futuristic stand for INTRA at the Defense Show in Jeddah, built around a large tilted circular screen.", "img": L("inter-01"), "alt": "INTRA stand at the KSA Defense Show"},
           {"tag": "دفاع · معرض الدفاع · جدة", "client": "INTRA", "text": "جناح بمفهوم مستقبلي لشركة INTRA في معرض الدفاع بجدة، مبني حول شاشة دائرية كبيرة مائلة.", "img": L("inter-01"), "alt": "جناح INTRA في معرض الدفاع"}),
 'maarif': ({"tag": "Education · Saudi Arabia", "client": "Maarif", "text": "A clean, technology-driven stand for Maarif, with digital screens and open meeting space.", "img": L("maa-01"), "alt": "Maarif stand"},
            {"tag": "تعليم · السعودية", "client": "معارف", "text": "جناح بتصميم تقني نظيف لشركة معارف، بشاشات رقمية ومساحة اجتماعات مفتوحة.", "img": L("maa-01"), "alt": "جناح معارف"}),
 'qudra': ({"tag": "Energy · Saudi Arabia", "client": "Arabian Qudra", "text": "An energy-inspired stand for Arabian Qudra, combining bold structure with the brand's colours.", "img": L("picture12-018-01"), "alt": "Arabian Qudra stand"},
           {"tag": "طاقة · السعودية", "client": "القدرة العربية", "text": "جناح بمفهوم مستوحى من الطاقة لشركة القدرة العربية، يجمع بين هيكل جريء وألوان العلامة.", "img": L("picture12-018-01"), "alt": "جناح القدرة العربية"}),
}
c = lambda keys, i: [CASES[k][i] for k in keys]
eg_g = gal('/booth-production-egypt/', skip=('Asfour Crystal',))
ks_g = gal('/ksa/booth-production-in-jeddah/') + [g for g in eg_g if g['alt'] in ('ISYS · AI Everything', 'Technip Energies · EGYPES', 'Dell · Cairo ICT', 'Lenovo')]
d = {"id": "booth", "paths": {"eg": "/booth-production-egypt/", "ksa": "/ksa/booth-production-in-jeddah/"},
 "en": {"base": base(False),
   "eg": {"eyebrow": "Exhibition stand builder in Cairo, Egypt", "heroImg": {"src": "/img/work/technip-egypes-1.jpg", "alt": "Technip Energies stand at EGYPES, Cairo", "cap": "Technip Energies at EGYPES, designed and built by Doers."},
          "slogan": "Stands that <em>pull a crowd.</em>", "lead": "We design, build and install custom exhibition stands in Egypt: 3D concepts, fabrication in our own workshops, LED and lighting, installation and dismantling, all under one team.",
          "introH": "Three days to <em>make an impression.</em>", "intro": ["An exhibition is a few days in which your competitors stand a few metres away. A stand has to stop people in the aisle, give your team space to talk and make your brand look like the leader in its field.", "We have built stands at Cairo ICT, EGYPES, AI Everything, Plastex, EgyBeauty Africa and more. We design around how visitors move, fabricate in our own workshops and stay on site from build-up to dismantling."],
          "cases": c(['technip', 'isys', 'dell', 'alkan'], 0), "gallery": eg_g,
          "chips": ["Cairo ICT", "EGYPES", "AI Everything", "Plastex", "EgyBeauty Africa"], "chipsP": "Shows where our stands have stood."},
   "ksa": {"eyebrow": "Exhibition stand builder in Jeddah", "heroImg": {"src": L("inter-01"), "alt": "INTRA stand at the Defense Show in Jeddah", "cap": "INTRA at the Defense Show in Jeddah, designed and built by Doers."},
          "slogan": "Built for <em>Saudi shows.</em>", "lead": "From our Jeddah office we design, build and install exhibition stands across Saudi Arabia, from 3D concept and fabrication to LED, lighting, installation and dismantling.",
          "introH": "Saudi shows are <em>getting bigger.</em>", "intro": ["Exhibitions in Jeddah and Riyadh now draw international exhibitors and huge crowds. Your stand competes with global brands, so it has to be bold, well built and delivered exactly on time.", "We have built for INTRA, Maarif and Arabian Qudra in the Kingdom, and bring the experience of 100+ stands in Egypt. We handle organiser approvals, build-up and 24/7 support through the show."],
          "cases": c(['intra', 'maarif', 'qudra', 'isys'], 0), "gallery": ks_g, "casesP": "In Saudi Arabia, plus a stand from our Cairo team.",
          "chips": ["Jeddah", "Riyadh", "Dammam & Khobar", "KSA Defense Show"], "chipsH": "Where <em>we build.</em>", "chipsP": "Stands delivered from our Jeddah office across the Kingdom."}},
 "ar": {"base": base(True),
   "eg": {"eyebrow": "تصميم وتنفيذ أجنحة المعارض في القاهرة، مصر", "heroImg": {"src": "/img/work/technip-egypes-1.jpg", "alt": "جناح Technip Energies في إيجبس، القاهرة", "cap": "Technip Energies في معرض إيجبس، من تصميم وتنفيذ دورز."},
          "slogan": "أجنحة <em>بتجمّع الزوار.</em>", "lead": "بنصمم وننفذ ونركّب أجنحة المعارض في مصر: أفكار ثلاثية الأبعاد، وتصنيع في ورشنا، وشاشات وإضاءة، وتركيب وفك، كله مع فريق واحد.",
          "introH": "تلات أيام <em>تسيب فيهم أثر.</em>", "intro": ["المعرض كام يوم ومنافسينك واقفين على بعد أمتار منك. الجناح لازم يوقّف الناس في الممر، ويدي فريقك مساحة يتكلم، ويبيّن علامتك كأنها الرائدة في مجالها.", "بنينا أجنحة في Cairo ICT وإيجبس وAI Everything وبلاستكس وEgyBeauty Africa وغيرهم. بنصمم حسب حركة الزوار، وبنصنّع في ورشنا، وبنفضل في الموقع من التركيب للفك."],
          "cases": c(['technip', 'isys', 'dell', 'alkan'], 1), "gallery": eg_g,
          "chips": ["Cairo ICT", "إيجبس", "AI Everything", "بلاستكس", "EgyBeauty Africa"], "chipsP": "معارض وقفت فيها أجنحتنا."},
   "ksa": {"eyebrow": "تصميم وتنفيذ أجنحة المعارض في جدة", "heroImg": {"src": L("inter-01"), "alt": "جناح INTRA في معرض الدفاع بجدة", "cap": "INTRA في معرض الدفاع بجدة، من تصميم وتنفيذ دورز."},
          "slogan": "مبنية <em>لمعارض السعودية.</em>", "lead": "من مكتبنا في جدة نصمم ونصنّع ونركّب أجنحة المعارض في كل السعودية، من الفكرة ثلاثية الأبعاد والتصنيع لحد الشاشات والإضاءة والتركيب والفك.",
          "introH": "معارض السعودية <em>تكبر كل سنة.</em>", "intro": ["المعارض في جدة والرياض صارت تجذب عارضين دوليين وأعداد زوار ضخمة. جناحك ينافس علامات عالمية، فلازم يكون جريء ومتقن ويتسلّم في وقته بالضبط.", "نفذنا لـINTRA ومعارف والقدرة العربية في المملكة، ومعنا خبرة أكثر من 100 جناح في مصر. نتولى موافقات المنظم والتركيب والدعم على مدار الساعة أثناء المعرض."],
          "cases": c(['intra', 'maarif', 'qudra', 'isys'], 1), "gallery": ks_g, "casesP": "في السعودية، ومعها جناح من فريقنا في القاهرة.",
          "chips": ["جدة", "الرياض", "الدمام والخبر", "معرض الدفاع"], "chipsH": "وين <em>نبني.</em>", "chipsP": "أجنحة ننفذها من مكتبنا في جدة في كل المملكة."}}}
json.dump(d, open('src/data/services/booth.json', 'w'), ensure_ascii=False, indent=1)
print('ok', len(eg_g), len(ks_g))
