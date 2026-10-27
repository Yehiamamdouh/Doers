// Minimal GitHub API client for the admin panel: read files and write many
// files as one commit. Cloudflare Pages builds and deploys every commit.
//
// Environment: GITHUB_TOKEN (fine-grained, Contents read/write on the repo),
// GITHUB_REPO ("owner/name"), GITHUB_BRANCH (default "main").

export class GitHub {
	constructor(env) {
		if (!env.GITHUB_TOKEN || !env.GITHUB_REPO) throw new Error('GITHUB_TOKEN / GITHUB_REPO are not set.');
		this.repo = env.GITHUB_REPO;
		this.branch = env.GITHUB_BRANCH || 'main';
		this.base = env.GITHUB_API || 'https://api.github.com'; // overridden only for local tests
		this.headers = {
			Authorization: `Bearer ${env.GITHUB_TOKEN}`,
			Accept: 'application/vnd.github+json',
			'X-GitHub-Api-Version': '2022-11-28',
			'User-Agent': 'almajna-admin',
		};
	}

	async api(path, init = {}) {
		const go = () => fetch(`${this.base}/repos/${this.repo}${path}`, {
			...init,
			headers: { ...this.headers, ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
		});
		// reads are retried once on a dropped connection
		const res = init.method && init.method !== 'GET' ? await go() : await go().catch(go);
		if (!res.ok) throw new Error(`GitHub ${init.method || 'GET'} ${path}: ${res.status} ${(await res.text()).slice(0, 300)}`);
		return res.status === 204 ? null : res.json();
	}

	// File contents at the tip of the branch, or null if it does not exist.
	async read(path, { binary = false } = {}) {
		const res = await fetch(`${this.base}/repos/${this.repo}/contents/${encodePath(path)}?ref=${this.branch}`, {
			headers: { ...this.headers, Accept: 'application/vnd.github.raw' },
		});
		if (res.status === 404) return null;
		if (!res.ok) throw new Error(`GitHub read ${path}: ${res.status}`);
		return binary ? new Uint8Array(await res.arrayBuffer()) : await res.text();
	}

	async head() {
		const ref = await this.api(`/git/ref/heads/${this.branch}`);
		return ref.object.sha;
	}

	// files: [{ path, text, base? } | { path, base64 } | { path, delete: true, base? }]
	// `base` is the git blob sha the editor started from; if the file changed
	// since (another editor saved), nothing is written and a Conflict is thrown.
	// Text goes inline in the tree request, so one save costs a handful of API
	// calls however many pages it touches (Workers limit subrequests).
	async commit(message, files, author) {
		const parent = await this.head();
		const { tree: { sha: baseTree } } = await this.api(`/git/commits/${parent}`);
		if (files.some(f => f.base !== undefined)) {
			const { tree: all } = await this.api(`/git/trees/${baseTree}?recursive=1`);
			const now = new Map(all.map(e => [e.path, e.sha]));
			const stale = files.filter(f => f.base !== undefined && (now.get(f.path) || null) !== f.base).map(f => f.path);
			if (stale.length) throw Object.assign(new Error('Changed by someone else since you opened it: ' + stale.slice(0, 5).join(', ')), { status: 409, stale });
		}
		const tree = [];
		for (const f of files) {
			if (f.delete) tree.push({ path: f.path, mode: '100644', type: 'blob', sha: null });
			else if (f.base64 !== undefined) {
				const blob = await this.api('/git/blobs', { method: 'POST', body: JSON.stringify({ content: f.base64, encoding: 'base64' }) });
				tree.push({ path: f.path, mode: '100644', type: 'blob', sha: blob.sha });
			} else tree.push({ path: f.path, mode: '100644', type: 'blob', content: f.text });
		}
		const newTree = await this.api('/git/trees', { method: 'POST', body: JSON.stringify({ base_tree: baseTree, tree }) });
		const commit = await this.api('/git/commits', {
			method: 'POST',
			body: JSON.stringify({
				message,
				tree: newTree.sha,
				parents: [parent],
				...(author ? { author: { name: author, email: author, date: new Date().toISOString() } } : {}),
			}),
		});
		await this.api(`/git/refs/heads/${this.branch}`, { method: 'PATCH', body: JSON.stringify({ sha: commit.sha }) });
		return commit.sha;
	}

	async recentCommits(n = 10) {
		const list = await this.api(`/commits?sha=${this.branch}&per_page=${n}`);
		return list.map(c => ({ sha: c.sha, message: c.commit.message, author: c.commit.author.name, date: c.commit.author.date }));
	}
}

const encodePath = p => p.split('/').map(encodeURIComponent).join('/');
