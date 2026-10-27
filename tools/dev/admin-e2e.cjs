// End-to-end test of the admin page editor against a local stack:
//   tools/dev/mock-github.py REPO 9100   (a git repo standing in for GitHub)
//   wrangler pages dev dist --binding GITHUB_API=http://127.0.0.1:9100 ... (see tools/dev/README.md)
// Usage: node tools/dev/admin-e2e.cjs BASE_URL REPO_DIR IMAGE_FILE
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const { execSync } = require('child_process');

const [BASE, REPO, IMAGE] = process.argv.slice(2);
const STAMP = Date.now().toString(36); // so the test can run again on the same repo
const git = cmd => execSync(`git -C ${REPO} ${cmd}`).toString();
let failed = 0;
const check = (ok, what, detail = '') => { if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? '  ' + detail : ''}`); };

(async () => {
	const b = await chromium.launch();
	const p = await b.newPage({ viewport: { width: 1500, height: 950 } });
	const errors = [];
	p.on('pageerror', e => errors.push(e.message));

	const open = async (search, title) => {
		await p.fill('.pages input[type=search]', search);
		await p.click(`.page-list button:has-text("${title}")`);
		await p.waitForFunction(() => document.querySelector('iframe.preview')?.contentDocument?.querySelector('[data-element_type="widget"]'), null, { timeout: 30000 });
		await p.waitForTimeout(1500);
		return p.frames().find(f => f !== p.mainFrame());
	};
	// click inside the preview the way an editor does (fixed bars can cover elements)
	const pickIn = (frame, selector, index = 0) => frame.evaluate(([s, i]) => {
		const el = document.querySelectorAll(s)[i];
		el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
		return el.closest('[data-element_type="widget"]').dataset.id;
	}, [selector, index]);
	const apply = async () => { await p.click('.panel .actions button.primary'); await p.waitForTimeout(2500); };
	const save = async () => {
		await p.click('.toolbar button.primary');
		await p.waitForSelector('.toast.ok, .toast.error', { timeout: 120000 });
		return p.textContent('.toast.ok, .toast.error');
	};

	await p.goto(BASE + '/admin/', { waitUntil: 'networkidle' });
	check((await p.textContent('#who')).includes('@'), 'signed-in editor shown', await p.textContent('#who'));
	check((await p.$$eval('.page-list li', e => e.length)) > 100, 'page list loaded');

	// 1. a heading on one page
	let frame = await open('about', 'About Us');
	const head0 = git('rev-parse HEAD').trim();
	await pickIn(frame, '[data-widget_type="wcf--title.default"] .wcf--title', 2);
	await p.waitForSelector('.panel .fields textarea');
	await p.fill('.panel .fields textarea', 'Heading Edited ' + STAMP);
	await apply();
	check((await frame.evaluate(() => document.body.innerText)).includes('Heading Edited ' + STAMP) || (await p.frames()[1].evaluate(() => document.body.innerText)).includes('Heading Edited ' + STAMP), 'preview shows the edit');
	let msg = await save();
	check(/اتحفظ/.test(msg), 'saved heading', msg);
	const diff1 = git(`diff --stat ${head0} HEAD`);
	check(/site\/about-us\/index.html \| 2 \+-/.test(diff1), 'commit changes exactly one line of about-us', diff1.trim().split('\n').pop());

	// 2. the footer email (same on every page) -> content/sections.json
	frame = await open('about', 'About Us');
	const head1 = git('rev-parse HEAD').trim();
	const id = await frame.evaluate(() => {
		const a = [...document.querySelectorAll('a')].find(x => /@almajna\.com/.test(x.textContent) && x.closest('[data-element_type="widget"]'));
		a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
		return a.closest('[data-element_type="widget"]').dataset.id;
	});
	await p.waitForSelector('.panel .fields');
	check(/صفحة/.test(await p.textContent('.panel .note').catch(() => '')), 'footer section reported as shared', (await p.textContent('.panel .note').catch(() => '')).trim());
	const areas = p.locator('.panel .fields textarea');
	for (let i = 0; i < await areas.count(); i++) {
		const v = await areas.nth(i).inputValue();
		if (/@almajna\.com/.test(v)) await areas.nth(i).fill(v.replace(/\S+@almajna\.com/, `test-${STAMP}@almajna.com`));
	}
	await apply();
	msg = await save();
	check(/اتحفظ على \d+ صفحة/.test(msg), 'saved shared section', msg);
	const diff2 = git(`diff --name-only ${head1} HEAD`).trim();
	check(diff2 === 'content/sections.json', 'only content/sections.json changed', diff2);
	const sections = JSON.parse(git('show HEAD:content/sections.json'));
	check(sections[id + '@en'] && sections[id + '@en'].includes(`test-${STAMP}@almajna.com`) && !/\.\.\//.test(sections[id + '@en']), 'section stored with root-relative links');

	// 3. an image on the home page
	frame = await open('islamic finance consultancy', 'ALMAJNA ADVISORS');
	const head2 = git('rev-parse HEAD').trim();
	const imgIndex = await frame.evaluate(() => [...document.querySelectorAll('[data-widget_type$="image.default"] img')].findIndex(i => /uploads\/20/.test(i.getAttribute('src'))));
	check(imgIndex >= 0, 'home page has an image widget');
	await pickIn(frame, '[data-widget_type$="image.default"] img', imgIndex);
	await p.waitForSelector('.panel .field.image');
	await p.setInputFiles('.panel .field.image input[type=file]', IMAGE);
	await p.waitForTimeout(1000);
	await apply();
	msg = await save();
	check(/اتحفظ/.test(msg), 'saved image', msg);
	const files3 = git(`diff --name-only ${head2} HEAD`).trim().split('\n');
	check(files3.some(f => /^site\/wp-content\/uploads\/cms\/\d{4}\/\d{2}\/.+\.(jpg|webp)$/.test(f)) && files3.some(f => /^site\/(ar\/home-ar\/)?index\.html$/.test(f)), 'image file added and page updated', files3.join(', '));

	check(errors.length === 0, 'no script errors in the admin panel', errors.slice(0, 3).join(' | '));
	await b.close();
	console.log(failed ? `\n${failed} failed` : '\nall passed');
	process.exit(failed ? 1 : 0);
})();
