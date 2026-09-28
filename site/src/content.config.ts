import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// Content edited from the /admin/ dashboard. Blog and project page templates arrive in phase 2.
const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    lang: z.enum(['en', 'ar']).default('en'),
    date: z.coerce.date(),
    cover: z.string().optional(),
    coverAlt: z.string().optional(),
    service: z.string().optional(),
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
