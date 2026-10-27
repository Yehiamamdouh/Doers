// Data files for the admin panel, written on every build:
//   dist/admin/data/pages.json    every page: { p: "about-us/", t: title, l: "en" | "ar" }
//   dist/admin/data/widgets.json  Elementor widgets that are identical on several pages of
//                                 one language (header, footer...): { "dataId@en": [page indexes] }
// Editing such a widget in the admin panel updates every page in the list.
import fs from 'node:fs';
import path from 'node:path';
import { parseHTML } from 'linkedom';
import { htmlFiles } from './html.mjs';
import { absolutize } from '../../admin/relink.js';

const SKIP = /^(admin|static-ajax)\//;

export function buildAdminData(dir) {
	const pages = [];
	const seen = new Map(); // dataId -> Map(normalised html -> [page index])
	for (const file of htmlFiles(dir)) {
		const rel = path.relative(dir, file).split(path.sep).join('/');
		if (SKIP.test(rel) || !rel.endsWith('index.html')) continue;
		const raw = fs.readFileSync(file, 'utf8');
		const { document: doc } = parseHTML(raw);
		const p = rel.replace(/index\.html$/, '');
		const t = (doc.querySelector('title')?.textContent || p).replace(/\s*[–-]\s*ALMAJNA ADVISORS\s*$/i, '').trim();
		const i = pages.push({ p, t, l: p.startsWith('ar/') ? 'ar' : 'en' }) - 1;
		const base = '/' + p;
		const lang = pages[i].l;
		for (const w of doc.querySelectorAll('[data-element_type="widget"][data-id]')) {
			const id = w.getAttribute('data-id') + '@' + lang;
			const norm = absolutize(w.outerHTML, base);
			if (!seen.has(id)) seen.set(id, new Map());
			const variants = seen.get(id);
			if (!variants.has(norm)) variants.set(norm, []);
			const list = variants.get(norm);
			if (list[list.length - 1] !== i) list.push(i);
		}
	}
	// Only widgets whose markup is the same on every page of the language are
	// shared; a template widget showing each post's own title is per page.
	const widgets = {};
	for (const [id, variants] of seen) {
		if (variants.size === 1) {
			const list = [...variants.values()][0];
			if (list.length > 1) widgets[id] = list;
		}
	}
	const out = path.join(dir, 'admin', 'data');
	fs.mkdirSync(out, { recursive: true });
	fs.writeFileSync(path.join(out, 'pages.json'), JSON.stringify(pages));
	fs.writeFileSync(path.join(out, 'widgets.json'), JSON.stringify(widgets));
	return { pages: pages.length, shared: Object.keys(widgets).length };
}
