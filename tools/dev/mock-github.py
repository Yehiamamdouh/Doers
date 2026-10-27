#!/usr/bin/env python3
"""A stand-in for the few GitHub REST endpoints the admin panel uses, backed by
a real local git repository. Lets the admin panel be tested end to end without
touching GitHub. Usage: mock-github.py REPO_DIR PORT  (branch: main)"""
import base64, http.server, json, os, subprocess, sys, tempfile
from urllib.parse import urlsplit, parse_qs, unquote

REPO = sys.argv[1]

def git(*args, input=None, env=None):
    return subprocess.run(['git', '-C', REPO, *args], input=input, capture_output=True, check=True,
                          env={**os.environ, **(env or {})}).stdout

class H(http.server.BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"  # keep-alive, as the Workers runtime reuses connections
    def send(self, code, body, ctype='application/json'):
        data = body if isinstance(body, bytes) else json.dumps(body).encode()
        self.send_response(code); self.send_header('Content-Type', ctype); self.send_header('Content-Length', str(len(data))); self.end_headers(); self.wfile.write(data)

    def route(self):
        u = urlsplit(self.path); parts = u.path.split('/')[4:]  # after /repos/owner/name
        return parts, parse_qs(u.query)

    def do_GET(self):
        parts, q = self.route()
        try:
            if parts[0] == 'contents':
                path = unquote('/'.join(parts[1:]))
                try: self.send(200, git('show', f'main:{path}'), 'application/octet-stream')
                except subprocess.CalledProcessError: self.send(404, {'message': 'Not Found'})
            elif parts[:3] == ['git', 'ref', 'heads']:
                self.send(200, {'object': {'sha': git('rev-parse', parts[3]).decode().strip()}})
            elif parts[:2] == ['git', 'commits']:
                self.send(200, {'tree': {'sha': git('rev-parse', parts[2] + '^{tree}').decode().strip()}})
            elif parts[:2] == ['git', 'trees']:
                out = git('ls-tree', '-r', '-z', parts[2]).decode().split('\0')
                tree = []
                for line in filter(None, out):
                    meta, path = line.split('\t', 1); mode, typ, sha = meta.split()
                    tree.append({'path': path, 'mode': mode, 'type': typ, 'sha': sha})
                self.send(200, {'tree': tree, 'truncated': False})
            elif parts[0] == 'commits':
                n = int(q.get('per_page', ['10'])[0])
                log = git('log', f'-{n}', '--format=%H%x00%an%x00%aI%x00%B%x01', 'main').decode().split('\x01')
                out = []
                for e in filter(lambda x: x.strip(), log):
                    sha, an, ad, msg = e.strip('\n').split('\0', 3)
                    out.append({'sha': sha, 'commit': {'message': msg.strip(), 'author': {'name': an, 'date': ad}}})
                self.send(200, out)
            else: self.send(404, {'message': 'unknown'})
        except Exception as e: self.send(500, {'message': str(e)})

    def body(self):
        return json.loads(self.rfile.read(int(self.headers.get('Content-Length', 0))) or b'{}')

    def do_POST(self):
        parts, _ = self.route(); b = self.body()
        try:
            if parts[:2] == ['git', 'blobs']:
                data = base64.b64decode(b['content']) if b.get('encoding') == 'base64' else b['content'].encode()
                self.send(201, {'sha': git('hash-object', '-w', '--stdin', input=data).decode().strip()})
            elif parts[:2] == ['git', 'trees']:
                with tempfile.NamedTemporaryFile(delete=False) as t: idx = t.name
                env = {'GIT_INDEX_FILE': idx}
                git('read-tree', b['base_tree'], env=env)
                for e in b['tree']:
                    if e.get('sha') is None and 'content' not in e:
                        git('update-index', '--force-remove', e['path'], env=env)
                        continue
                    sha = e.get('sha') or git('hash-object', '-w', '--stdin', input=e['content'].encode()).decode().strip()
                    git('update-index', '--add', '--cacheinfo', f"{e['mode']},{sha},{e['path']}", env=env)
                tree = git('write-tree', env=env).decode().strip(); os.unlink(idx)
                self.send(201, {'sha': tree})
            elif parts[:2] == ['git', 'commits']:
                a = b.get('author') or {}
                env = {'GIT_AUTHOR_NAME': a.get('name', 'admin'), 'GIT_AUTHOR_EMAIL': a.get('email', 'admin@local'),
                       'GIT_COMMITTER_NAME': 'admin', 'GIT_COMMITTER_EMAIL': 'admin@local'}
                args = ['commit-tree', b['tree']] + sum([['-p', p] for p in b['parents']], [])
                sha = git(*args, input=b['message'].encode(), env=env).decode().strip()
                self.send(201, {'sha': sha})
            else: self.send(404, {'message': 'unknown'})
        except Exception as e: self.send(500, {'message': str(e)})

    def do_PATCH(self):
        parts, _ = self.route(); b = self.body()
        git('update-ref', 'refs/heads/' + '/'.join(parts[3:]), b['sha'])
        self.send(200, {'object': {'sha': b['sha']}})

    def log_message(self, *a): pass

http.server.ThreadingHTTPServer(('127.0.0.1', int(sys.argv[2])), H).serve_forever()
