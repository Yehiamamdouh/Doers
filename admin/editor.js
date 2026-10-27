// Page editor: shows any page of the site, lets an editor click a section and
// change its texts, links and images, then saves the page as one commit.
//
// Edits are made on the page's source file from the repository (not on the
// live page, whose markup the animations change), and spliced back into the
// file by the section's Elementor data-id. Sections that are identical on
// several pages (header, footer) are updated on all of them.
import { readFile, saveFiles, pageFile, siteData } from './api.js';
import { replaceElement } from './splice.js';
import { absolutize } from './relink.js';
import { applySections, pageLang, SECTIONS_FILE } from './sections.js';
import { prepareImage } from './images.js';
import { h, toast, confirmBox, richEditor } from './ui.js';

const RICH = {
	'text-editor.default': '.elementor-widget-container',
	'wcf--text.default': '.wcf--text',
	'theme-post-content.default': '.elementor-widget-container',
};
const INLINE = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'BR', 'SPAN', 'SMALL', 'SUP', 'SUB', 'MARK']);
const SKIP = 'style, script, svg, noscript, template';

export class PageEditor {
	constructor(root) {
		this.root = root;
		this.page = null; // { p, t, l }
		this.source = null; // { text, sha } as read
		this.doc = null; // parsed source
		this.edits = new Map(); // dataId -> outerHTML after edit
		this.uploads = [];
		this.editMode = true;
		this.render();
	}

	render() {
		this.list = h('ul', { class: 'page-list' });
		this.filter = h('input', { type: 'search', placeholder: 'ابحث عن صفحة…', oninput: () => this.fillList() });
		this.lang = h('select', { onchange: () => this.fillList() }, h('option', { value: '' }, 'كل اللغات'), h('option', { value: 'ar' }, 'العربية'), h('option', { value: 'en' }, 'English'));
		this.frame = h('iframe', { class: 'preview', title: 'معاينة الصفحة' });
		this.title = h('strong', {}, 'اختار صفحة من القايمة');
		this.count = h('span', { class: 'badge' });
		this.saveBtn = h('button', { class: 'primary', disabled: true, onclick: () => this.save() }, 'حفظ ونشر');
		this.discardBtn = h('button', { disabled: true, onclick: () => this.discard() }, 'إلغاء التعديلات');
		this.modeBtn = h('button', { onclick: () => this.toggleMode() }, 'وضع التصفح');
		this.liveLink = h('a', { target: '_blank', rel: 'noopener', class: 'link' }, 'فتح الصفحة');
		this.panel = h('aside', { class: 'panel' }, h('p', { class: 'hint' }, 'دوس على أي جزء في الصفحة عشان تعدّله.'));
		this.root.replaceChildren(
			h('div', { class: 'editor' },
				h('aside', { class: 'pages' }, this.filter, this.lang, this.list),
				h('section', { class: 'stage' },
					h('div', { class: 'toolbar' }, this.title, this.count, h('span', { class: 'grow' }), this.liveLink, this.modeBtn, this.discardBtn, this.saveBtn),
					this.frame),
				this.panel));
		this.frame.addEventListener('load', () => this.wireFrame());
		siteData('pages').then(p => { this.pages = p; this.fillList(); });
	}

	fillList() {
		const q = this.filter.value.trim().toLowerCase();
		const l = this.lang.value;
		const items = (this.pages || []).filter(p => (!l || p.l === l) && (!q || (p.t + ' ' + p.p).toLowerCase().includes(q)));
		this.list.replaceChildren(...items.map(p => h('li', {},
			h('button', { class: this.page?.p === p.p ? 'on' : '', onclick: () => this.open(p) },
				h('span', {}, p.t), h('small', { dir: 'ltr' }, '/' + p.p)))));
	}

