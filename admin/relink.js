// Rewrites the relative links inside a piece of page markup, so a section
// copied from one page works on a page at another folder depth.
// Used by the admin panel (browser) and the build (Node). No DOM needed.

const ATTR = /(\s(?:href|src|action|poster|data-url)=")([^"]*)(")/g;
const SRCSET = /(\ssrcset=")([^"]*)(")/g;
const CSSURL = /(url\(\s*(&quot;|["']?))([^)"'&]+)(\2\s*\))/g;
const ABSOLUTE = /^(?:[a-z][a-z0-9+.-]*:|\/|#|\{|\$)/i;

function resolve(base, url) {
	const u = new URL(url, 'http://x' + base);
	return u.pathname + u.search + u.hash;
}

function relative(fromDir, target) {
	const [p, rest = ''] = target.split(/(?=[?#])/);
	const from = fromDir.split('/').filter(Boolean);
	const to = p.split('/').filter(Boolean);
	const keepSlash = p.endsWith('/');
	let i = 0;
	while (i < from.length && i < to.length - (keepSlash ? 0 : 1) && from[i] === to[i]) i++;
	const out = '../'.repeat(from.length - i) + to.slice(i).join('/') + (keepSlash && to.length > i ? '/' : '');
	return (out || './') + rest;
}

function mapUrls(html, fn) {
	return html
		.replace(ATTR, (m, a, v, z) => (v && !ABSOLUTE.test(v) ? a + fn(v) + z : m))
		.replace(SRCSET, (m, a, v, z) => a + v.split(',').map(part => {
			const [u, ...d] = part.trim().split(/\s+/);
			return [u && !ABSOLUTE.test(u) ? fn(u) : u, ...d].join(' ');
		}).join(', ') + z)
		.replace(CSSURL, (m, a, q, v, z) => (!ABSOLUTE.test(v) ? a + fn(v) + z : m));
}

// Relative links -> root paths ("../wp-content/x.jpg" on /about-us/ -> "/wp-content/x.jpg").
export function absolutize(html, baseDir) {
	return mapUrls(html, v => resolve(baseDir, v));
}

// Relative links written for page fromDir -> relative links for page toDir.
export function relink(html, fromDir, toDir) {
	if (fromDir === toDir) return html;
	return mapUrls(html, v => relative(toDir, resolve(fromDir, v)));
}
