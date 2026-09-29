"""Builds src/data/services/signage.json from the original custom signage pages (service-pages*.json)."""
import json, re, html
U = html.unescape
EN = {p['slug']: p for p in json.load(open('src/data/service-pages.json'))}
AR = {p['slug']: p for p in json.load(open('src/data/service-pages.ar.json'))}
PICK = ['arab-bank-night', 'axa-reception', 'serenity-alpha-beach', 'trivium-pylon', 'sanofi-office', 'mash-manifesto', 'sheraton', 'gourmet-3d',
        'axa-history-wall', 'marriott-pylon', 'serenity-stardust', 'msd-dubai', 'sway-mall', 'rsa-wall-of-fame', 'dina-farms', 'arab-bank-install', 'meat-moot', 'itsa-wood']
def gallery(p):
    g = {re.search(r'/([^/]+)\.jpg', s).group(1): U(a) for s, a in re.findall(r'<img src="([^"]+)" alt="([^"]+)"', p['proof_html'])}
    return [{"src": f"/img/signage/{k}.jpg", "alt": g[k].replace(': ', ' · ', 1)} for k in PICK if k in g]
def city(p, ar, eyebrow, hero, cases):
    return {"eyebrow": eyebrow, "slogan": p['h1'], "lead": p['lead'],
            "heroImg": {"src": f"/img/signage/{hero[0]}.jpg", "alt": hero[1], "cap": hero[1]},
            "services": [{"t": f[1], "d": f[2], "tags": [f[0]]} for f in p['feats']],
            "process": [list(s) for s in p['steps']], "introH": p['why_h'], "intro": p['why'],
            "chips": p['tags'], "gallery": gallery(p), "cases": cases}
C = {
 'en': {
  'arab': {"tag": "Banking · Facade & branches", "client": "Arab Bank", "text": "Illuminated facade letters and logos for Arab Bank branches, from shop drawings and fabrication to night installation.", "img": "/img/signage/arab-bank-install.jpg", "alt": "Arab Bank letters during installation"},
  'axa': {"tag": "Insurance · Head office · Cairo", "client": "AXA", "text": "The AXA head office in Cairo, branded from reception to meeting rooms: the world-map wall, the “Proud of our history” wall, branded partitions and sustainability graphics.", "img": "/img/signage/axa-reception.jpg", "alt": "AXA reception branding", "metrics": [["Design", "to installation"], ["5+", "Branded zones"]]},
  'serenity': {"tag": "Hospitality · Resort signage", "client": "Serenity Hotels", "text": "A full signage package across Serenity resorts: entrance signs, restaurant names, backlit logo walls and brushed-metal letters.", "img": "/img/signage/serenity-alpha-beach.jpg", "alt": "Serenity Alpha Beach entrance sign"},
  'sanofi': {"tag": "Healthcare · Offices · Jeddah, Riyadh & Dubai", "client": "Sanofi", "text": "Office branding for Sanofi in Jeddah, Riyadh and Dubai, one standard rolled out across three cities.", "img": "/img/signage/sanofi-office.jpg", "alt": "Sanofi office branding", "metrics": [["3", "Cities"], ["1", "Standard"]]},
  'msd': {"tag": "Healthcare · Office · Dubai", "client": "MSD", "text": "Wall graphics and lounge branding for the MSD office in Dubai.", "img": "/img/signage/msd-dubai.jpg", "alt": "MSD Dubai office graphics"}},
 'ar': {
  'arab': {"tag": "بنوك · الواجهات والفروع", "client": "البنك العربي", "text": "حروف وشعارات مضيئة لواجهات فروع البنك العربي، من الرسومات التنفيذية والتصنيع لحد التركيب بالليل.", "img": "/img/signage/arab-bank-install.jpg", "alt": "حروف البنك العربي أثناء التركيب"},
  'axa': {"tag": "تأمين · المقر الرئيسي · القاهرة", "client": "AXA", "text": "المقر الرئيسي لـAXA في القاهرة بهوية كاملة من الاستقبال لغرف الاجتماعات: جدار خريطة العالم، وجدار «فخورون بتاريخنا»، وفواصل زجاجية، وجرافيك الاستدامة.", "img": "/img/signage/axa-reception.jpg", "alt": "هوية استقبال AXA", "metrics": [["من التصميم", "للتركيب"], ["+5", "مناطق بهوية"]]},
  'serenity': {"tag": "ضيافة · لافتات المنتجعات", "client": "Serenity Hotels", "text": "باقة لافتات كاملة لمنتجعات سيرينيتي: لافتات المداخل، وأسماء المطاعم، وجدران شعار بإضاءة خلفية، وحروف معدنية مصقولة.", "img": "/img/signage/serenity-alpha-beach.jpg", "alt": "لافتة مدخل سيرينيتي ألفا بيتش"},
  'sanofi': {"tag": "رعاية صحية · مكاتب · جدة والرياض ودبي", "client": "سانوفي", "text": "هوية مكاتب سانوفي في جدة والرياض ودبي، بمعيار واحد في ثلاث مدن.", "img": "/img/signage/sanofi-office.jpg", "alt": "هوية مكاتب سانوفي", "metrics": [["3", "مدن"], ["1", "معيار"]]},
  'msd': {"tag": "رعاية صحية · مكتب · دبي", "client": "MSD", "text": "جرافيك جداري وهوية الاستراحة لمكتب MSD في دبي.", "img": "/img/signage/msd-dubai.jpg", "alt": "جرافيك مكتب MSD في دبي"}}}