	async open(page) {
		if (this.edits.size && !(await confirmBox('فيه تعديلات مش محفوظة على الصفحة دي. تسيبها؟'))) return;
		this.page = page;
		this.edits.clear();
		this.uploads = [];
		this.updateButtons();
		this.fillList();
		this.title.textContent = page.t;
		this.liveLink.href = '/' + page.p;
		this.panel.replaceChildren(h('p', { class: 'hint' }, 'جاري تحميل الصفحة…'));
		try {
			this.source = await readFile(pageFile(page.p), { fresh: true });
		} catch (e) {
			this.panel.replaceChildren(h('p', { class: 'error' }, 'تعذّر تحميل الصفحة: ' + e.message));
			return;
		}
		this.sections = await this.loadSections();
		this.shown = applySections(this.source.text, this.sections, pageLang(page.p));
		this.doc = new DOMParser().parseFromString(this.shown, 'text/html');
		this.panel.replaceChildren(h('p', { class: 'hint' }, 'دوس على أي جزء في الصفحة عشان تعدّله.'));
		this.preview();
	}

	async loadSections() {
		try {
			return JSON.parse((await readFile(SECTIONS_FILE, { fresh: true })).text);
		} catch (e) {
			if (e.status === 404) return {};
			throw e;
		}
	}

	// The preview always shows the source with the pending edits applied.
	preview() {
		let text = this.shown;
		for (const [id, html] of this.edits) text = replaceElement(text, id, html).text;
		const base = `<base href="${location.origin}/${this.page.p}">`;
		this.frame.srcdoc = text.replace(/<head([^>]*)>/i, `<head$1>${base}`);
	}

	wireFrame() {
		const d = this.frame.contentDocument;
		if (!d || !this.page) return;
		const style = d.createElement('style');
		style.textContent = `
			body.almajna-edit [data-element_type="widget"]:hover { outline: 2px dashed #e0a100 !important; outline-offset: 2px; cursor: pointer; }
			body.almajna-edit .almajna-picked { outline: 3px solid #0b7d5c !important; outline-offset: 2px; }`;
		d.head.append(style);
		d.body.classList.toggle('almajna-edit', this.editMode);
		d.addEventListener('click', e => {
			if (!this.editMode) {
				const a = e.target.closest('a[href]');
				if (a && a.target !== '_blank') { e.preventDefault(); this.follow(a.href); }
				return;
			}
			const w = e.target.closest('[data-element_type="widget"][data-id]');
			e.preventDefault();
			e.stopPropagation();
			if (!w) return;
			d.querySelectorAll('.almajna-picked').forEach(x => x.classList.remove('almajna-picked'));
			w.classList.add('almajna-picked');
			this.pick(w.getAttribute('data-id'));
		}, true);
		d.addEventListener('submit', e => e.preventDefault(), true);
	}

