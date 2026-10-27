// Talking to the admin API (functions/api/admin/*).

export async function api(path, opts = {}) {
	const res = await fetch('/api/admin/' + path, {
		...opts,
		headers: opts.body ? { 'Content-Type': 'application/json' } : {},
		credentials: 'same-origin',
	});
	if (res.status === 401) {
		location.reload(); // Cloudflare Access asks for the email code again
		throw new Error('signed out');
	}
	const type = res.headers.get('Content-Type') || '';
	const data = type.includes('json') ? await res.json() : await res.text();
	if (!res.ok) throw Object.assign(new Error(data.error || data || res.statusText), { status: res.status, data });
	return data;
}

// git's blob id, to tell the server which version of a file an edit is based on.
export async function gitSha(text) {
	const body = new TextEncoder().encode(text);
	const head = new TextEncoder().encode(`blob ${body.length}\0`);
	const all = new Uint8Array(head.length + body.length);
	all.set(head);
	all.set(body, head.length);
	const hash = await crypto.subtle.digest('SHA-1', all);
	return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
}

const cache = new Map();

// Repository copy of a file: { text, sha }.
export async function readFile(path, { fresh = false } = {}) {
	if (!fresh && cache.has(path)) return cache.get(path);
	const text = await api('file?path=' + encodeURIComponent(path));
	const entry = { text, sha: await gitSha(text) };
	cache.set(path, entry);
	return entry;
}

// files: [{ path, text } | { path, base64 } | { path, delete: true }]
// Text files read through readFile() are sent with the version they were read at.
export async function saveFiles(message, files) {
	const body = files.map(f => (cache.has(f.path) && !f.base64 ? { ...f, base: cache.get(f.path).sha } : f));
	const { sha } = await api('commit', { method: 'POST', body: JSON.stringify({ message, files: body }) });
	for (const f of files) {
		if (f.text !== undefined) cache.set(f.path, { text: f.text, sha: await gitSha(f.text) });
		if (f.delete) cache.delete(f.path);
	}
	return sha;
}

export function forget(path) {
	cache.delete(path);
}

export const pageFile = p => 'site/' + p + 'index.html';

let dataCache = {};
export async function siteData(name) {
	if (!dataCache[name]) dataCache[name] = fetch(`/admin/data/${name}.json`, { cache: 'no-store' }).then(r => r.json());
	return dataCache[name];
}
