// Cloudflare Pages Function: POST /api/contact
// Receives the Elementor contact forms (English and Arabic pages) and emails
// them through Resend (https://resend.com). The reply uses the JSON shape
// Elementor's form script expects, so the form behaves as it did on WordPress.
//
// Environment variables (Pages project → Settings → Variables and secrets):
//   RESEND_API_KEY  secret, from the Resend dashboard
//   CONTACT_TO      where messages go, e.g. info@almajna.com
//   CONTACT_FROM    a sender on a domain verified in Resend,
//                   e.g. AlMajna Website <website@almajnaadvisors.com>

// Field names differ between the two forms.
const FIELDS = {
	name: ['name', 'yourname'],
	email: ['email', 'youremail'],
	phone: ['phone', 'yourphone'],
	message: ['message', 'yourmessage'],
	privacy: ['privacy_policy', 'ourprivacypolicy'],
};

const TEXT = {
	en: {
		ok: 'Your submission was successful.',
		failed: 'Your submission failed because of an error. Please try again later.',
		email: 'Please enter a valid email address.',
		privacy: 'Please accept the privacy policy.',
	},
	ar: {
		ok: 'تم إرسال رسالتك بنجاح.',
		failed: 'تعذّر إرسال رسالتك بسبب خطأ. يرجى المحاولة لاحقاً.',
		email: 'يرجى إدخال بريد إلكتروني صحيح.',
		privacy: 'يرجى الموافقة على سياسة الخصوصية.',
	},
};

// Same shape as WordPress: success handlers read data.data (e.g. data.data.popup).
const reply = (success, message, errors) =>
	Response.json({ success, data: { message, data: {}, ...(errors ? { errors } : {}) } });

const escape = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export async function onRequestPost({ request, env }) {
	let form;
	try {
		form = await request.formData();
	} catch {
		return reply(false, TEXT.en.failed);
	}
	const pick = keys => {
		for (const k of keys) {
			const v = form.get(`form_fields[${k}]`);
			if (v !== null) return { key: k, value: String(v).trim().slice(0, 5000) };
		}
		return { key: keys[0], value: '' };
	};
	const f = Object.fromEntries(Object.entries(FIELDS).map(([name, keys]) => [name, pick(keys)]));
	const lang = f.email.key === 'youremail' ? 'ar' : 'en';
	const t = TEXT[lang];

	const errors = {};
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.value)) errors[f.email.key] = t.email;
	if (!f.privacy.value) errors[f.privacy.key] = t.privacy;
	if (Object.keys(errors).length) return reply(false, t.failed, errors);

	const page = String(form.get('referrer') || '').slice(0, 300);
	const rows = [
		['Name', f.name.value],
		['Email', f.email.value],
		['Phone', f.phone.value],
		['Message', f.message.value],
		['Page', page],
	];
	const res = await fetch('https://api.resend.com/emails', {
		method: 'POST',
		headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
		body: JSON.stringify({
			from: env.CONTACT_FROM,
			to: (env.CONTACT_TO || 'info@almajna.com').split(',').map(s => s.trim()),
			reply_to: f.email.value,
			subject: `New website message from ${f.name.value || f.email.value}`,
			text: rows.map(([k, v]) => `${k}: ${v}`).join('\n'),
			html: '<table cellpadding="6">' + rows.map(([k, v]) =>
				`<tr><th align="left" valign="top">${k}</th><td style="white-space:pre-wrap">${escape(v)}</td></tr>`).join('') + '</table>',
		}),
	});
	if (!res.ok) {
		console.log('resend error', res.status, await res.text());
		return reply(false, t.failed);
	}
	return reply(true, t.ok);
}
