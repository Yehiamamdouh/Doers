import * as cheerio from 'cheerio';
import template from '../content/home.html?raw';
import ar from '../i18n/home.ar.json';
import { hasArabic, loc } from './links.js';
import data from '../data/home-services.json';
import films from '../data/films.json';
import subservices from '../data/subservices.json';

function localPath(href, lang) {
  let path = href.replace(/^https:\/\/doersadv\.com/, '');
  if (!path.startsWith('/')) path = '/' + path;
  if (lang === 'ar' && hasArabic(path) && !path.startsWith('/ar/') && !/\.\w+$/.test(path)) return '/ar' + path;
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
  // Service lists, menus and the city strip are in the HTML (not built in the browser) so search engines see every link.
  const isAr = lang === 'ar';
  const nm = (s) => (isAr ? s.a : s.n);
  const city = (c) => (isAr ? (c ? 'القاهرة' : 'جدة') : c ? 'Cairo' : 'Jeddah');
  const U = (p) => loc(p.startsWith('*') ? '/' + p.slice(1).replace(/^\//, '') : p, lang);
  const S = data.services;
  $('#svc').html(S.map((s, i) => `<div class="row"${s.img ? ` data-img="/${s.img}"` : ''}><span class="n">${String(i + 1).padStart(2, '0')}</span><h3><a href="${U(s.eg || s.ksa)}">${nm(s)}</a></h3><p>${isAr ? s.da : s.d}</p><span class="cities">${s.eg ? `<a href="${U(s.eg)}">${city(1)}</a>` : ''}${s.ksa ? `<a href="${U(s.ksa)}">${city(0)}</a>` : ''}</span></div>`).join(''));
  $('#menu-all').html(S.map((s) => `<div class="mrow"><a class="mname" href="${U(s.eg || s.ksa)}">${nm(s)}</a><span class="mcity">${s.eg ? `<a href="${U(s.eg)}">${city(1)}</a>` : ''}${s.ksa ? `<a href="${U(s.ksa)}">${city(0)}</a>` : ''}</span></div>`).join(''));
  $('#fsvc').html(S.map((s) => `<li><a href="${U(s.eg || s.ksa)}">${nm(s)}</a></li>`).join(''));
  const items = subservices[isAr ? 'ar' : 'en'].map((s) => `<span>${s}</span>`).join('');
  $('#track').html(items + items);
  $('#citylist').html(data.cities.map((c) => `<span>${isAr ? c[1] : c[0]}</span>`).join('<i>·</i>'));
  // The "Play reel" sticker plays the showreel once it's on Vimeo (src/data/films.json), the EMS ad until then.
  const reel = films.find((f) => f.key === 'showreel' && f.vimeo);
  if (reel) {
    $('.sticker').attr({ 'data-vid': reel.vimeo, 'aria-label': isAr ? 'شغّل شوريل دورز' : 'Play the Doers showreel' });
    $('.sticker .thumb img').attr('src', `/img/films/${reel.vimeo}.jpg`);
  }
  const langLink = $('#lang');
  if (lang === 'ar') langLink.attr({ href: '/', hreflang: 'en', lang: 'en' }).text('English');
  else langLink.attr({ href: '/ar/', hreflang: 'ar', lang: 'ar' }).text('عربي');
  $('a.logo').attr('href', lang === 'ar' ? '/ar/' : '/');
  return $.html();
}
