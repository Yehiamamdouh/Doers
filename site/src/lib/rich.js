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
    return { id: s.id, city, paths: s.paths, ...(t.base || {}), ...(t[city] || {}) };
  }
  return null;
}