	follow(href) {
		const u = new URL(href, location.href);
		if (u.origin !== location.origin) return;
		const p = u.pathname.replace(/^\//, '').replace(/index\.html$/, '');
		const page = (this.pages || []).find(x => x.p === p);
		if (page) this.open(page);
		else toast('الصفحة دي مش من صفحات الموقع اللي بتتعدّل من هنا.');
	}

	toggleMode() {
		this.editMode = !this.editMode;
		this.modeBtn.textContent = this.editMode ? 'وضع التصفح' : 'وضع التعديل';
		this.frame.contentDocument?.body.classList.toggle('almajna-edit', this.editMode);
		toast(this.editMode ? 'وضع التعديل: دوس على أي جزء عشان تعدّله.' : 'وضع التصفح: اللينكات بتفتح الصفحات عشان تختار.');
	}

	async pick(id) {
		const el = this.doc.querySelector(`[data-id="${id}"]`);
		if (!el) return;
		// work on a copy (of the pending edit, if any), so "Cancel" changes nothing
		let work = el.cloneNode(true);
		if (this.edits.has(id)) {
			const t = this.doc.createElement('template');
			t.innerHTML = this.edits.get(id);
			work = t.content.firstElementChild;
		}
		const fields = this.fields(work);
		const widgets = await siteData('widgets');
		const shared = (widgets[id + '@' + this.page.l] || []).length;
		const pendingUploads = [];
		const body = h('div', { class: 'fields' });
		for (const f of fields) body.append(this.fieldUI(f, pendingUploads));
		if (!fields.length) body.append(h('p', { class: 'hint' }, 'الجزء ده مفيهوش نصوص أو صور تتعدّل من هنا.'));
		this.panel.replaceChildren(
			h('h3', {}, this.label(work)),
			shared > 1 ? h('p', { class: 'note' }, `الجزء ده موجود بنفس الشكل في ${shared} صفحة، والتعديل هيتطبق عليهم كلهم.`) : '',
			body,
			fields.length ? h('div', { class: 'actions' },
				h('button', { class: 'primary', onclick: () => {
					const was = work.outerHTML;
					for (const f of fields) f.apply?.();
					if (work.outerHTML === was && !pendingUploads.length) { toast('مفيش تغيير.'); return; }
					this.edits.set(id, work.outerHTML);
					this.uploads.push(...pendingUploads);
					this.updateButtons();
					this.preview();
					toast('اتطبق في المعاينة. دوس "حفظ ونشر" عشان يتنشر.');
				} }, 'تطبيق'),
				h('button', { onclick: () => this.panel.replaceChildren(h('p', { class: 'hint' }, 'دوس على أي جزء في الصفحة عشان تعدّله.')) }, 'إلغاء')) : '');
	}

	label(w) {
		const t = (w.getAttribute('data-widget_type') || '').replace(/\.default$/, '').replace(/^wcf--/, '');
		const names = { heading: 'عنوان', title: 'عنوان', 'text-editor': 'نص', text: 'نص', image: 'صورة', button: 'زرار', 'icon-list': 'قايمة', 'icon-box': 'أيقونة ونص', 'image-box': 'صورة ونص', 'theme-post-content': 'محتوى المقال', 'nav-menu': 'القايمة', 'site-logo': 'اللوجو' };
		return names[t] || 'جزء من الصفحة';
	}

	// What can be edited in a section: rich text blocks, plain texts, images, links.
	fields(w) {
		const out = [];
		const type = w.getAttribute('data-widget_type') || '';
		const richSel = RICH[type];
		const rich = richSel ? w.querySelector(richSel) : null;
		if (rich) out.push({ kind: 'rich', el: rich, label: 'النص' });
		const inRich = el => rich && rich.contains(el);
		for (const el of w.querySelectorAll('*')) {
			if (el.closest(SKIP) || inRich(el)) continue;
			const own = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
			if (!own) continue;
			const kids = [...el.children];
			if (kids.some(k => !INLINE.has(k.tagName))) continue; // a block with structure inside
			if (el.parentElement && out.some(f => f.el === el.parentElement)) continue;
			out.push({ kind: kids.length ? 'inline' : 'text', el, label: el.closest('a') ? 'نص اللينك' : 'نص' });
		}
		for (const img of w.querySelectorAll('img')) if (!img.closest(SKIP)) out.push({ kind: 'image', el: img, label: 'صورة' });
		for (const a of w.querySelectorAll('a[href]')) {
			const href = a.getAttribute('href');
			if (!href || href.startsWith('#') || a.closest(SKIP)) continue;
			out.push({ kind: 'link', el: a, label: 'رابط: ' + (a.textContent.trim().slice(0, 40) || a.getAttribute('aria-label') || '') });
		}
		return out;
	}

	fieldUI(f, uploads) {
		if (f.kind === 'text') {
			const input = h('textarea', { rows: Math.min(6, Math.ceil(f.el.textContent.length / 40) + 1) });
			input.value = f.el.textContent.trim();
			const lead = f.el.textContent.match(/^\s*/)[0];
			const tail = f.el.textContent.match(/\s*$/)[0];
			f.apply = () => { if (input.value.trim() !== f.el.textContent.trim()) f.el.textContent = lead + input.value.trim() + tail; };
			return h('label', { class: 'field' }, h('span', {}, f.label), input);
		}
		if (f.kind === 'inline' || f.kind === 'rich') {
			const ed = richEditor(f.el.innerHTML, { block: f.kind === 'rich' });
			f.apply = () => { const v = ed.value(); if (v !== null) f.el.innerHTML = v; };
			return h('div', { class: 'field' }, h('span', {}, f.label), ed.node);
		}
		if (f.kind === 'link') {
			const input = h('input', { type: 'text', dir: 'ltr' });
			input.value = f.el.getAttribute('href');
			f.apply = () => { if (input.value.trim() && input.value.trim() !== f.el.getAttribute('href')) f.el.setAttribute('href', input.value.trim()); };
			return h('label', { class: 'field' }, h('span', {}, f.label), input);
		}
		if (f.kind === 'image') {
			const src = f.el.getAttribute('src') || '';
			const thumb = h('img', { class: 'thumb', src: new URL(src, location.origin + '/' + this.page.p).href, alt: '' });
			const alt = h('input', { type: 'text', placeholder: 'وصف الصورة (لمحركات البحث وقارئ الشاشة)' });
			alt.value = f.el.getAttribute('alt') || '';
			let chosen = null;
			const file = h('input', { type: 'file', accept: 'image/*', onchange: async () => {
				if (!file.files[0]) return;
				try {
					chosen = await prepareImage(file.files[0]);
					thumb.src = chosen.preview;
				} catch (e) { toast(e.message, 'error'); }
			} });
			f.apply = () => {
				if (alt.value !== (f.el.getAttribute('alt') || '')) f.el.setAttribute('alt', alt.value);
				if (!chosen) return;
				f.el.setAttribute('src', chosen.url);
				f.el.removeAttribute('srcset');
				f.el.removeAttribute('sizes');
				if (chosen.width) {
					if (f.el.hasAttribute('width')) f.el.setAttribute('width', chosen.width);
					if (f.el.hasAttribute('height')) f.el.setAttribute('height', chosen.height);
				}
				uploads.push({ path: chosen.path, base64: chosen.base64 });
			};
			return h('div', { class: 'field image' }, h('span', {}, f.label), thumb, h('label', { class: 'button' }, 'تغيير الصورة', file), alt);
		}
		return '';
	}

	updateButtons() {
		const n = this.edits.size;
		this.count.textContent = n ? `${n} تعديل مش محفوظ` : '';
		this.saveBtn.disabled = !n;
		this.discardBtn.disabled = !n;
	}

	async discard() {
		if (!(await confirmBox('تلغي كل التعديلات اللي مش محفوظة على الصفحة دي؟'))) return;
		this.edits.clear();
		this.uploads = [];
		this.updateButtons();
		this.preview();
	}

	async save() {
		this.saveBtn.disabled = true;
		const widgets = await siteData('widgets');
		const key = id => id + '@' + this.page.l;
		const shared = [...this.edits.keys()].filter(id => (widgets[key(id)] || []).length > 1);
		const own = [...this.edits.keys()].filter(id => !shared.includes(id));
		try {
			toast('بيتحفظ…');
			const files = [];
			const path = pageFile(this.page.p);
			if (own.length) {
				let text = this.source.text;
				for (const id of own) text = replaceElement(text, id, this.edits.get(id)).text;
				files.push({ path, text });
			}
			if (shared.length) {
				// read again: another editor may have saved other sections meanwhile
				let sections = {};
				try { sections = JSON.parse((await readFile(SECTIONS_FILE, { fresh: true })).text); } catch (e) { if (e.status !== 404) throw e; }
				for (const id of shared) sections[key(id)] = absolutize(this.edits.get(id), '/' + this.page.p);
				files.push({ path: SECTIONS_FILE, text: JSON.stringify(sections, null, 1) + '\n' });
			}
			files.push(...this.uploads);
			const pagesTouched = new Set([this.page.p, ...shared.flatMap(id => widgets[key(id)].map(i => this.pages[i].p))]).size;
			await saveFiles(`Edit page /${this.page.p}` + (shared.length ? ` (shared section on ${pagesTouched} pages)` : ''), files);
			this.edits.clear();
			this.uploads = [];
			await this.open(this.page);
			toast(shared.length ? `اتحفظ على ${pagesTouched} صفحة. هيظهر على الموقع خلال دقيقة أو اتنين.` : 'اتحفظ. التعديل هيظهر على الموقع خلال دقيقة أو اتنين.', 'ok');
		} catch (e) {
			this.saveBtn.disabled = false;
			if (e.status === 409) toast('حد تاني عدّل نفس الملف بعد ما فتحته. افتح الصفحة تاني وكرّر التعديل.', 'error');
			else toast('الحفظ ما نجحش: ' + e.message, 'error');
		}
	}
}
