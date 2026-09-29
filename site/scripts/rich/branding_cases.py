"""Branding page projects, as chosen by Doers: Serenity (hero), WSL (KSA), ZAS, Ignite Park, Tuya Home and UNHCR publications.
Images are pages exported from each brand book on the Drive; the UNHCR books come from the old site. EgyptAir Mini Metro is to be added when its files arrive."""
import json
p = 'src/data/services/branding.json'
d = json.load(open(p))
B = '/img/branding/'
G = [('serenity-skyfringe', 'Serenity Sky Fringe: sub-brand logo and colours', 'سيرينيتي سكاي فرينج: لوجو العلامة الفرعية وألوانها'),
     ('serenity-alpha', 'Serenity Alpha Beach: sub-brand logo and colours', 'سيرينيتي ألفا بيتش: لوجو العلامة الفرعية وألوانها'),
     ('serenity-ross', 'Serenity Ross Park: sub-brand logo and colours', 'سيرينيتي روس بارك: لوجو العلامة الفرعية وألوانها'),
     ('serenity-gourmet', 'Serenity Gourmet: sub-brand logo and colours', 'سيرينيتي جورميه: لوجو العلامة الفرعية وألوانها'),
     ('serenity-patterns', 'Serenity: brand patterns', 'سيرينيتي: باترن العلامة'),
     ('wsl-lockups', 'WSL: bilingual lockups', 'وصل WSL: نسخ اللوجو بلغتين'),
     ('wsl-colours', 'WSL: logo on brand colours', 'وصل WSL: اللوجو على ألوان العلامة'),
     ('wsl-pattern', 'WSL: brand pattern', 'وصل WSL: باترن العلامة'),
     ('unhcr-arab-strategy', 'UNHCR & League of Arab States: Arab strategy book', 'المفوضية والجامعة العربية: كتاب الاستراتيجية العربية'),
     ('unhcr-books', 'UNHCR: printed publications', 'المفوضية: مطبوعات'),
     ('ignite-essence', 'Ignite Park: the essence of the brand', 'إجنايت بارك: جوهر العلامة'),
     ('ignite-values', 'Ignite Park: brand values', 'إجنايت بارك: قيم العلامة'),
     ('tuya-hoarding', 'Tuya Home: site hoarding', 'Tuya Home: لافتة موقع المشروع'),
     ('tuya-book', 'Tuya Home: brand book', 'Tuya Home: دليل العلامة'),
     ('tuya-cards', 'Tuya Home: business cards', 'Tuya Home: كروت البيزنس'),
     ('tuya-posters', 'Tuya Home: posters', 'Tuya Home: بوسترات'),
     ('tuya-stationery', 'Tuya Home: stationery', 'Tuya Home: المطبوعات'),
     ('tuya-u', 'Tuya Home: U for sustainability', 'Tuya Home: حرف U للاستدامة'),
     ('tuya-crew', 'Tuya Home: crew uniform', 'Tuya Home: يونيفورم فريق العمل')]
gal = lambda i: [{"src": B + f + '.jpg', "alt": x[i]} for f, *x in G]
EN = [
 {"tag": "Hospitality · Group identity & brand architecture", "client": "Serenity Hospitality Group", "img": "/img/signage/serenity-alpha-beach.jpg", "alt": "Serenity Alpha Beach entrance sign",
  "text": "A full brand system for Serenity's hotels, resorts and restaurants: strategy, positioning and persona, a refined group mark, and a family of sub-brands, from Sky Fringe and Alpha Beach to Alma Heights, Ross Park and Gourmet, each with its own palette, plus typography, photography style and patterns.",
  "metrics": [["70", "Page brand book"], ["8", "Sub-brands"], ["1", "Group system"]]},
 {"tag": "Aviation · Logo & identity", "client": "ZAS · Z-Aviation Services", "img": B + "zas-logo.jpg", "fit": "contain",
  "text": "The ZAS logo and identity for Z-Aviation Services, an aviation group with five decades of ground handling, cargo and specialised services across Egypt, Sudan and South Sudan: a winged mark with speed built into the letters, a red and aviation-blue palette and the line “One Partner. Unlimited Possibilities.”",
  "metrics": [["50", "Years of legacy"], ["3", "Countries"]]},
 {"tag": "Entertainment · Brand strategy book", "client": "Ignite Park", "img": B + "ignite-hero.jpg",
  "text": "A strategy book for an entertainment park built to amuse and inspire young people: positioning platform, core message framework, the essence and values of the brand, key strengths and a tone of voice for every communication."},
 {"tag": "Interiors & architecture · Brand identity", "client": "Tuya Home Innovations", "img": B + "tuya-hoarding.jpg",
  "text": "An identity that balances structure and experience: a logo built letter by letter from materials (T for structure, U for sustainability, Y for light and space, A for craft), with typography, palettes, stationery, site hoardings, posters and a digital presence."}]
