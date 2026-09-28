import * as cheerio from 'cheerio';
import template from '../content/home.html?raw';
import ar from '../i18n/home.ar.json';

// Pages that exist in Arabic on the new site. Everything else links to English.
const AR_PAGES = new Set(['/', '/contact-us/']);

function localPath(href, lang) {
  let path = href.replace(/^https:\/\/doersadv\.com/, '');
  if (!path.startsWith('/')) path = '/' + path;
  if (lang === 'ar' && AR_PAGES.has(path)) return '/ar' + path;
  return path;
}

/** Render the homepage body HTML for one language. */
export function renderHome(lang = 'en') {
  const $ = cheerio.load(template, null, false);
  if (lang === 'ar') {
    $('[data-t]').each((_, el) => {
      const key = $(el).attr('data-t');
      if (ar[key] !== undefined) $(el).html(ar[key]);
    });
  }
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (/^https:\/\/doersadv\.com/.test(href)) $(el).attr('href', localPath(href, lang));
    else if (/^[a-z0-9-]+(\/[a-z0-9-]+)*\/$/.test(href)) $(el).attr('href', '/' + href);
  });
  $('[src^="img/"]').each((_, el) => $(el).attr('src', '/' + $(el).attr('src')));
  $('[style*="url(img/"]').each((_, el) => $(el).attr('style', $(el).attr('style').replace(/url\(img\//g, 'url(/img/')));
  const langLink = $('#lang');
  if (lang === 'ar') langLink.attr({ href: '/', hreflang: 'en', lang: 'en' }).text('English');
  else langLink.attr({ href: '/ar/', hreflang: 'ar', lang: 'ar' }).text('عربي');
  $('a.logo').attr('href', lang === 'ar' ? '/ar/' : '/');
  return $.html();
}
