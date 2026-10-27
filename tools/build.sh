#!/usr/bin/env bash
# Rebuild site/ (the static copy of almajnaadvisors.com) from the live WordPress site.
# Needs: wget, python3, node with Playwright + Chromium (for the AJAX recording).
# Cloudflare then runs `npm run build` (tools/cms/build.mjs) to turn site/ into dist/.
set -euo pipefail
cd "$(dirname "$0")/.."
LIVE=https://almajnaadvisors.com
rm -rf build && mkdir build
tools/mirror.sh build/raw
python3 tools/postprocess.py build/raw build/site
python3 tools/livepage.py build/site \
	"$LIVE/this-page-does-not-exist-404/" 404.html \
	"$LIVE/?s=sukuk" search/index.html \
	"$LIVE/?s=zzqqxxnothing" search/_none.html \
	"$LIVE/ar/?s=zzqqxxnothing" ar/search/index.html
node tools/cms/search-pages.mjs build/site
node tools/record-ajax.cjs build/ajax
python3 tools/static_ajax.py build/site build/ajax tools/runtime/shim.js
cp tools/runtime/search.js build/site/static-ajax/search.js
rm -rf site && mv build/site site
echo "done: site/ is ready; run tools/verify.sh before deploying"
