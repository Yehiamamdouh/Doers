/**
 * Rich service pages (src/data/services/<id>.json). Each file covers one service in both cities and both languages:
 *   { "id", "paths": { "eg": "/…/", "ksa": "/ksa/…/" }, "en": { "base": {…}, "eg": {…}, "ksa": {…} }, "ar": { … } }
 * A city's fields override the shared "base" ones, so each city page carries its own local content.
 * Title, meta description and H1 stay those of the page in src/data/legacy-pages.json (same URLs, same SEO).
 */
const files = import.meta.glob('../data/services/*.json', { eager: true, import: 'default' });
const all = Object.values(files);

/** The rich content for an English path (e.g. "/digital-marketing-egypt-cairo/") in one language, or null. */
export function richFor(enPath, lang) {
  for (const s of all) {
    const city = Object.keys(s.paths).find((c) => s.paths[c] === enPath);
    if (!city) continue;
    const t = s[lang] || s.en;
    // Arabic: Cairo pages are in Egyptian Arabic (base), Saudi pages in Modern Standard Arabic (base_ksa over base).
    const ksaBase = lang === 'ar' && city !== 'eg' ? t.base_ksa || {} : {};
    return { id: s.id, city, paths: s.paths, ...(t.base || {}), ...ksaBase, ...(t[city] || {}) };
  }
  return null;
}

/**
 * Route props for a page from service-pages(.ar).json: the rich template when a services/*.json file covers its path,
 * with the page's own title and description kept and its keyword eyebrow promoted to the H1; otherwise the ServicePage.
 */
export function servicePageProps(p, lang, alt) {
  const enPath = '/' + p.slug + '/';
  const r = richFor(enPath, lang);
  if (!r) return { kind: 'service', p, alt };
  const path = (lang === 'ar' ? '/ar' : '') + enPath;
  return { kind: 'legacy', r: { ...r, faq: r.faq || p.faq }, p: { path, lang, title: p.title, description: p.desc, og: p.og, h1: p.eyebrow, sections: [] }, alt };
}
