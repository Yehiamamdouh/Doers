"""Builds src/data/service-pages.ar.json: the Arabic versions of the new service pages.
Text fields come from AR below; the HTML blocks are the English ones with their text swapped phrase by phrase.
Run after editing either this file or the English pages: python3 scripts/service_pages_ar.py"""
import json, re, html, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
EN = json.loads((ROOT / 'src/data/service-pages.json').read_text())

# Headings split around <em>: whole inner HTML, English -> Arabic.
H2 = {
    'Ten disciplines. <em>One accountable team.</em>': 'عشرة تخصصات. <em>وفريق واحد مسؤول.</em>',
    'The <em>stack.</em>': '<em>التقنيات.</em>',
    'Included in <em>every build.</em>': 'مشمول في <em>كل مشروع.</em>',
    'Live <em>websites.</em>': 'مواقع <em>تعمل الآن.</em>',
    'Apps on the <em>stores.</em>': 'تطبيقات على <em>المتاجر.</em>',
    'Traffic that <em>converts.</em>': 'زيارات <em>تتحول لعملاء.</em>',
    'The <em>work.</em>': '<em>أعمالنا.</em>',
    'Trusted in <em>the Kingdom</em> and beyond.': 'ثقة في <em>المملكة</em> وخارجها.',
}
T = {
    # web development
    'Projects delivered across web, mobile and enterprise platforms': 'مشروع سلّمناه بين مواقع وتطبيقات موبايل وأنظمة للشركات',
    'Service disciplines, from UI/UX to AI agents': 'تخصصات، من تصميم تجربة المستخدم إلى وكلاء الذكاء الاصطناعي',
    'Countries: Egypt, Saudi Arabia, UAE, Kuwait, Jordan, Qatar': 'دول: مصر والسعودية والإمارات والكويت والأردن وقطر',
    'Industries, including government, real estate, healthcare and retail': 'قطاعًا، منها الحكومة والعقارات والرعاية الصحية والتجزئة',
    'Website Development': 'تطوير المواقع',
    'Corporate, marketing and product websites built from scratch, responsive, bilingual and tuned for Core Web Vitals.': 'مواقع للشركات والحملات والمنتجات نبنيها من الصفر، متجاوبة مع كل الشاشات، بلغتين، ومضبوطة على مؤشرات Core Web Vitals.',
    'UI/UX Design': 'تصميم واجهات وتجربة المستخدم',
    'Research, wireframes, design systems and clickable prototypes, with a WCAG 2.1 accessibility baseline.': 'بحث، ومخططات أولية، وأنظمة تصميم، ونماذج تفاعلية قابلة للتجربة، مع الالتزام بمعايير الإتاحة WCAG 2.1.',
    'E-Commerce': 'التجارة الإلكترونية',
    'Multi-currency, multi-language stores for GCC and MENA, with checkout flows built to cut abandonment.': 'متاجر متعددة العملات واللغات للخليج والشرق الأوسط، بخطوات دفع مصممة لتقليل السلال المتروكة.',
    'Web Applications': 'تطبيقات الويب',
    'CRMs, ERPs, dashboards and SaaS platforms with role-based access, audit logs and real-time features.': 'أنظمة CRM وERP ولوحات تحكم ومنصات SaaS، بصلاحيات حسب الدور وسجلات تدقيق وخصائص لحظية.',
    'Mobile Apps': 'تطبيقات الموبايل',
    'Cross-platform and native iOS and Android apps, published and maintained on both stores.': 'تطبيقات iOS وأندرويد، أصلية أو متعددة المنصات، ننشرها ونتابع صيانتها على المتجرين.',
    'Payment Gateways': 'بوابات الدفع',
    'Local and global gateways, wallets and Buy Now Pay Later, with tokenization and 3D Secure 2.': 'بوابات محلية وعالمية ومحافظ إلكترونية وخدمات اشترِ الآن وادفع لاحقًا، مع ترميز البطاقات و3D Secure 2.',
    'Content Management': 'أنظمة إدارة المحتوى',
    'Custom and headless CMSs with Arabic editorial tools, roles, approvals and scheduling.': 'أنظمة مخصصة وHeadless بأدوات تحرير عربية، وصلاحيات، ومراحل موافقة، وجدولة للنشر.',
    'SEO': 'تحسين محركات البحث (SEO)',
    'Technical audits, Arabic keyword research, content clusters and monthly reporting tied to business KPIs.': 'مراجعات تقنية، وبحث كلمات مفتاحية بالعربي، ومجموعات محتوى، وتقارير شهرية مرتبطة بمؤشرات أداء نشاطك.',
    'Maintenance': 'الصيانة',
    'Security patches, daily backups, uptime monitoring and a named technical contact with SLA response times.': 'تحديثات أمنية، ونسخ احتياطي يومي، ومراقبة لتشغيل الموقع، ومسؤول تقني محدد بأزمنة استجابة ملتزمة باتفاقية مستوى الخدمة.',
    'AI Agents': 'وكلاء الذكاء الاصطناعي',
    'Chat and support agents connected to your website, knowledge base and CRM, answering in Arabic and English.': 'وكلاء محادثة ودعم مرتبطون بموقعك وقاعدة معارفك ونظام CRM، يردون بالعربي والإنجليزي.',
    'LLM APIs · RAG · WhatsApp & web chat': 'LLM APIs · RAG · واتساب ومحادثة الموقع',
    'Frontend': 'الواجهة الأمامية', 'Backend': 'الخوادم', 'Data': 'قواعد البيانات', 'Mobile': 'الموبايل', 'CMS': 'إدارة المحتوى', 'Commerce': 'التجارة',
    'Saudi & GCC payments': 'مدفوعات السعودية والخليج', 'Global payments': 'مدفوعات عالمية', 'Wallets & BNPL': 'المحافظ والتقسيط',
    'Cloud & DevOps': 'السحابة وDevOps', 'Monitoring & security': 'المراقبة والأمان', 'Analytics': 'التحليلات',
    'PHP, Laravel, Node.js, NestJS, REST & GraphQL APIs': 'PHP، Laravel، Node.js، NestJS، وواجهات REST وGraphQL',
    'AWS, Cloudflare, Docker, auto-scaling, zero-downtime releases': 'AWS، Cloudflare، Docker، توسع تلقائي، وإطلاق تحديثات بلا توقف',
    'Sentry, New Relic, UptimeRobot, Wazuh, SSL, daily backups': 'Sentry، New Relic، UptimeRobot، Wazuh، SSL، ونسخ احتياطي يومي',
    'Arabic and English with proper right-to-left layouts': 'عربي وإنجليزي بتخطيط صحيح من اليمين لليسار',
    'Responsive on desktop, tablet and mobile': 'متجاوب على الكمبيوتر والتابلت والموبايل',
    'Core Web Vitals tuning: image optimization, lazy loading, caching': 'ضبط Core Web Vitals: ضغط الصور، والتحميل عند الحاجة، والتخزين المؤقت',
    'SEO foundations: meta, schema, sitemap, clean URLs': 'أساسيات SEO: الوسوم الوصفية، والبيانات المنظمة، وخريطة الموقع، وروابط نظيفة',
    'SSL, secure hosting setup, daily backups and uptime monitoring': 'SSL، وإعداد استضافة آمنة، ونسخ احتياطي يومي، ومراقبة التشغيل',
    'PCI-aware payments with tokenization and 3D Secure 2': 'مدفوعات متوافقة مع PCI بترميز البطاقات و3D Secure 2',
    'Analytics and conversion tracking from day one': 'تحليلات وتتبع للتحويلات من أول يوم',
    'Full source code and admin handover documentation': 'الكود المصدري كاملًا ودليل استخدام لوحة التحكم',
    'Training session for your team': 'جلسة تدريب لفريقك',
    '30 days of post-launch support': '30 يوم دعم بعد الإطلاق',
    'Google Play ↗': 'جوجل بلاي ↗',
    '6M+': '+6 مليون',
    '500K': '500 ألف',
    'Unique users reached for Safi on a $20K budget': 'مستخدم وصلنا لهم لصالح Safi بميزانية 20 ألف دولار',
    'Clicks, Safi campaign': 'نقرة، حملة Safi',
    'Cost per lead, real estate campaign': 'تكلفة العميل المحتمل، حملة عقارية',
    'Effective CPC, real estate campaign': 'تكلفة النقرة الفعلية، حملة عقارية',
    'Our web team sits next to our performance and SEO teams, so every site is planned around the campaigns that will send people to it.': 'فريق المواقع عندنا يعمل جنبًا إلى جنب مع فريقي الإعلانات المدفوعة وSEO، فيُخطَّط كل موقع حول الحملات التي ستجلب له الزوار.',
    # signage
    'All work': 'كل الأعمال', 'Facades & shops': 'واجهات ومحلات', 'Hotels & resorts': 'فنادق ومنتجعات', 'Malls': 'مولات', 'Offices': 'مكاتب',
    'Filter photos': 'تصفية الصور', 'Close': 'إغلاق',
    'Illuminated facade letters and logo': 'حروف وشعار مضيئة على الواجهة',
    'Hotel facade letters': 'حروف على واجهة الفندق',
    'Illuminated mall pylon': 'لافتة عمودية مضيئة للمول',
    'Head office wall graphics': 'جرافيك جداري للمقر الرئيسي',
    'Illuminated logo sign': 'لافتة شعار مضيئة',
    'Resort entrance sign': 'لافتة مدخل المنتجع',
    'Facade lighting and letters': 'إضاءة وحروف الواجهة',
    'Vision & values wall': 'جدار الرؤية والقيم',
    'Branch facade': 'واجهة الفرع',
    'Backlit restaurant sign': 'لافتة مطعم بإضاءة خلفية',
    'Backlit venue sign': 'لافتة مكان بإضاءة خلفية',
    '“Proud of our history” wall': 'جدار «فخورون بتاريخنا»',
    'Mall facade signage at night': 'لافتات واجهة المول ليلًا',
    '3D letters and app signage': 'حروف بارزة ولافتة التطبيق',
    'Manifesto wall': 'جدار المبادئ',
    'Wayfinding pylon': 'لافتة إرشادية عمودية',
    'Showroom facade sign': 'لافتة واجهة المعرض',
    'Branded partition': 'فاصل زجاجي بهوية الشركة',
    'Restaurant name sign': 'لافتة اسم المطعم',
    '3D logo letters': 'حروف بارزة للشعار',
    'Feature wall': 'جدار مميز',
    'StarDust restaurant sign': 'لافتة مطعم StarDust',
    'Building branding': 'هوية المبنى',
    'Office branding, Jeddah, Riyadh & Dubai': 'هوية المكاتب في جدة والرياض ودبي',
    'Illuminated letters at night': 'حروف مضيئة ليلًا',
    'Letters during installation': 'الحروف أثناء التركيب',
    'Dubai office graphics': 'جرافيك مكتب دبي',
    'Restaurant entrance': 'مدخل المطعم',
    'Reception branding': 'هوية الاستقبال',
    'Backlit logo wall': 'جدار شعار بإضاءة خلفية',
    'Glass wall of fame': 'جدار إنجازات زجاجي',
    'Pantry illustrations': 'رسومات المطبخ',
    'Motivational panel': 'لوحة تحفيزية',
    'Brushed metal letters': 'حروف معدنية مصقولة',
    'Sustainability wall graphic': 'جرافيك جداري عن الاستدامة',
    'Office branding · Jeddah, Riyadh & Dubai': 'هوية المكاتب · جدة والرياض ودبي',
    'Dubai office branding': 'هوية مكتب دبي',
    'Production & AV · Hilton Jeddah': 'إنتاج وصوتيات ومرئيات · هيلتون جدة',
    'Cairo head office · design to installation': 'المقر الرئيسي بالقاهرة · من التصميم للتركيب',
    'Signage & internal branding': 'لافتات وهوية داخلية',
    'Hotel signage': 'لافتات فندقية',
}
KEEP = re.compile(r'^[\w .\'’&+·,\-/é]*(↗)?$')  # brand names, domains and tech lists stay as they are

