// Admin panel shell: who is signed in, the sections, and the save history.
import { api } from './api.js';
import { h, toast } from './ui.js';
import { PageEditor } from './editor.js';

const main = document.querySelector('main');
const who = document.getElementById('who');

const sections = {
	pages: { title: 'الصفحات', mount: el => new PageEditor(el) },
	history: { title: 'سجل التعديلات', mount: el => showHistory(el) },
};

async function showHistory(el) {
	el.replaceChildren(h('p', { class: 'hint' }, 'جاري التحميل…'));
	try {
		const list = await api('history');
		el.replaceChildren(h('div', { class: 'history' },
			h('h2', {}, 'آخر التعديلات'),
			h('p', { class: 'hint' }, 'كل حفظ بيتنشر على الموقع خلال دقيقة أو اتنين.'),
			h('table', {},
				h('thead', {}, h('tr', {}, h('th', {}, 'التاريخ'), h('th', {}, 'مين'), h('th', {}, 'التعديل'))),
				h('tbody', {}, list.map(c => h('tr', {},
					h('td', { dir: 'ltr' }, new Date(c.date).toLocaleString('ar-EG')),
					h('td', { dir: 'ltr' }, c.author),
					h('td', { dir: 'ltr' }, c.message.split('\n')[0])))))));
	} catch (e) {
		el.replaceChildren(h('p', { class: 'error' }, e.message));
	}
}

function show(name) {
	for (const b of document.querySelectorAll('nav button')) b.classList.toggle('on', b.dataset.s === name);
	const el = h('div', { class: 'section' });
	main.replaceChildren(el);
	sections[name].mount(el);
	window.history.replaceState(null, '', '#' + name);
}

document.querySelector('nav').replaceChildren(...Object.entries(sections).map(([k, s]) =>
	h('button', { 'data-s': k, onclick: () => show(k) }, s.title)));

api('me').then(({ email }) => { who.textContent = email; }).catch(e => toast(e.message, 'error'));
show(sections[location.hash.slice(1)] ? location.hash.slice(1) : 'pages');
