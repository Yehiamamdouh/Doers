# AlMajna Advisors website (static copy)

`site/` is a static copy of the WordPress site https://almajnaadvisors.com,
English and Arabic (`/ar/`), made so the site can move off WordPress without
any visible change. Content and design are exactly what the live site shows.

Separate from the Doers site (`main` branch). Work on this branch only.

## Layout

- `site/` – the website. This is the folder the host serves.
- `functions/` – Cloudflare Pages Functions (the contact form endpoint).
- `tools/` – scripts that rebuild `site/` from the live site and test it.

## Hosting on Cloudflare Pages

1. Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git.
2. Pick the `Doers` repository and the `almajna` branch.
3. Framework preset: None. Build command: leave empty.
   Build output directory: `site`
4. Deploy, and check the `*.pages.dev` address it gives you.
5. Custom domains → add `almajnaadvisors.com` and `www.almajnaadvisors.com`.

The site must be served from the root of a domain (not a subfolder): pages
load their files from `/wp-content/...`, `/static-ajax/...` and so on.

## What works without WordPress

- Every page, menu (desktop and mobile), image, font and animation.
- Team member popups and the crypto list's "load more" and filters: their
  WordPress AJAX answers were recorded from the live site and are replayed
  by `site/static-ajax/shim.js`.
- Unknown URLs show the site's own 404 page (`site/404.html`).
- The contact forms (English and Arabic) post to `/api/contact`
  (`functions/api/contact.js`), which emails the message through Resend and
  answers the way WordPress did, so the form shows its usual success message.

Not replaced: site search. Once the domain points at Cloudflare, a search
opens the home page.

## Contact form setup (once)

1. Create a free account at https://resend.com and add the domain
   `almajnaadvisors.com` (Domains → Add). Add the DNS records it shows in
   Cloudflare DNS. They only cover sending and do not touch existing email (MX).
2. Create an API key in Resend (API Keys → Create, "Sending access").
3. In the Cloudflare Pages project → Settings → Variables and secrets, add:
   - `RESEND_API_KEY` (type Secret): the key from step 2
   - `CONTACT_TO`: `info@almajna.com` (comma-separate several addresses)
   - `CONTACT_FROM`: `AlMajna Website <website@almajnaadvisors.com>`
4. Redeploy, send a test message from /contact/ and /ar/contactus-ar/.

## Rebuilding from the live site

Run this while WordPress is still online, ideally right before switching
the domain, so the copy has the latest content:

    tools/build.sh     # needs wget, python3, node + Playwright with Chromium
    tools/verify.sh    # loads every page like Cloudflare would, compares with live

`verify.sh` checks that all pages load every file with no script errors,
that each menu opens on desktop and mobile, that every team popup shows its
bio, that the crypto list matches the live site with each filter, and that
the 404 page is served.

Preview locally: `python3 tools/serve.py site 8000`, then open http://localhost:8000/
