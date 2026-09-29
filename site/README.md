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
| Contact pages and form | `src/components/ContactPage.astro`, `public/contact.php` (sends to yehia@doersadv.com) |
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

## Section videos

Short silent loops open some sections (homepage, booth and event pages). They live in `public/video/`:
`<name>.webm` / `<name>.mp4` (1280px), `<name>-sm.webm` / `<name>-sm.mp4` (640px, phones and data-saver) and `<name>.jpg` (poster).
Captions and which pages show each loop are in `src/data/video-bands.json`.

To add one from a longer film (8–10 seconds, no sound):

```
ffmpeg -ss 00:00:27 -t 9 -i source.mp4 -an -vf "scale=1280:-2,fps=30" -c:v libx264 -crf 27 -pix_fmt yuv420p -movflags +faststart public/video/name.mp4
ffmpeg -ss 00:00:27 -t 9 -i source.mp4 -an -vf "scale=1280:-2,fps=30" -c:v libvpx-vp9 -b:v 0 -crf 43 public/video/name.webm
```

Repeat with `scale=640:-2` for the `-sm` files, and save one frame as the `.jpg` poster. Keep each desktop file under ~2.5 MB.
Full-length films belong on Vimeo, not on the hosting.

## Full films on Vimeo

`src/data/films.json` lists the full-length films (Drive file id, size, Vimeo title and description).
`python3 scripts/vimeo_upload.py` sends each one to Vimeo straight from Drive and writes the Vimeo id back into the file;
the matching video band then shows a "Watch the full film" button. It needs a Vimeo personal access token with the
upload, edit and private scopes in the `VIMEO_TOKEN` environment variable, and network access to `api.vimeo.com`.

## Contact form spam protection

- Always on: a hidden honeypot field, a timing check (bots that submit within 3 seconds get a fake success) and 5 messages per hour per visitor.
- Cloudflare Turnstile (off until keys exist): Cloudflare dashboard → Turnstile → Add widget for `doersadv.com` (and `staging.doersadv.com`).
  1. Put the **site key** in `src/data/turnstile.json` (it's public).
  2. Put the **secret key** on the server, one level above `public_html`, in `doers-site-config.php`:
     ```php
     <?php return ['turnstile_secret' => '…'];
     ```
  The form checks the token only when the secret is set, so the two steps can happen in either order.
