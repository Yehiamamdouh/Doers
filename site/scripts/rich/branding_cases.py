"""Branding page projects, as chosen by Doers: Serenity (hero), ZAS, Ignite Park, Tuya Home.
Images are pages exported from each brand book (see scripts/README); UNHCR, WSL and EgyptAir Mini Metro are to be added when their files arrive."""
import json
p = 'src/data/services/branding.json'
d = json.load(open(p))
B = '/img/branding/'
G = [('serenity-skyfringe', 'Serenity Sky Fringe: sub-brand logo and colours', 'سيرينيتي سكاي فرينج: لوجو العلامة الفرعية وألوانها'),
     ('serenity-alpha', 'Serenity Alpha Beach: sub-brand logo and colours', 'سيرينيتي ألفا بيتش: لوجو العلامة الفرعية وألوانها'),
     ('serenity-ross', 'Serenity Ross Park: sub-brand logo and colours', 'سيرينيتي روس بارك: لوجو العلامة الفرعية وألوانها'),
     ('serenity-gourmet', 'Serenity Gourmet: sub-brand logo and colours', 'سيرينيتي جورميه: لوجو العلامة الفرعية وألوانها'),
     ('serenity-patterns', 'Serenity: brand patterns', 'سيرينيتي: باترن العلامة'),
     ('zas-homepage', 'ZAS: the new homepage', 'ZAS: الصفحة الرئيسية الجديدة'),
     ('zas-legacy', 'ZAS: 50 years of aviation', 'ZAS: خمسين سنة طيران'),
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
 {"tag": "Hospitality · Group identity & brand architecture", "client": "Serenity Hospitality Group", "img": B + "serenity-cover.jpg",
  "text": "A full brand system for Serenity's hotels, resorts and restaurants: strategy, positioning and persona, a refined group mark, and a family of sub-brands, from Sky Fringe and Alpha Beach to Alma Heights, Ross Park and Gourmet, each with its own palette, plus typography, photography style and patterns.",
  "metrics": [["70", "Page brand book"], ["8", "Sub-brands"], ["1", "Group system"]]},
 {"tag": "Aviation · Logo, identity & website", "client": "ZAS · Z-Aviation Services", "img": B + "zas-logo.jpg", "fit": "contain",
  "text": "The ZAS logo and identity, then a new digital experience built on it: brand colours and typography for the web, a homepage that leads with 50 years of aviation, and sections for its specialised brands, leadership and regional network across Egypt, Sudan and South Sudan.",
  "metrics": [["50", "Years of legacy"], ["3", "Countries"]]},
 {"tag": "Entertainment · Brand strategy book", "client": "Ignite Park", "img": B + "ignite-cover.jpg",
  "text": "A strategy book for an entertainment park built to amuse and inspire young people: positioning platform, core message framework, the essence and values of the brand, key strengths and a tone of voice for every communication."},
 {"tag": "Interiors & architecture · Brand identity", "client": "Tuya Home Innovations", "img": B + "tuya-hoarding.jpg",
  "text": "An identity that balances structure and experience: a logo built letter by letter from materials (T for structure, U for sustainability, Y for light and space, A for craft), with typography, palettes, stationery, site hoardings, posters and a digital presence."}]
AR_EG = [
 {"tag": "ضيافة · هوية المجموعة وبنية العلامات", "client": "مجموعة سيرينيتي للضيافة", "text": "نظام علامة كامل لفنادق ومنتجعات ومطاعم سيرينيتي: الاستراتيجية والتموضع والشخصية، ولوجو راقي للمجموعة، وعيلة علامات فرعية من سكاي فرينج وألفا بيتش لحد ألما هايتس وروس بارك وجورميه، كل واحدة بألوانها، ومعاهم الخطوط وأسلوب التصوير والباترن.", "metrics": [["70", "صفحة في دليل الهوية"], ["8", "علامات فرعية"], ["1", "نظام للمجموعة"]]},
 {"tag": "طيران · لوجو وهوية وموقع", "client": "ZAS · Z-Aviation Services", "text": "لوجو وهوية ZAS، وبعدين تجربة ديجيتال جديدة مبنية عليهم: ألوان وخطوط العلامة للويب، وصفحة رئيسية بتبدأ بخمسين سنة طيران، وأقسام للعلامات المتخصصة والقيادات والشبكة في مصر والسودان وجنوب السودان.", "metrics": [["50", "سنة تاريخ"], ["3", "دول"]]},
 {"tag": "ترفيه · كتاب استراتيجية العلامة", "client": "إجنايت بارك", "text": "كتاب استراتيجية لمدينة ترفيهية معمولة تبسط وتلهم الشباب: منصة التموضع، وإطار الرسالة الأساسية، وجوهر العلامة وقيمها، ونقط قوتها، ونبرة صوت لكل تواصل."},
 {"tag": "تصميم داخلي وعمارة · هوية العلامة", "client": "Tuya Home Innovations", "text": "هوية بتوازن بين الهيكل والتجربة: لوجو متبني حرف حرف من الخامات (T للهيكل، وU للاستدامة، وY للنور والمساحة، وA للحرفة)، ومعاه الخطوط والألوان والمطبوعات ولافتات المواقع والبوسترات والحضور الديجيتال."}]
