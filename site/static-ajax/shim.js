/* Static copy helper for the site's WordPress AJAX calls:
   - team member popups, crypto listing load-more and filters are answered from
     responses recorded from the live site, stored next to this file as <key>.json
   - the contact forms post to the /api/contact Pages Function instead */
(function ($) {
	if (!$ || !$.ajaxPrefilter) return;
	var base = new URL('.', document.currentScript.src).href;
	var IGN = /nonce|page_url|isEditMode|addedPostCSS|referrer|_refresh_listing/;
	function fnv(s, seed) {
		var h = seed >>> 0;
		for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
		return ('0000000' + h.toString(16)).slice(-8);
	}
	function key(data) {
		var p = new URLSearchParams(typeof data === 'string' ? data : $.param(data || {})), a = [];
		p.forEach(function (v, k) { if (!IGN.test(k)) a.push(k + '=' + v); });
		a.sort();
		var n = a.join('&');
		return fnv(n, 2166136261) + fnv(n, 0x811c9dc5 ^ 0x5bd1e995);
	}
	$.ajaxPrefilter(function (o) {
		if (String(o.type).toUpperCase() !== 'POST' || !/admin-ajax\.php|[?&]nocache=/.test(o.url)) return;
		if (window.FormData && o.data instanceof FormData) {
			if (o.data.get('action') === 'elementor_pro_forms_send_form') {
				o.url = new URL('/api/contact', location.href).href;
				o.crossDomain = false;
			}
			return;
		}
		if (/[?&]action=(jet_popup_get_content|jet_engine_ajax|jet_smart_filters)(&|$)/.test('&' + (typeof o.data === 'string' ? o.data : $.param(o.data || {}))) === false) return;
		o.url = base + key(o.data) + '.json';
		o.type = 'GET';
		o.data = '';
		o.crossDomain = false;
		o.cache = true;
		o.headers = {};
	});
})(window.jQuery);
