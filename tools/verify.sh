#!/usr/bin/env bash
# Test site/ the way Cloudflare Pages will serve it, and compare with the live site.
set -euo pipefail
cd "$(dirname "$0")/.."
PORT=${PORT:-8790}
npm run build >/dev/null && python3 tools/check_links.py dist | sed -n '1p;3,40p'
python3 tools/serve.py dist "$PORT" & SERVER=$!
trap 'kill $SERVER' EXIT
sleep 1
node tools/verify.cjs "http://localhost:$PORT" dist
