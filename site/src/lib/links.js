import legacy from '../data/legacy-pages.json';
import servicesAr from '../data/service-pages.ar.json';

// Pages built for the new site that have an Arabic version, plus every old page that was really translated.
const AR = new Set(['/', '/contact-us/', '/blog/', '/privacy-policy/', ...legacy.filter((p) => p.lang === 'ar').map((p) => p.path.slice(3)), ...servicesAr.map((p) => `/${p.slug}/`)]);

/** The URL of a site page in the reader's language (English when there is no Arabic version). Menu paths may start with "*". */
export function loc(path, lang = 'en') {
  const p = path.startsWith('*') ? path.slice(1) : path;
  if (lang !== 'ar' || !AR.has(p)) return p;
  return p === '/' ? '/ar/' : '/ar' + p;
}

export function hasArabic(path) {
  return AR.has(path);
}
