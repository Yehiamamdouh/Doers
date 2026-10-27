#!/usr/bin/env bash
# Rebuild the static copy of almajnaadvisors.com from the live WordPress site.
#   tools/build.sh            -> writes site/ (the folder Cloudflare Pages serves)
# Needs: wget, python3, node with Playwright + Chromium (for the AJAX recording).
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf build && mkdir build
tools/mirror.sh build/raw
python3 tools/postprocess.py build/raw build/site
python3 tools/make404.py build/site
node tools/record-ajax.js build/ajax
python3 tools/static_ajax.py build/site build/ajax tools/static-ajax-shim.js
rm -rf site && mv build/site site
echo "done: site/ is ready; run tools/verify.sh before deploying"
