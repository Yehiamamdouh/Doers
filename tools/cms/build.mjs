// Cloudflare Pages build (`npm run build`): site/ -> dist/.
// Copies the site and the admin panel, applies shared-section edits, then writes what is generated from the
// pages: the search index and the admin panel's page and shared-section lists.
import fs from 'node:fs';
import path from 'node:path';
import { buildIndex } from './search-index.mjs';
import { buildAdminData } from './admin-data.mjs';
import { htmlFiles } from './html.mjs';
import { applySections, pageLang, SECTIONS_FILE } from '../../admin/sections.js';

const [src = 'site', out = 'dist'] = process.argv.slice(2);
fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(src, out, { recursive: true });
fs.cpSync('admin', path.join(out, 'admin'), { recursive: true });

// shared sections edited in the admin panel
if (fs.existsSync(SECTIONS_FILE)) {
	const sections = JSON.parse(fs.readFileSync(SECTIONS_FILE, 'utf8'));
	let n = 0;
	for (const f of htmlFiles(out)) {
		const raw = fs.readFileSync(f, 'utf8');
		const text = applySections(raw, sections, pageLang(path.relative(out, f).split(path.sep).join('/')));
		if (text !== raw) { fs.writeFileSync(f, text); n++; }
	}
	console.log('shared sections:', Object.keys(sections).length, 'applied to pages:', n);
}
console.log('search index entries:', buildIndex(out));
console.log('admin data:', buildAdminData(out));
