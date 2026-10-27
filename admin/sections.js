// Shared sections (content/sections.json): edits to a section that appears the
// same on many pages of one language (header, footer...) are stored once, keyed
// "dataId@en" / "dataId@ar", with root-relative links. The build writes them
// into every page of that language; the admin panel applies them when it opens a page.
import { replaceElement } from './splice.js';

export const SECTIONS_FILE = 'content/sections.json';

export const pageLang = pagePath => (/^\/?ar\//.test(pagePath) ? 'ar' : 'en');

export function applySections(text, sections, lang) {
	for (const [key, html] of Object.entries(sections || {})) {
		const [id, l] = key.split('@');
		if (l === lang && text.includes(`data-id="${id}"`)) text = replaceElement(text, id, html).text;
	}
	return text;
}
