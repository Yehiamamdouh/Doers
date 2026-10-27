// Preparing an uploaded image: large photos are scaled down and saved as WebP
// so pages stay fast. Returns what the page needs and the file to commit.

const MAX_SIDE = 2400;
const MAX_KEEP = 600 * 1024; // smaller files are kept exactly as uploaded

const slug = name => name.toLowerCase().replace(/\.[a-z0-9]+$/, '').replace(/[^a-z0-9؀-ۿ]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'image';

function readAs(file, how) {
	return new Promise((ok, fail) => {
		const r = new FileReader();
		r.onload = () => ok(r.result);
		r.onerror = () => fail(r.error);
		r[how](file);
	});
}

function load(url) {
	return new Promise((ok, fail) => {
		const img = new Image();
		img.onload = () => ok(img);
		img.onerror = () => fail(new Error('This file is not an image the browser can open.'));
		img.src = url;
	});
}

export async function prepareImage(file) {
	const now = new Date();
	const dir = `wp-content/uploads/cms/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`;
	const stamp = now.getTime().toString(36);
	if (file.type === 'image/svg+xml') {
		const dataUrl = await readAs(file, 'readAsDataURL');
		const path = `${dir}/${slug(file.name)}-${stamp}.svg`;
		return { url: '/' + path, path: 'site/' + path, base64: dataUrl.split(',')[1], width: null, height: null, preview: dataUrl };
	}
	const dataUrl = await readAs(file, 'readAsDataURL');
	const img = await load(dataUrl);
	let { naturalWidth: w, naturalHeight: h } = img;
	const ext = (file.name.match(/\.([a-z0-9]+)$/i) || [, 'jpg'])[1].toLowerCase();
	if (file.size <= MAX_KEEP && Math.max(w, h) <= MAX_SIDE) {
		const path = `${dir}/${slug(file.name)}-${stamp}.${ext}`;
		return { url: '/' + path, path: 'site/' + path, base64: dataUrl.split(',')[1], width: w, height: h, preview: dataUrl };
	}
	const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
	w = Math.round(w * scale);
	h = Math.round(h * scale);
	const canvas = document.createElement('canvas');
	canvas.width = w;
	canvas.height = h;
	canvas.getContext('2d').drawImage(img, 0, 0, w, h);
	const out = canvas.toDataURL('image/webp', 0.85);
	const path = `${dir}/${slug(file.name)}-${stamp}.webp`;
	return { url: '/' + path, path: 'site/' + path, base64: out.split(',')[1], width: w, height: h, preview: out };
}
