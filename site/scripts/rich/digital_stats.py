"""Digital marketing headline stats: the framework, the technology, the know-how and the client base.
Campaign results stay inside their own case studies, not as headline numbers."""
import json
from ar_patch import patch
p = 'src/data/services/digital-marketing.json'
d = json.load(open(p))
d['en']['base']['stats'] = [["6", "Stages in our growth framework, from first reach to repeat sale"],
                            ["Live", "Dashboards on GA4, Tag Manager and HubSpot CRM, following every lead from click to sale"],
                            ["15+", "Years of marketing know-how, as Google and HubSpot partners"],
                            ["12+", "Industries served, from FMCG and real estate to government and UN agencies"]]
json.dump(d, open(p, 'w'), ensure_ascii=False, indent=1)
patch('digital-marketing',
 base={"stats": [["6", "مراحل في منهج النمو بتاعنا، من أول وصول لحد البيعة المتكررة"],
                 ["لحظي", "لوحات متابعة على GA4 وTag Manager وHubSpot CRM، بتمشي ورا كل عميل من الكليك للبيعة"],
                 ["+15", "سنة خبرة في التسويق، وإحنا شريك جوجل وHubSpot"],
                 ["+12", "مجال بنخدمه، من السلع الاستهلاكية والعقارات للحكومة ومنظمات الأمم المتحدة"]]},
 base_ksa={"stats": [["6", "مراحل في منهج النمو لدينا، من الوصول الأول إلى البيع المتكرر"],
                     ["لحظياً", "لوحات متابعة على GA4 وTag Manager وHubSpot CRM، ترافق كل عميل من النقرة إلى البيع"],
                     ["+15", "عاماً من الخبرة في التسويق، شركاء معتمدون لدى جوجل وHubSpot"],
                     ["+12", "قطاعاً نخدمه، من السلع الاستهلاكية والعقارات إلى الجهات الحكومية ووكالات الأمم المتحدة"]]})
