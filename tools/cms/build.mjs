// Cloudflare Pages build (`npm run build`): site/ -> dist/.
// Copies the site, then adds what is generated from it (the search index).
import fs from 'node:fs';
import { buildIndex } from './search-index.mjs';

const [src = 'site', out = 'dist'] = process.argv.slice(2);
fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(src, out, { recursive: true });
console.log('search index entries:', buildIndex(out));
