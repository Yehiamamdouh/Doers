"""Upload the full films listed in src/data/films.json to Vimeo, straight from Google Drive.

Uses Vimeo's "pull" upload: Vimeo downloads each file from its Drive link itself, so nothing
large passes through this machine. Needs a Vimeo personal access token with the "upload",
"edit" and "private" scopes in the VIMEO_TOKEN environment variable (never commit it).

  python3 scripts/vimeo_upload.py            # upload every film that has no Vimeo id yet
  python3 scripts/vimeo_upload.py --status   # check processing status of uploaded films

The Drive files must be shared as "anyone with the link" for Vimeo to fetch them.
Each new Vimeo id is written back into films.json; commit that file afterwards.
"""
import json, os, pathlib, sys, urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
FILMS = ROOT / 'src/data/films.json'
API = 'https://api.vimeo.com'

def call(method, path, body=None):
    req = urllib.request.Request(API + path, method=method, data=json.dumps(body).encode() if body else None, headers={
        'Authorization': f'bearer {os.environ["VIMEO_TOKEN"]}',
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.vimeo.*+json;version=3.4',
    })
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read() or b'{}')

def main():
    if not os.environ.get('VIMEO_TOKEN'):
        sys.exit('VIMEO_TOKEN is not set.')
    films = json.loads(FILMS.read_text())
    if '--status' in sys.argv:
        for f in films:
            if f['vimeo']:
                v = call('GET', f'/videos/{f["vimeo"]}?fields=name,status,transcode.status,duration')
                print(f['key'], f['vimeo'], v.get('status'), v.get('transcode', {}).get('status'), v.get('duration'))
        return
    quota = call('GET', '/me?fields=upload_quota')['upload_quota']
    print('Vimeo space left:', round(quota['space']['free'] / 1e9, 1), 'GB')
    for f in films:
        if f['vimeo']:
            continue
        if f['size'] > quota['space']['free']:
            print('skip (not enough Vimeo space):', f['key']); continue
        link = f'https://drive.usercontent.google.com/download?id={f["drive"]}&export=download&confirm=t'
        v = call('POST', '/me/videos', {
            'upload': {'approach': 'pull', 'size': f['size'], 'link': link},
            'name': f['name'], 'description': f['description'],
            'privacy': {'view': 'anybody', 'embed': 'public', 'download': False},
        })
        f['vimeo'] = v['uri'].rsplit('/', 1)[-1]
        quota['space']['free'] -= f['size']
        FILMS.write_text(json.dumps(films, ensure_ascii=False, indent=1) + '\n')
        print('queued', f['key'], '->', f['vimeo'])

if __name__ == '__main__':
    main()
