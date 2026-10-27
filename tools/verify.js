// Checks the static copy in a real browser and compares it with the live site.
// Usage: node verify.js LOCAL_BASE_URL SITE_DIR [LIVE_BASE_URL]
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const fs = require('fs');
const path = require('path');

const [LOCAL, SITE_DIR, LIVE = 'https://almajnaadvisors.com'] = process.argv.slice(2);
const results = [];
const report = (ok, what, detail = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? '  ' + detail : ''}`); };

function pages(dir, base = '') {
	let out = [];
	for (const f of fs.readdirSync(path.join(dir, base), { withFileTypes: true })) {
		const rel = base ? `${base}/${f.name}` : f.name;
		if (f.isDirectory()) { if (!/^(wp-content|wp-includes|fonts\.|static-ajax)/.test(rel)) out = out.concat(pages(dir, rel)); }
		else if (f.name.endsWith('.html')) out.push(rel);
	}
	return out;
}

async function scrollAll(p) {
	let last = -1;
	for (let n = 0; n < 15; n++) {
		await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { scrollTo(0, y); await new Promise(r => setTimeout(r, 100)); } });
		await p.waitForTimeout(1500);
		const c = await p.$$eval('.jet-listing-grid__item', e => e.length);
		if (c === last) return c;
		last = c;
	}
	return last;
}

(async () => {
	const b = await chromium.launch();

	// 1. every page loads with no missing local file and no script error
	{
		const list = pages(SITE_DIR);
		const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } });
		const bad = {}, errs = {};
		let i = 0;
		const worker = async () => {
			while (i < list.length) {
				const pg = list[i++];
				const p = await ctx.newPage();
				p.on('response', r => { if (r.url().startsWith(LOCAL) && r.status() >= 400 && !r.url().endsWith(pg)) (bad[r.url()] ||= pg); });
				p.on('requestfailed', r => { if (r.url().startsWith(LOCAL)) (bad[r.url()] ||= pg); });
				p.on('console', m => { if (m.type() === 'error' && /MIME|refused to (execute|apply)/i.test(m.text())) (errs[m.text().slice(0, 120)] ||= pg); });
				p.on('pageerror', e => { if (!/^jet-popup\//.test(pg)) (errs[e.message.slice(0, 120)] ||= pg); });
				await p.goto(`${LOCAL}/${encodeURI(pg)}`, { waitUntil: 'networkidle', timeout: 60000 }).catch(e => (bad['open ' + pg] = e.message.slice(0, 80)));
				await p.close();
			}
		};
		await Promise.all([1, 2, 3, 4, 5, 6].map(worker));
		report(Object.keys(bad).length === 0, `all ${list.length} pages load every file`, Object.entries(bad).slice(0, 5).map(x => x.join(' on ')).join('; '));
		report(Object.keys(errs).length === 0, 'no script errors', Object.entries(errs).slice(0, 5).map(x => x.join(' on ')).join('; '));
		await ctx.close();
	}

	// 2. menus: desktop dropdowns and the mobile drill-down menu
	for (const home of ['/', '/ar/home-ar/']) {
		const p = await b.newPage({ viewport: { width: 1366, height: 900 } });
		await p.goto(LOCAL + home, { waitUntil: 'networkidle' });
		for (const li of await p.$$('.wcf__nav-menu .wcf-nav-menu-nav > li.menu-item-has-children')) {
			const name = await li.$eval('a', a => a.textContent.trim());
			await li.hover();
			await p.waitForTimeout(600);
			const [vis, total] = await li.$$eval('.sub-menu a', as => [as.filter(a => { const s = getComputedStyle(a.closest('.sub-menu')); return a.getBoundingClientRect().height > 0 && s.visibility !== 'hidden' && +s.opacity > 0.5; }).length, as.length]);
			report(vis === total && total > 0, `desktop menu ${home} "${name}" opens`, `${vis}/${total}`);
			await p.mouse.move(1300, 850);
			await p.waitForTimeout(400);
		}
		for (const a of await p.$$eval('.wcf__nav-menu a[href]', as => as.map(a => a.href).filter(h => !h.includes('#')))) {
			const r = await p.request.get(a);
			if (r.status() !== 200) report(false, `menu link ${a}`, String(r.status()));
		}
		await p.close();

		const m = await b.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
		await m.goto(LOCAL + home, { waitUntil: 'networkidle' });
		await (await m.$('.wcf-menu-hamburger')).tap();
		await m.waitForTimeout(900);
		const n = (await m.$$('.wcf-nav-menu-container li.menu-item-has-children')).length;
		for (let i = 0; i < n; i++) {
			const li = (await m.$$('.wcf-nav-menu-container li.menu-item-has-children'))[i];
			const name = await li.$eval('a', a => a.textContent.trim());
			await (await li.$('.wcf-submenu-indicator')).tap({ timeout: 5000 }).catch(() => {});
			await m.waitForTimeout(800);
			const vis = await li.$$eval(':scope > .sub-menu a', as => as.filter(a => { const r = a.getBoundingClientRect(); return r.height > 0 && r.x >= 0 && r.x < 390; }).length);
			report(vis > 1, `mobile menu ${home} "${name}" opens`, `${vis} links`);
			for (const bk of await m.$$('.wcf-nav-menu-container [class*=back]')) if (await bk.isVisible()) { await bk.tap().catch(() => {}); break; }
			await m.waitForTimeout(800);
		}
		await m.close();
	}

	// 3. team member popups show the bio
	for (const team of ['/team/', '/ar/ourteam-ar/']) {
		const p = await b.newPage({ viewport: { width: 1366, height: 900 } });
		await p.goto(LOCAL + team, { waitUntil: 'networkidle' });
		const targets = await p.$$('[data-popup-instance]');
		let i = 0;
		for (const t of targets) {
			if (!(await t.isVisible())) continue;
			i++;
			await t.scrollIntoViewIfNeeded();
			await t.click();
			await p.waitForTimeout(2500);
			const text = await p.$eval('.jet-popup--show-state', e => e.innerText.trim()).catch(() => '');
			report(text.length > 80, `team popup ${team} #${i}`, text.split('\n').filter(Boolean)[1] || '(empty)');
			const close = await p.$('.jet-popup--show-state .jet-popup__close-button');
			if (close) await close.click().catch(() => {});
			await p.waitForTimeout(800);
		}
		await p.close();
	}

	// 4. crypto listing: same number of items as live, with each filter
	for (const url of ['/crypto-currencies/', '/ar/crypto-currencies/']) {
		const count = async (base, filter) => {
			const p = await b.newPage({ viewport: { width: 1366, height: 900 } });
			await p.goto(base + url, { waitUntil: 'networkidle' });
			if (filter !== null) {
				await (await p.$$('.jet-radio-list__item'))[filter].click();
				await p.waitForLoadState('networkidle');
				await p.waitForTimeout(1500);
			}
			const c = await scrollAll(p);
			const names = await p.$$eval('.jet-listing-grid__item', e => e.map(x => x.innerText.trim().split('\n')[0]).sort().join(','));
			await p.close();
			return [c, names];
		};
		for (const f of [null, 0, 1, 2, 3]) {
			const [lc, ln] = await count(LOCAL, f);
			const [rc, rn] = await count(LIVE, f);
			report(lc === rc && ln === rn, `crypto ${url} filter ${f === null ? 'none' : f}`, `local ${lc} / live ${rc}`);
		}
	}

	// 5. unknown URL shows the site's 404 page
	{
		const p = await b.newPage();
		const r = await p.goto(LOCAL + '/no-such-page/at/all/', { waitUntil: 'networkidle' });
		const ok = r.status() === 404 && (await p.title()).includes('Page not found');
		report(ok, '404 page', await p.title());
		await p.close();
	}

	await b.close();
	const failed = results.filter(x => !x).length;
	console.log(`\n${results.length - failed} passed, ${failed} failed`);
	process.exit(failed ? 1 : 0);
})();