AR_EG = [
 {"tag": "ضيافة · هوية المجموعة وبنية العلامات", "client": "مجموعة سيرينيتي للضيافة", "text": "نظام علامة كامل لفنادق ومنتجعات ومطاعم سيرينيتي: الاستراتيجية والتموضع والشخصية، ولوجو راقي للمجموعة، وعيلة علامات فرعية من سكاي فرينج وألفا بيتش لحد ألما هايتس وروس بارك وجورميه، كل واحدة بألوانها، ومعاهم الخطوط وأسلوب التصوير والباترن.", "metrics": [["70", "صفحة في دليل الهوية"], ["8", "علامات فرعية"], ["1", "نظام للمجموعة"]]},
 {"tag": "طيران · لوجو وهوية", "client": "ZAS · Z-Aviation Services", "text": "لوجو وهوية ZAS، مجموعة خدمات طيران عندها خمسين سنة في الخدمات الأرضية والشحن والخدمات المتخصصة في مصر والسودان وجنوب السودان: رمز بجناح والسرعة جوه الحروف، وألوان أحمر وأزرق طيران، وجملة «One Partner. Unlimited Possibilities.»", "metrics": [["50", "سنة تاريخ"], ["3", "دول"]]},
 {"tag": "ترفيه · كتاب استراتيجية العلامة", "client": "إجنايت بارك", "text": "كتاب استراتيجية لمدينة ترفيهية معمولة تبسط وتلهم الشباب: منصة التموضع، وإطار الرسالة الأساسية، وجوهر العلامة وقيمها، ونقط قوتها، ونبرة صوت لكل تواصل."},
 {"tag": "تصميم داخلي وعمارة · هوية العلامة", "client": "Tuya Home Innovations", "text": "هوية بتوازن بين الهيكل والتجربة: لوجو متبني حرف حرف من الخامات (T للهيكل، وU للاستدامة، وY للنور والمساحة، وA للحرفة)، ومعاه الخطوط والألوان والمطبوعات ولافتات المواقع والبوسترات والحضور الديجيتال."}]
AR_KSA = [
 {"tag": "ضيافة · هوية المجموعة وبنية العلامات", "client": "مجموعة سيرينيتي للضيافة", "text": "نظام علامة متكامل لفنادق ومنتجعات ومطاعم سيرينيتي: الاستراتيجية والتموضع والشخصية، وشعار راقٍ للمجموعة، وعائلة من العلامات الفرعية من سكاي فرينج وألفا بيتش إلى ألما هايتس وروس بارك وجورميه، لكل منها ألوانها، إلى جانب الخطوط وأسلوب التصوير والأنماط.", "metrics": [["70", "صفحة في دليل الهوية"], ["8", "علامات فرعية"], ["1", "نظام للمجموعة"]]},
 {"tag": "طيران · شعار وهوية", "client": "ZAS · Z-Aviation Services", "text": "شعار ZAS وهويتها، لمجموعة خدمات طيران لها خمسة عقود في الخدمات الأرضية والشحن والخدمات المتخصصة في مصر والسودان وجنوب السودان: رمز مجنّح تسكن السرعة حروفه، وألوان الأحمر والأزرق الجوي، وشعار «One Partner. Unlimited Possibilities.»", "metrics": [["50", "عاماً من الإرث"], ["3", "دول"]]},
 {"tag": "ترفيه · كتاب استراتيجية العلامة", "client": "إجنايت بارك", "text": "كتاب استراتيجية لمدينة ترفيهية صُممت لإمتاع الشباب وإلهامهم: منصة التموضع، وإطار الرسالة الأساسية، وجوهر العلامة وقيمها، ونقاط قوتها، ونبرة صوت لكل تواصل."},
 {"tag": "تصميم داخلي وعمارة · هوية العلامة", "client": "Tuya Home Innovations", "text": "هوية توازن بين البنية والتجربة: شعار مبني حرفاً حرفاً من الخامات (T للبنية، وU للاستدامة، وY للضوء والمساحة، وA للحرفة)، مع الخطوط والألوان والمطبوعات ولافتات المواقع والملصقات والحضور الرقمي."}]
