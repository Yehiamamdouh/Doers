"""Rewrites the Arabic of a src/data/services/<id>.json file: Cairo in Egyptian Arabic (ar.base, ar.eg),
Jeddah and Riyadh in Modern Standard Arabic (ar.base_ksa over ar.base, ar.ksa, ar.riyadh).
Only text is supplied; images, videos, numbers and other fields already in the file are kept (lists merge item by item)."""
import json, sys


def merge(old, new):
    if isinstance(old, dict) and isinstance(new, dict):
        out = dict(old)
        for k, v in new.items():
            out[k] = merge(old.get(k), v)
        return out
    if isinstance(old, list) and isinstance(new, list) and old and isinstance(old[0], dict):
        return [merge(old[i] if i < len(old) else None, v) for i, v in enumerate(new)]
    return new


def patch(sid, **blocks):
    p = f'src/data/services/{sid}.json'
    d = json.load(open(p))
    ar = d['ar']
    base = ar.get('base', {})
    for name, new in blocks.items():
        if name == 'base_ksa':
            ar['base_ksa'] = {k: merge(base.get(k), v) for k, v in new.items()}
        else:
            ar[name] = merge(ar.get(name, {}), new)
    json.dump(d, open(p, 'w'), ensure_ascii=False, indent=1)
    print('patched', sid, list(blocks))


def dump(sid, lang='en'):
    """Prints the text of one language compactly, to write from."""
    d = json.load(open(f'src/data/services/{sid}.json'))
    skip = {'img', 'src', 'vimeo', 'href', 'band', 'heroReels', 'fit', 'paths', 'id'}
    def walk(x, path):
        if isinstance(x, dict):
            for k, v in x.items():
                if k not in skip: walk(v, f'{path}.{k}')
        elif isinstance(x, list):
            if x and all(isinstance(i, str) for i in x) and sum(map(len, x)) < 300: print(path, '=', ' | '.join(x)); return
            for i, v in enumerate(x): walk(v, f'{path}[{i}]')
        elif isinstance(x, str) and not x.startswith('/'):
            print(path, '=', x)
    walk(d[lang], lang)


if __name__ == '__main__':
    dump(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else 'en')
