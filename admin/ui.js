// Tiny UI helpers for the admin panel (no framework).

export function h(tag, attrs = {}, ...children) {
	const el = document.createElement(tag);
	for (const [k, v] of Object.entries(attrs || {})) {
		if (v === false || v === null || v === undefined) continue;
		if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
		else if (k === 'class') el.className = v;
		else if (k in el && typeof v !== 'string') el[k] = v;
		else el.setAttribute(k, v === true ? '' : v);
	}
	for (const c of children.flat()) if (c !== '' && c !== null && c !== undefined) el.append(c);
	return el;
}

let toastBox;
export function toast(text, kind = '') {
	if (!toastBox) document.body.append(toastBox = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' }));
	const t = h('div', { class: 'toast ' + kind }, text);
	toastBox.append(t);
	setTimeout(() => t.remove(), kind === 'error' ? 9000 : 4500);
}

export function confirmBox(text) {
	return new Promise(done => {
		const d = h('dialog', { class: 'confirm' },
			h('p', {}, text),
			h('div', { class: 'actions' },
				h('button', { class: 'primary', onclick: () => { d.close(); d.remove(); done(true); } }, 'أيوه'),
				h('button', { onclick: () => { d.close(); d.remove(); done(false); } }, 'لا')));
		document.body.append(d);
		d.showModal();
	});
}

// A small formatted-text editor. block=true allows paragraphs, headings and lists.
// value() returns clean HTML, or null if nothing changed.
export function richEditor(html, { block = false } = {}) {
	const area = h('div', { class: 'rich', contenteditable: 'true', dir: 'auto' });
	area.innerHTML = html;
	const start = area.innerHTML;
	const cmd = (c, v) => () => { area.focus(); document.execCommand(c, false, v); };
	const tools = [
		h('button', { type: 'button', title: 'عريض', onclick: cmd('bold') }, h('b', {}, 'B')),
		h('button', { type: 'button', title: 'مائل', onclick: cmd('italic') }, h('i', {}, 'I')),
		h('button', { type: 'button', title: 'لينك', onclick: () => {
			const url = prompt('عنوان اللينك (https://…)');
			if (url) cmd('createLink', url)();
		} }, '🔗'),
		h('button', { type: 'button', title: 'شيل اللينك', onclick: cmd('unlink') }, '⛓️‍💥'),
	];
	if (block) tools.push(
		h('button', { type: 'button', title: 'عنوان فرعي', onclick: cmd('formatBlock', 'h3') }, 'H'),
		h('button', { type: 'button', title: 'فقرة', onclick: cmd('formatBlock', 'p') }, '¶'),
		h('button', { type: 'button', title: 'قايمة نقط', onclick: cmd('insertUnorderedList') }, '•'),
		h('button', { type: 'button', title: 'قايمة أرقام', onclick: cmd('insertOrderedList') }, '1.'),
		h('button', { type: 'button', title: 'شيل التنسيق', onclick: cmd('removeFormat') }, '⌫'));
	area.addEventListener('paste', e => {
		// paste as plain text: Word and web pages bring styles that break the design
		e.preventDefault();
		document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
	});
	return {
		node: h('div', { class: 'rich-wrap' }, h('div', { class: 'rich-tools' }, tools), area),
		value: () => (area.innerHTML === start ? null : clean(area.innerHTML, block)),
	};
}

const ALLOWED = new Set(['P', 'BR', 'B', 'STRONG', 'I', 'EM', 'U', 'A', 'UL', 'OL', 'LI', 'H2', 'H3', 'H4', 'SPAN', 'BLOCKQUOTE', 'SUP', 'SUB', 'MARK']);

function clean(html, block) {
	const t = document.createElement('template');
	t.innerHTML = html;
	const walk = node => {
		for (const el of [...node.children]) {
			walk(el);
			if (!ALLOWED.has(el.tagName) || (!block && /^(P|UL|OL|LI|H2|H3|H4|BLOCKQUOTE)$/.test(el.tagName))) {
				el.replaceWith(...el.childNodes);
				continue;
			}
			for (const a of [...el.attributes]) {
				const keep = (el.tagName === 'A' && ['href', 'target', 'rel'].includes(a.name)) || ['class', 'style', 'dir', 'lang', 'id'].includes(a.name);
				if (!keep) el.removeAttribute(a.name);
			}
			if (el.tagName === 'A' && /^\s*javascript:/i.test(el.getAttribute('href') || '')) el.removeAttribute('href');
		}
	};
	walk(t.content);
	return t.innerHTML;
}
