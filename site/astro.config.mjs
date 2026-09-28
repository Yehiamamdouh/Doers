import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Staging builds set STAGING=1: the site is marked noindex and the sitemap is skipped.
export default defineConfig({
  site: 'https://doersadv.com',
  trailingSlash: 'always',
  build: { format: 'directory' },
  integrations: process.env.STAGING === '1' ? [] : [
    sitemap({
      filter: (page) => !page.includes('/thank-you/'),
      i18n: { defaultLocale: 'en', locales: { en: 'en-US', ar: 'ar' } },
    }),
  ],
});
