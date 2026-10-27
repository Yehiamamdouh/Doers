// Build step: turn the saved live search pages into search templates and point
// every search box on the site at them.
//
//   site/search/index.html     English results page (Elementor search template)
//   site/ar/search/index.html  Arabic results page (theme's default template)
//
// The results list is filled in the browser by static-ajax/search.js from
// /search-index.json. The live site's Arabic search never returned anything,
// so the Arabic results use the theme's own blog card (as on /ar/2026/04/).
//
// Usage: node tools/cms/search-pages.mjs SITE_DIR
import fs from 'node:fs';
import path from 'node:path';
import { htmlFiles, readDoc, writeDoc } from './html.mjs';

const site = process.argv[2];
const file = p => path.join(site, p);

function template(doc, id, html) {
	const t = doc.createElement('template');
	t.id = id;
	t.innerHTML = html;
	return t;
}

// English: keep the first result card as the template, then empty the list.
{
	const doc = readDoc(file('search/index.html'));
	const list = doc.querySelector('.elementor-widget-wcf--posts .wcf-posts');
	const card = list.querySelector('article');
	const none = readDoc(file('search/_none.html')).querySelector('.elementor-widget-wcf--blog--search--result-message');
	const posts = list.closest('.elementor-widget-wcf--posts');
	posts.after(template(doc, 'almajna-search-card', card.outerHTML), template(doc, 'almajna-search-none', none.outerHTML));
	list.innerHTML = '';
	doc.querySelector('h1.default-search-title span').textContent = '';
	writeDoc(file('search/index.html'), doc);
	fs.rmSync(file('search/_none.html'));
}

// Arabic: the "nothing found" block is already the page content.
{
	const doc = readDoc(file('ar/search/index.html'));
	const box = doc.querySelector('.default-blog__item-content');
	const archive = readDoc(file('ar/2026/04/index.html'));
	const card = archive.querySelector('.default-blog__item-content article');
	box.after(template(doc, 'almajna-search-card', card.outerHTML), template(doc, 'almajna-search-none', box.innerHTML));
	box.innerHTML = '';
	writeDoc(file('ar/search/index.html'), doc);
}

// Both pages load the search script.
for (const p of ['search/index.html', 'ar/search/index.html']) {
	const doc = readDoc(file(p));
	if (!doc.querySelector('script#almajna-search-js')) {
		const s = doc.createElement('script');
		s.id = 'almajna-search-js';
		s.src = '/static-ajax/search.js';
		s.defer = true;
		doc.body.append(s);
	}
	writeDoc(file(p), doc);
}

// Every search box: English forms go to /search/, Arabic ones to /ar/search/.
// (Edited as text so the rest of each page stays byte for byte the same.)
let forms = 0;
for (const p of htmlFiles(site)) {
	const raw = fs.readFileSync(p, 'utf8');
	if (!/name="s"/.test(raw)) continue;
	const rel = path.relative(site, p).split(path.sep).join('/');
	const out = raw.replace(/<form\b[^>]*>(?=(?:(?!<\/form>)[\s\S])*?name="s")/g, tag => {
		const action = (tag.match(/action="([^"]*)"/) || [])[1] || '';
		const ar = rel.startsWith('ar/') || /\/ar\/?$/.test(action);
		forms++;
		return tag.replace(/action="[^"]*"/, `action="${ar ? '/ar/search/' : '/search/'}"`);
	});
	if (out !== raw) fs.writeFileSync(p, out);
}
console.log('search forms pointed at the search pages:', forms);