def base(ar):
    return {"crumb": "اللافتات والهوية الداخلية" if ar else "Signage & Internal Branding",
            "stats": [["+15", "علامة في معرض أعمالنا للافتات"], ["3", "دول: مصر والسعودية والإمارات"], ["6", "مراحل من المعاينة للصيانة"], ["1", "فريق من التصميم للتركيب"]] if ar else
                     [["15+", "Brands in our signage portfolio"], ["3", "Countries: Egypt, KSA and the UAE"], ["6", "Stages from survey to aftercare"], ["1", "Team from design to drill"]],
            "servicesH": "إيه اللي <em>بنعمله.</em>" if ar else "What we <em>make.</em>",
            "processH": "من المعاينة <em>للتركيب.</em>" if ar else "From survey <em>to install.</em>",
            "casesH": "شغل <em>على الأرض.</em>" if ar else "Work <em>on the wall.</em>",
            "galleryH": "من <em>المشاريع.</em>" if ar else "From <em>the job.</em>",
            "chipsH": "خامات <em>وتقنيات.</em>" if ar else "Materials <em>& methods.</em>"}
e, a = C['en'], C['ar']
eg, ks = 'signage-internal-branding-egypt', 'ksa/signage-internal-branding-in-jeddah'
d = {"id": "signage", "paths": {"eg": "/signage-internal-branding-egypt/", "ksa": "/ksa/signage-internal-branding-in-jeddah/"},
     "en": {"base": base(False),
            "eg": city(EN[eg], False, "Signage & internal branding · Cairo", ("arab-bank-night", "Arab Bank: illuminated facade letters and logo"), [e['axa'], e['arab'], e['serenity'], e['sanofi']]),
            "ksa": city(EN[ks], False, "Signage & internal branding · Jeddah", ("sanofi-office", "Sanofi: office branding in Jeddah, Riyadh and Dubai"), [e['sanofi'], e['msd'], e['axa'], e['arab']])},
     "ar": {"base": base(True),
            "eg": city(AR[eg], True, "اللافتات والهوية الداخلية · القاهرة", ("arab-bank-night", "البنك العربي: حروف وشعار مضيئة على الواجهة"), [a['axa'], a['arab'], a['serenity'], a['sanofi']]),
            "ksa": city(AR[ks], True, "اللافتات والهوية الداخلية · جدة", ("sanofi-office", "سانوفي: هوية المكاتب في جدة والرياض ودبي"), [a['sanofi'], a['msd'], a['axa'], a['arab']])}}
json.dump(d, open('src/data/services/signage.json', 'w'), ensure_ascii=False, indent=1)
print('ok', len(d['en']['eg']['gallery']))
