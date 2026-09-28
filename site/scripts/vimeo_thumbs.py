"""Downloads a poster image for every Vimeo film the site shows into public/img/films/<id>.jpg.
Reads src/data/media-films.json and src/data/films.json; skips images already there.
Run: python3 scripts/vimeo_thumbs.py"""
import json, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'public/img/films'

media = json.loads((ROOT / 'src/data/media-films.json').read_text())
films = json.loads((ROOT / 'src/data/films.json').read_text())
ids = [f['id'] for f in media['films']] + [r['id'] for r in media['reels']] + [f['vimeo'] for f in films if f.get('vimeo')]

OUT.mkdir(parents=True, exist_ok=True)
for vid in dict.fromkeys(ids):
    dest = OUT / f'{vid}.jpg'
    if dest.exists():
        continue
    with urllib.request.urlopen(f'https://vimeo.com/api/oembed.json?url=https://vimeo.com/{vid}&width=1280') as r:
        thumb = json.load(r)['thumbnail_url']
    # Ask for a 1280px-wide poster; Vimeo keeps the video's own aspect ratio.
    thumb = thumb.split('_')[0] + '_1280.jpg' if '_' in thumb.rsplit('/', 1)[-1] else thumb
    urllib.request.urlretrieve(thumb, dest)
    print('saved', dest.name, dest.stat().st_size)
