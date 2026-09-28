// Menu paths starting with "*" are pages new to this site that have no Arabic version yet.
const EN_ONLY = new Set(['/website-development-company-egypt/', '/signage-internal-branding-egypt/', '/ksa/signage-internal-branding-in-jeddah/']);

/** The URL of a site page in the reader's language. */
export function loc(path, lang = 'en') {
  const p = path.startsWith('*') ? path.slice(1) : path;
  if (lang !== 'ar' || EN_ONLY.has(p) || p.startsWith('/ar/')) return p;
  return p === '/' ? '/ar/' : '/ar' + p;
}

export function hasArabic(path) {
  return !EN_ONLY.has(path);
}
