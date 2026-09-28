import { getCollection } from 'astro:content';

/** Posts sit at the site root, as on the old WordPress site: /<slug>/ and /ar/<slug>/. */
export function postSlug(post) {
  return post.id.replace(/^ar\//, '');
}

export function postPath(post) {
  return (post.data.lang === 'ar' ? '/ar/' : '/') + postSlug(post) + '/';
}

export async function postsIn(lang) {
  const all = await getCollection('blog', (p) => p.data.lang === lang);
  return all.sort((a, b) => b.data.date - a.data.date);
}
