/* Site search for the static copy: fills the search results page from
   /search-index.json using the page's own result card markup. */
(function () {
	var params = new URLSearchParams(location.search);
	var q = (params.get('s') || '').trim();
	var ar = /^\/ar\//.test(location.pathname);
	var card = document.getElementById('almajna-search-card');
	var none = document.getElementById('almajna-search-none');
	var list = ar ? document.querySelector('.default-blog__item-content') : document.querySelector('.elementor-widget-wcf--posts .wcf-posts');
	if (!card || !list) return;

	document.title = (ar ? 'نتائج البحث عن “' : 'Search Results for “') + q + '” – ALMAJNA ADVISORS';
	var heading = document.querySelector('h1.default-search-title span');
	if (heading) heading.textContent = q;
	document.querySelectorAll('input[name="s"]').forEach(function (i) { i.value = q; });
	// The language switch keeps the search.
	document.querySelectorAll('a[href*="?s="]').forEach(function (a) {
		a.href = (ar ? '/search/' : '/ar/search/') + '?s=' + encodeURIComponent(q);
	});

	// Arabic: ignore diacritics and the usual spelling variants of alef, ya and ta marbuta.
	function norm(s) {
		return String(s).toLowerCase()
			.replace(/[ً-ٰٟـ]/g, '')
			.replace(/[إأآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
			.replace(/[“”"'’‘]/g, '');
	}
	var LABELS = {
		en: { service: 'Services', team: 'Our Team', project: 'Projects', crypto: 'Crypto Reports', page: 'Almajna Advisors' },
		ar: { service: 'خدماتنا', team: 'فريق المجنى', project: 'المشاريع', crypto: 'تقييم الأصول الرقمية', page: 'المجنى للاستشارات' },
	};
	var ORDER = { post: 0, service: 1, project: 2, team: 3, page: 4, crypto: 5 };

	function showNone() {
		if (ar) list.innerHTML = none.innerHTML;
		else list.closest('.elementor-widget-wcf--posts').replaceWith(none.content.cloneNode(true));
		document.querySelectorAll('input[name="s"]').forEach(function (i) { i.value = q; });
	}

	function render(items) {
		var frag = document.createDocumentFragment();
		items.forEach(function (it) {
			var el = card.content.firstElementChild.cloneNode(true);
			var label = it.ty === 'post' ? '' : LABELS[ar ? 'ar' : 'en'][it.ty] || '';
			el.querySelectorAll('a').forEach(function (a) {
				if (!/author|category|jpost-cat/.test(a.getAttribute('href') + ' ' + a.className)) a.href = it.u;
			});
			var img = el.querySelector('img');
			if (img) {
				img.removeAttribute('srcset');
				img.removeAttribute('sizes');
				img.removeAttribute('fetchpriority');
				img.loading = 'lazy';
				if (it.i) { img.src = it.i; img.alt = it.t; } else img.closest('a').remove();
			}
			if (ar) {
				var title = el.querySelector('.default-blog__item-title a');
				title.textContent = it.t;
				var meta = el.querySelector('.default-blog__item-meta');
				var cat = meta.querySelector('a');
				meta.firstChild.textContent = ' ' + (it.d || '') + ' ';
				if (label) { cat.textContent = label; cat.removeAttribute('href'); }
				else cat.remove();
				var text = el.querySelector('.cf_text p');
				if (text) text.textContent = excerpt(it);
			} else {
				var t = el.querySelector('.title a');
				t.innerHTML = '<span class="highlight"></span> ';
				t.append(it.t);
				var lis = el.querySelectorAll('.wcf-meta li');
				var who = lis[0] && lis[0].querySelector('a');
				if (who) {
					who.textContent = ' ' + (label || it.a || 'Almajna Advisors') + ' ';
					if (it.al && !label) who.href = it.al; else who.removeAttribute('href');
				}
				var when = lis[1] && lis[1].querySelector('span');
				if (when) { if (it.d) when.textContent = ' ' + it.d + ' '; else lis[1].remove(); }
			}
			frag.append(el);
		});
		list.innerHTML = '';
		list.append(frag);
	}

	function excerpt(it) {
		var x = it.x, i = norm(x).indexOf(norm(q.split(/\s+/)[0]));
		var start = Math.max(0, i - 80);
		return (start ? '…' : '') + x.slice(start, start + 240) + '…';
	}

	if (!q) { showNone(); return; }
	fetch('/search-index.json').then(function (r) { return r.json(); }).then(function (all) {
		var terms = norm(q).split(/\s+/).filter(Boolean);
		var hits = all.filter(function (it) { return it.l === (ar ? 'ar' : 'en'); }).map(function (it) {
			var t = norm(it.t), x = norm(it.x), score = 0;
			for (var k = 0; k < terms.length; k++) {
				var inT = t.indexOf(terms[k]) >= 0, inX = x.indexOf(terms[k]) >= 0;
				if (!inT && !inX) return null;
				score += (inT ? 10 : 0) + (inX ? 1 : 0);
			}
			return { it: it, score: score };
		}).filter(Boolean).sort(function (a, b) {
			return b.score - a.score || ORDER[a.it.ty] - ORDER[b.it.ty];
		}).map(function (h) { return h.it; });
		if (hits.length) render(hits); else showNone();
	}).catch(showNone);
})();