missing = set()
def tr(s):
    k = html.unescape(s).strip()
    if not k or not re.search('[A-Za-z]', k): return s
    if k in T: return s.replace(s.strip(), html.escape(T[k], quote=False))
    m = re.match(r'^Open (.+) photo$', k)
    if m: return html.escape(f'افتح صورة {m.group(1)}')
    m = re.match(r'^(.+?): (.+)$', k)
    if m and m.group(2) in T: return html.escape(f'{m.group(1)}: {T[m.group(2)]}')
    if not KEEP.match(k) or k in ('The', 'Live'): missing.add(k)
    return s

def tr_html(h):
    for en, ar in H2.items(): h = h.replace(f'>{en}</h2>', f'>{ar}</h2>')
    h = re.sub(r'((?:alt|aria-label)=")([^"]*)(")', lambda m: m.group(1) + tr(m.group(2)).replace('"', '&quot;') + m.group(3), h)
    parts = re.split(r'(<script.*?</script>|<[^>]+>)', h, flags=re.S)
    return ''.join(p if p.startswith('<') else tr(p) for p in parts)

AR = json.loads((ROOT / 'scripts/service_pages_ar.text.json').read_text())
out = []
for p in EN:
    a = dict(p, **AR[p['slug']], lang='ar')
    a['proof_html'] = tr_html(p['proof_html'])
    a['mosaic_html'] = tr_html(p['mosaic_html'])
    out.append(a)
if missing:
    sys.exit('Untranslated:\n' + '\n'.join(sorted(missing)))
(ROOT / 'src/data/service-pages.ar.json').write_text(json.dumps(out, ensure_ascii=False, indent=1))
print(f'{len(out)} Arabic service pages written')
