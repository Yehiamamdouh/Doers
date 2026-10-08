# AlMajna Advisors website

Design prototype: https://claude.ai/artifact/2duov6eSziekvQvKn4kRnE

Separate from the Doers site (main branch). Work on this branch only.

## Static copy of the live site

The repository root is a static copy of the live WordPress site
(https://almajnaadvisors.com), English and Arabic (`/ar/`), captured on 2026-10-08.
Content, layout and assets are unchanged. Only links were rewritten so the copy
loads its own files instead of the live server. It must be served from the domain
root, because the Elementor scripts load their chunks from `/wp-content/...`.

Preview locally: `python3 -m http.server 8000`, then open http://localhost:8000/

What still needs the live WordPress server: the contact form and the
filtering/sorting on listing pages (they call `wp-admin/admin-ajax.php`), and site search.
