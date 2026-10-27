// Finds an Elementor element in raw page HTML by its data-id and replaces its
// markup, leaving every other byte of the file as it was.

const TOKEN = /<!--[\s\S]*?-->|<(script|style|template|textarea)\b[^>]*>[\s\S]*?<\/\1\s*>|<(\/?)([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*?(\/?)>/g;
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);

// [start, end) of every element with data-id="id" (outermost matches only).
export function findElements(raw, id) {
	const out = [];
	const needle = `data-id="${id}"`;
	let at = raw.indexOf(needle);
	while (at !== -1) {
		const start = raw.lastIndexOf('<', at);
		const tag = (raw.slice(start + 1).match(/^[a-zA-Z][a-zA-Z0-9-]*/) || [''])[0].toLowerCase();
		let depth = 0;
		let end = -1;
		TOKEN.lastIndex = start;
		let m;
		while ((m = TOKEN.exec(raw))) {
			if (!m[3] || m[3].toLowerCase() !== tag || VOID.has(tag) || m[4]) {
				if (m.index === start && (VOID.has(tag) || m[4])) { end = TOKEN.lastIndex; break; }
				continue;
			}
			depth += m[2] ? -1 : 1;
			if (depth === 0) { end = TOKEN.lastIndex; break; }
		}
		if (end === -1) throw new Error(`Could not find the end of element ${id}`);
		out.push([start, end]);
		at = raw.indexOf(needle, end);
	}
	return out;
}

export function replaceElement(raw, id, html) {
	const spans = findElements(raw, id);
	let text = raw;
	for (const [s, e] of spans.reverse()) text = text.slice(0, s) + html + text.slice(e);
	return { text, count: spans.length };
}
