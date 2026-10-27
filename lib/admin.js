// Shared checks for the admin endpoints.
import { GitHub } from './github.js';

// The admin panel may only change the website and its content data.
export function safePath(p) {
	return typeof p === 'string' && /^(site|content)\/[^\0]+$/.test(p) && !p.split('/').some(s => s === '..' || s === '' || s === '.');
}

export const json = (data, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });

export async function guard(fn) {
	try {
		return await fn();
	} catch (e) {
		return json({ error: e.message, stale: e.stale }, e.status || 500);
	}
}

export { GitHub };
