#!/usr/bin/env bash
# Test site/ the way Cloudflare Pages will serve it, and compare with the live site.
set -euo pipefail
cd "$(dirname "$0")/.."
PORT=${PORT:-8790}
python3 tools/check_links.py site | sed -n '1p;3,40p'
python3 tools/serve.py site "$PORT" & SERVER=$!
trap 'kill $SERVER' EXIT
sleep 1
node tools/verify.js "http://localhost:$PORT" site
