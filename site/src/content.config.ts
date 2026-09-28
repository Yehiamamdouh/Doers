import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// Content edited from the /admin/ dashboard.
// Posts live at /<slug>/ (English) and /ar/<slug>/ (Arabic, files under blog/ar/), the same URLs as the old site.
const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    h1: z.string().optional(),
    description: z.string(),
    lang: z.enum(['en', 'ar']).default('en'),
    date: z.coerce.date(),
    updated: z.coerce.date().optional(),
    cover: z.string().optional(),
    coverAlt: z.string().optional(),
    category: z.string().optional(),
    service: z.string().optional(),   // path of the related service page, e.g. /seo/
    translated: z.boolean().optional(), // Arabic post translated by hand (not generated from the old site)
  }),
});

const projects = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
  schema: z.object({
    client: z.string(),
    title: z.string(),
    description: z.string(),
    year: z.string().optional(),
    city: z.string(),
    services: z.array(z.string()),
    cover: z.string(),
    gallery: z.array(z.string()).default([]),
    vimeo: z.string().optional(),
    brief: z.string(),
    results: z.string().optional(),
  }),
});

export const collections = { blog, projects };
