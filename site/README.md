# doersadv.com (Astro)

The new Doers website. Static pages built with [Astro](https://astro.build), deployed to Namecheap over FTP.

## Run it locally

```bash
cd site
npm install
npm run dev        # http://localhost:4321
npm run build      # output in dist/
STAGING=1 npm run build   # noindex, no analytics, no sitemap
```

## Where things live

| What | Where |
|---|---|
| Shared `<head>` (title, description, canonical, hreflang, schema, GTM) | `src/layouts/Base.astro` |
| Homepage (English and Arabic from one template) | `src/content/home.html`, `src/i18n/home.ar.json`, `src/lib/home.js`, `public/js/home.js`, `public/css/home.css` |
| Service pages | `src/data/service-pages.json` → `src/components/ServicePage.astro` |
| Services menu (EN + AR names, URLs) | `src/data/services-menu.json` |
| Contact pages and form | `src/components/ContactPage.astro`, `public/contact.php` (sends to info@doersadv.com) |
| Blog posts and projects (edited in the dashboard) | `src/content/blog/`, `src/content/projects/` |
| Content dashboard | `/admin/` (Decap CMS), login via `public/api/github-oauth.php` |
| Deploy | `.github/workflows/deploy-site.yml` |

## Deploying

- **Staging:** every push to `main` that changes `site/` deploys automatically (noindex, robots blocks everything).
- **Production:** GitHub → Actions → *Deploy site* → Run workflow → choose `production`.
- Needs these repository secrets: `FTP_SERVER`, `FTP_USERNAME`, `FTP_PASSWORD`, `FTP_STAGING_DIR`, `FTP_PRODUCTION_DIR`.

## Content dashboard setup (one time)

1. GitHub → Settings → Developer settings → OAuth Apps → New.
   Callback URL: `https://doersadv.com/api/github-oauth.php?callback=1`
2. On the hosting, one level above `public_html`, create `decap-oauth-config.php`:
   ```php
   <?php return ['client_id' => '…', 'client_secret' => '…'];
   ```
3. Open `https://doersadv.com/admin/` and log in with GitHub.