WSL = ({"tag": "Networking · Bilingual identity · Saudi Arabia", "client": "WSL · وصل", "img": B + "wsl-logo.jpg", "fit": "contain",
        "text": "A bilingual identity for WSL, “Connect ME”: one mark that reads وصل in Arabic and WSL in Latin, built on a linking stroke that becomes the icon, the pattern and the app symbol, with versions for light, dark and colour backgrounds."},
       {"tag": "تواصل · هوية بلغتين · السعودية", "client": "وصل · WSL", "text": "هوية بلغتين لـ«وصل» (Connect ME): رمز واحد بيتقري «وصل» بالعربي وWSL باللاتيني، مبني على خط بيوصل الحروف وبيبقى هو الأيقونة والباترن ورمز التطبيق، بنسخ للخلفيات الفاتحة والغامقة والملونة."},
       {"tag": "تواصل · هوية ثنائية اللغة · السعودية", "client": "وصل · WSL", "text": "هوية ثنائية اللغة لـ«وصل» (Connect ME): رمز واحد يُقرأ «وصل» بالعربية وWSL باللاتينية، مبني على خط واصل يتحول إلى الأيقونة والنمط ورمز التطبيق، بنسخ للخلفيات الفاتحة والداكنة والملونة."})
UN = ({"tag": "United Nations · Publications", "client": "UNHCR, the UN Refugee Agency", "img": B + "unhcr-refugee-law.jpg", "fit": "contain",
       "text": "Book design and printing for UNHCR, including the International Refugee Law handbook and the Arab Strategy on public health services for refugees, produced with the League of Arab States, in Arabic and English and within UNHCR's brand guidelines."},
      {"tag": "الأمم المتحدة · مطبوعات", "client": "المفوضية السامية لشؤون اللاجئين", "text": "تصميم وطباعة كتب للمفوضية، منها دليل القانون الدولي للاجئين والاستراتيجية العربية لإتاحة خدمات الصحة العامة للاجئين مع جامعة الدول العربية، بالعربي والإنجليزي وعلى دليل هوية المفوضية."},
      {"tag": "الأمم المتحدة · مطبوعات", "client": "المفوضية السامية للأمم المتحدة لشؤون اللاجئين", "text": "تصميم وطباعة كتب للمفوضية، منها دليل القانون الدولي للاجئين والاستراتيجية العربية بشأن إتاحة خدمات الصحة العامة للاجئين بالتعاون مع جامعة الدول العربية، بالعربية والإنجليزية ووفق دليل هوية المفوضية."})
def imgs(cases):
    return [{**c, **{k: EN[i][k] for k in ('img', 'fit') if k in EN[i]}} for i, c in enumerate(cases)]
hero_en = {"src": B + "serenity-hero.jpg", "alt": "Serenity Hospitality Group brand book, designed by Doers", "cap": "Serenity Hospitality Group: strategy, identity and a family of eight sub-brands."}
d['en']['base']['heroImg'] = hero_en
d['en']['base']['gallery'] = gal(0)
ZAS, IGN, TUY = EN[1], EN[2], EN[3]
d['en']['eg']['cases'] = [EN[0], ZAS, WSL[0], IGN, TUY, UN[0]]
d['en']['ksa']['cases'] = [WSL[0], EN[0], ZAS, IGN, TUY, UN[0]]
d['ar']['base']['heroImg'] = {"src": hero_en['src'], "alt": "دليل هوية مجموعة سيرينيتي للضيافة، من تصميم دورز", "cap": "مجموعة سيرينيتي للضيافة: استراتيجية وهوية وعيلة من تمن علامات فرعية."}
d['ar'].setdefault('base_ksa', {})['heroImg'] = {"src": hero_en['src'], "alt": "دليل هوية مجموعة سيرينيتي للضيافة، من تصميم دورز", "cap": "مجموعة سيرينيتي للضيافة: استراتيجية وهوية وعائلة من ثماني علامات فرعية."}
d['ar']['base']['gallery'] = gal(1)
eg, ks = imgs(AR_EG), imgs(AR_KSA)
wi = {k: WSL[0][k] for k in ('img', 'fit')}; ui = {k: UN[0][k] for k in ('img', 'fit')}
d['ar']['eg']['cases'] = [eg[0], eg[1], {**WSL[1], **wi}, eg[2], eg[3], {**UN[1], **ui}]
d['ar']['ksa']['cases'] = [{**WSL[2], **wi}, ks[0], ks[1], ks[2], ks[3], {**UN[2], **ui}]
for L in ('en', 'ar'):
    for blk in ('base', 'base_ksa'):
        d[L].get(blk, {}).pop('band', None)
json.dump(d, open(p, 'w'), ensure_ascii=False, indent=1)
print('ok')
