// GET /api/admin/file?path=site/about-us/index.html -> the file as it is in the
// repository now (newer than the deployed site while a deploy is running).
import { GitHub, guard, json, safePath } from '../../../lib/admin.js';

export const onRequestGet = ({ request, env }) => guard(async () => {
	const path = new URL(request.url).searchParams.get('path');
	if (!safePath(path)) return json({ error: 'bad path' }, 400);
	const text = await new GitHub(env).read(path);
	if (text === null) return json({ error: 'not found' }, 404);
	return new Response(text, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
});
