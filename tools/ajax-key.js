const IGN = /nonce|page_url|isEditMode|addedPostCSS|referrer|_refresh_listing/;
function fnv(s, seed) { let h = seed >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return ('0000000' + h.toString(16)).slice(-8); }
function norm(data) { const p = new URLSearchParams(data || ''); const a = []; p.forEach((v, k) => { if (!IGN.test(k)) a.push(k + '=' + v); }); a.sort(); return a.join('&'); }
function key(data) { const n = norm(data); return fnv(n, 2166136261) + fnv(n, 0x811c9dc5 ^ 0x5bd1e995); }
module.exports = { key, norm, IGN };