AR_KSA = [
 {"tag": "ضيافة · هوية المجموعة وبنية العلامات", "client": "مجموعة سيرينيتي للضيافة", "text": "نظام علامة متكامل لفنادق ومنتجعات ومطاعم سيرينيتي: الاستراتيجية والتموضع والشخصية، وشعار راقٍ للمجموعة، وعائلة من العلامات الفرعية من سكاي فرينج وألفا بيتش إلى ألما هايتس وروس بارك وجورميه، لكل منها ألوانها، إلى جانب الخطوط وأسلوب التصوير والأنماط.", "metrics": [["70", "صفحة في دليل الهوية"], ["8", "علامات فرعية"], ["1", "نظام للمجموعة"]]},
 {"tag": "طيران · شعار وهوية وموقع", "client": "ZAS · Z-Aviation Services", "text": "شعار ZAS وهويتها، ثم تجربة رقمية جديدة مبنية عليهما: ألوان العلامة وخطوطها للويب، وصفحة رئيسية تنطلق من خمسين عاماً في الطيران، وأقسام للعلامات المتخصصة والقيادات والشبكة الإقليمية في مصر والسودان وجنوب السودان.", "metrics": [["50", "عاماً من الإرث"], ["3", "دول"]]},
 {"tag": "ترفيه · كتاب استراتيجية العلامة", "client": "إجنايت بارك", "text": "كتاب استراتيجية لمدينة ترفيهية صُممت لإمتاع الشباب وإلهامهم: منصة التموضع، وإطار الرسالة الأساسية، وجوهر العلامة وقيمها، ونقاط قوتها، ونبرة صوت لكل تواصل."},
 {"tag": "تصميم داخلي وعمارة · هوية العلامة", "client": "Tuya Home Innovations", "text": "هوية توازن بين البنية والتجربة: شعار مبني حرفاً حرفاً من الخامات (T للبنية، وU للاستدامة، وY للضوء والمساحة، وA للحرفة)، مع الخطوط والألوان والمطبوعات ولافتات المواقع والملصقات والحضور الرقمي."}]
def imgs(cases):
    return [{**c, **{k: EN[i][k] for k in ('img', 'fit') if k in EN[i]}} for i, c in enumerate(cases)]
hero_en = {"src": B + "serenity-cover.jpg", "alt": "Serenity Hospitality Group brand book, designed by Doers", "cap": "Serenity Hospitality Group: strategy, identity and a family of eight sub-brands."}
d['en']['base']['heroImg'] = hero_en
d['en']['base']['gallery'] = gal(0)
d['en']['eg']['cases'] = EN; d['en']['ksa']['cases'] = EN
d['ar']['base']['heroImg'] = {"src": hero_en['src'], "alt": "دليل هوية مجموعة سيرينيتي للضيافة، من تصميم دورز", "cap": "مجموعة سيرينيتي للضيافة: استراتيجية وهوية وعيلة من تمن علامات فرعية."}
d['ar'].setdefault('base_ksa', {})['heroImg'] = {"src": hero_en['src'], "alt": "دليل هوية مجموعة سيرينيتي للضيافة، من تصميم دورز", "cap": "مجموعة سيرينيتي للضيافة: استراتيجية وهوية وعائلة من ثماني علامات فرعية."}
d['ar']['base']['gallery'] = gal(1)
d['ar']['eg']['cases'] = imgs(AR_EG); d['ar']['ksa']['cases'] = imgs(AR_KSA)
for L in ('en', 'ar'):
    for blk in ('base', 'base_ksa'):
        d[L].get(blk, {}).pop('band', None)
json.dump(d, open(p, 'w'), ensure_ascii=False, indent=1)
print('ok')
