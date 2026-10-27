// Every /api/admin/* request must carry a valid Cloudflare Access login.
// Access sits in front of /admin and /api/admin and adds a signed JWT
// (Cf-Access-Jwt-Assertion); it is checked here too, so a mistake in the
// Access settings cannot open the admin API.
//
// Environment: ACCESS_TEAM_DOMAIN (e.g. almajna.cloudflareaccess.com), ACCESS_AUD.

let keys = null;
let keysAt = 0;

async function accessKeys(team) {
	if (keys && Date.now() - keysAt < 3600e3) return keys;
	const res = await fetch(`https://${team}/cdn-cgi/access/certs`);
	if (!res.ok) throw new Error('could not load Access keys');
	const { keys: jwks } = await res.json();
	keys = {};
	for (const k of jwks) {
		keys[k.kid] = await crypto.subtle.importKey('jwk', k, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
	}
	keysAt = Date.now();
	return keys;
}

const b64url = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), c => c.charCodeAt(0));

async function verify(token, env) {
	const [h, p, sig] = token.split('.');
	const header = JSON.parse(new TextDecoder().decode(b64url(h)));
	const payload = JSON.parse(new TextDecoder().decode(b64url(p)));
	const key = (await accessKeys(env.ACCESS_TEAM_DOMAIN))[header.kid];
	if (!key) return null;
	const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64url(sig), new TextEncoder().encode(`${h}.${p}`));
	const aud = [].concat(payload.aud || []);
	if (!ok || !aud.includes(env.ACCESS_AUD) || payload.exp * 1000 < Date.now()) return null;
	return payload.email || null;
}

export async function onRequest(ctx) {
	const { request, env } = ctx;
	// Local testing only (wrangler pages dev): never honoured on a real hostname.
	if (env.INSECURE_DEV_LOGIN_EMAIL && ['localhost', '127.0.0.1'].includes(new URL(request.url).hostname)) {
		ctx.data.email = env.INSECURE_DEV_LOGIN_EMAIL;
		return ctx.next();
	}
	if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) {
		return Response.json({ error: 'Admin login is not configured (ACCESS_TEAM_DOMAIN / ACCESS_AUD).' }, { status: 503 });
	}
	const token = request.headers.get('Cf-Access-Jwt-Assertion') || (request.headers.get('Cookie') || '').match(/CF_Authorization=([^;]+)/)?.[1];
	let email = null;
	try {
		if (token) email = await verify(token, env);
	} catch (e) {
		return Response.json({ error: e.message }, { status: 503 });
	}
	if (!email) return Response.json({ error: 'Not signed in.' }, { status: 401 });
	ctx.data.email = email;
	return ctx.next();
}
