// After the build: watermark Doers' own project photos in dist/ and write copyright into their metadata.
// The originals in public/img stay clean. Old blog stock images (img/legacy) and logos are left alone.
import sharp from 'sharp';
import { readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const DIST = new URL('../dist/img/', import.meta.url).pathname;
const FOLDERS = ['work', 'ooh', 'branding', 'signage', 'digital', 'media', 'films'];
const MIN_WIDTH = 500;      // thumbnails smaller than this are skipped
const TEXT = 'doersadv.com';

async function* jpgs(dir) {
  for (const e of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* jpgs(p);
    else if (/\.jpe?g$/i.test(e.name)) yield p;
  }
}

function mark(w, h) {
  const size = Math.round(Math.max(14, w * 0.022));
  const pad = Math.round(size * 0.9);
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <text x="${w - pad}" y="${h - pad}" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-weight="700"
    font-size="${size}" fill="#fff" fill-opacity="0.55" stroke="#000" stroke-opacity="0.25" stroke-width="${Math.max(1, size / 18)}">${TEXT}</text>
</svg>`);
}

let done = 0;
for (const folder of FOLDERS) {
  for await (const file of jpgs(join(DIST, folder))) {
    const img = sharp(file);
    const { width, height } = await img.metadata();
    if (!width || width < MIN_WIDTH) continue;
    const out = await img
      .composite([{ input: mark(width, height), top: 0, left: 0 }])
      .withExifMerge({ IFD0: { Copyright: '© Doers Advertising, doersadv.com. All rights reserved.', Artist: 'Doers Advertising' } })
      .jpeg({ quality: 84, mozjpeg: true })
      .toBuffer();
    await writeFile(file, out);
    done++;
  }
}
console.log(`protect-images: watermarked ${done} photos`);
