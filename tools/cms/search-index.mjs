// Writes DIR/search-index.json: one entry per content page, for static-ajax/search.js.
// Run on every build so pages added from the admin panel are searchable.
import fs from 'node:fs';
import path from 'node:path';
import { parseHTML } from 'linkedom';
import { htmlFiles } from './html.mjs';

// Listing and helper pages: their text is the other pages' text.
const SKIP = /^(ar\/)?(search|jet-popup|author|tag|category|crypto-classification|blog|\d{4})\/|(^|\/)page\/\d+\//;

const TYPES = [
	['single-post', 'post'],
	['single-our-services', 'service'],
	['single-team-members', 'team'],
	['single-projects', 'project'],
	['single-crypto-currencies', 'crypto'],
];

const clean = s => s.replace(/\s+/g, ' ').trim();
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

// "April 4, 2026" / "أبريل 10, 2026" -> "04/04/2026", the format the result cards use.
function cardDate(s) {
	const m = (s || '').trim().match(/^(\S+)\s+(\d{1,2}),\s*(\d{4})$/);
	if (!m) return '';
	let mon = MONTHS.indexOf(m[1].toLowerCase());
	if (mon < 0) mon = MONTHS_AR.indexOf(m[1]);
	if (mon < 0) return '';
	return `${m[2].padStart(2, '0')}/${String(mon + 1).padStart(2, '0')}/${m[3]}`;
}

export function buildIndex(dir) {
	const entries = [];
	for (const file of htmlFiles(dir)) {
		const rel = path.relative(dir, file).split(path.sep).join('/');
		if (SKIP.test(rel) || !rel.endsWith('index.html')) continue;
		const raw = fs.readFileSync(file, 'utf8');
		const { document: doc } = parseHTML(raw);
		const body = doc.body;
		if (!body) continue;
		const cls = body.className || '';
		const type = (TYPES.find(([c]) => cls.split(' ').includes(c)) || [, 'page'])[1];
		const title = clean((doc.querySelector('title')?.textContent || '').replace(/\s*[–-]\s*ALMAJNA ADVISORS\s*$/i, ''));
		if (!title) continue;
		const author = doc.querySelector('.elementor-post-info__item--type-author');
		const authorLink = author?.closest('a')?.getAttribute('href') || '';
		const date = cardDate(doc.querySelector('.elementor-post-info__item--type-date time')?.textContent);
		const img = (raw.match(/"featuredImage":"([^"]*)"/) || [])[1]?.replace(/\\\//g, '/') || '';
		// The theme's header and footer are the first and last theme templates on the page.
		const parts = [...doc.querySelectorAll('[data-elementor-post-type="wcf-addons-template"]')].filter(e => !e.parentElement.closest('[data-elementor-post-type="wcf-addons-template"]'));
		if (parts.length >= 2) { parts[0].remove(); parts[parts.length - 1].remove(); }
		for (const el of doc.querySelectorAll('script, style, noscript, template, .default-sidebar__wrapper, .jet-popup, nav, svg')) el.remove();
		const text = clean(body.textContent).slice(0, 6000);
		entries.push({
			u: '/' + rel.replace(/index\.html$/, ''),
			l: rel.startsWith('ar/') ? 'ar' : 'en',
			t: title,
			ty: type,
			d: date,
			i: img,
			a: author ? clean(author.textContent) : '',
			al: authorLink ? '/' + path.posix.normalize(path.posix.join(path.posix.dirname(rel), authorLink)).replace(/index\.html$/, '') : '',
			x: text,
		});
	}
	fs.writeFileSync(path.join(dir, 'search-index.json'), JSON.stringify(entries));
	return entries.length;
}

if (import.meta.url === `file://${process.argv[1]}`) {
	console.log('search index entries:', buildIndex(process.argv[2]));
}
