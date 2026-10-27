// Small helpers shared by the build scripts.
import fs from 'node:fs';
import path from 'node:path';
import { parseHTML } from 'linkedom';

export function readDoc(file) {
	return parseHTML(fs.readFileSync(file, 'utf8')).document;
}

export function writeDoc(file, doc) {
	fs.mkdirSync(path.dirname(file), { recursive: true });
	fs.writeFileSync(file, '<!DOCTYPE html>\n' + doc.documentElement.outerHTML);
}

// Every .html file under dir, skipping asset folders.
export function htmlFiles(dir, base = dir) {
	const out = [];
	for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
		const p = path.join(dir, e.name);
		if (e.isDirectory()) {
			if (!/^(wp-content|wp-includes|fonts\.googleapis\.com|fonts\.gstatic\.com|static-ajax|node_modules)$/.test(e.name) || dir !== base) out.push(...htmlFiles(p, base));
		} else if (e.name.endsWith('.html')) out.push(p);
	}
	return out;
}
