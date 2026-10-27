// POST /api/admin/commit  { message, files: [{ path, text } | { path, base64 } | { path, delete: true }] }
// Saves all files as one commit; Cloudflare Pages then rebuilds the site.
import { GitHub, guard, json, safePath } from '../../../lib/admin.js';

const MAX_FILES = 400;
const MAX_BYTES = 20 * 1024 * 1024;

export const onRequestPost = ({ request, env, data }) => guard(async () => {
	const body = await request.json();
	const files = Array.isArray(body.files) ? body.files : [];
	if (!files.length || files.length > MAX_FILES) return json({ error: 'nothing to save' }, 400);
	let size = 0;
	for (const f of files) {
		if (!safePath(f.path)) return json({ error: `not allowed: ${f.path}` }, 400);
		size += (f.text || f.base64 || '').length;
	}
	if (size > MAX_BYTES) return json({ error: 'too large' }, 413);
	const message = `${String(body.message || 'Update from admin panel').slice(0, 200)}\n\nBy ${data.email} via the admin panel.`;
	const sha = await new GitHub(env).commit(message, files, data.email);
	return json({ sha });
});
