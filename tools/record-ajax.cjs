// Step 4a: record the live site's AJAX answers so the static copy can replay them.
// Covers the team member popups and the crypto listing (load more + filters).
// Usage: node record-ajax.cjs OUT_DIR   (needs Playwright with Chromium)
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const fs = require('fs');
const path = require('path');
const { key } = require('./ajax-key.cjs');

const SITE = 'https://almajnaadvisors.com';
const OUT = process.argv[2];
const enc = s => encodeURIComponent(s);
const listings = ['/crypto-currencies/', '/crypto-classification/non-compliant/', '/crypto-classification/compliant/',
	'/crypto-classification/suspicious/', '/ar/crypto-currencies/', `/ar/crypto-classification/${enc('غير-متوافق')}/`,
	`/ar/crypto-classification/${enc('متوافق')}/`, `/ar/crypto-classification/${enc('شبهة')}/`];
const teams = ['/team/', '/ar/ourteam-ar/'];

(async () => {
	fs.mkdirSync(OUT, { recursive: true });
	const seen = new Set();
	const b = await chromium.launch();
	const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } });
	ctx.on('response', async r => {
		const q = r.request();
		if (q.method() !== 'POST' || !/admin-ajax\.php|[?&]nocache=/.test(r.url())) return;
		const action = new URLSearchParams(q.postData() || '').get('action');
		if (!/^(jet_popup_get_content|jet_engine_ajax|jet_smart_filters)$/.test(action)) return;
		try {
			const body = await r.text();
			const k = key(q.postData());
			if (seen.has(k) || r.status() !== 200) return;
			seen.add(k);
			fs.writeFileSync(path.join(OUT, k + '.json'), body);
			// the request too, so the build can make answers for content added later
			fs.writeFileSync(path.join(OUT, k + '.request.txt'), q.postData());
			console.log('  recorded', k, action, body.length);
		} catch (e) {}
	});
	const settle = p => p.waitForLoadState('networkidle').then(() => p.waitForTimeout(1200));
	async function scrollAll(p) {
		let last = -1;
		for (let n = 0; n < 15; n++) {
			await p.evaluate(async () => {
				for (let y = 0; y < document.body.scrollHeight; y += 500) { scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); }
			});
			await p.waitForTimeout(1800);
			const c = await p.$$eval('.jet-listing-grid__item', e => e.length);
			if (c === last) return c;
			last = c;
		}
		return last;
	}
	for (const url of listings) {
		const p = await ctx.newPage();
		await p.goto(SITE + url, { waitUntil: 'networkidle' });
		console.log(url, 'items', await scrollAll(p));
		const filters = (await p.$$('.jet-radio-list__item')).length;
		await p.close();
		for (let i = 0; i < filters; i++) {
			const q = await ctx.newPage();
			await q.goto(SITE + url, { waitUntil: 'networkidle' });
			await (await q.$$('.jet-radio-list__item'))[i].click();
			await settle(q);
			console.log('  filter', i, 'items', await scrollAll(q));
			await q.close();
		}
	}
	for (const url of teams) {
		const p = await ctx.newPage();
		await p.goto(SITE + url, { waitUntil: 'networkidle' });
		const targets = await p.$$('[data-popup-instance]');
		for (const t of targets) {
			if (!(await t.isVisible())) continue;
			await t.scrollIntoViewIfNeeded();
			await t.click();
			await p.waitForTimeout(2500);
			const close = await p.$('.jet-popup--show-state .jet-popup__close-button');
			if (close) await close.click().catch(() => {});
			await p.waitForTimeout(800);
		}
		console.log(url, 'popups', targets.length);
		await p.close();
	}
	console.log('recorded responses:', seen.size);
	await b.close();
})();
