#!/usr/bin/env bash
# Step 1: download a fresh copy of the live site into $1 (default: build/raw).
set -euo pipefail
OUT=${1:-build/raw}
SITE=https://almajnaadvisors.com
mkdir -p "$OUT"
seed="$OUT/seed.txt"; : > "$seed"
for s in $(curl -sS "$SITE/wp-sitemap.xml" | grep -oE '<loc>[^<]+' | sed 's/<loc>//'); do
	curl -sS "$s" | grep -oE '<loc>[^<]+' | sed 's/<loc>//' >> "$seed"
done
grep -v '/wcf-template/' "$seed" > "$seed.tmp" && mv "$seed.tmp" "$seed"
echo "seed pages: $(wc -l < "$seed")"
cd "$OUT"
wget --mirror --level=3 --page-requisites --convert-links --adjust-extension \
	--span-hosts --domains=almajnaadvisors.com,fonts.googleapis.com,fonts.gstatic.com \
	--reject-regex='(/wp-json|/xmlrpc|/feed/?$|/feed/|/wp-admin|/wp-login|replytocom|/wcf-template/|[?&]s=|/comments/feed|/embed/?$|oembed)' \
	--restrict-file-names=windows --wait=0.2 --random-wait -e robots=off --timeout=30 --tries=3 \
	-U "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36" \
	-i seed.txt -o wget.log || true   # wget exits non-zero on the expected 404s
grep -q 'FINISHED' wget.log
echo "downloaded: $(grep -oE 'Downloaded: [0-9]+ files, [^ ]+' wget.log)"

# Every sitemap page must be on disk; the server sometimes drops requests, so retry.
missing() {
	while read -r url; do
		path=$(python3 -c 'import sys, urllib.parse as u; print(u.unquote(u.urlsplit(sys.argv[1]).path))' "$url")
		[ -f "almajnaadvisors.com${path}index.html" ] || echo "$url"
	done < seed.txt
}
for try in 1 2 3; do
	missing > missing.txt
	[ -s missing.txt ] || break
	echo "retrying $(wc -l < missing.txt) pages (try $try)"
	sleep 5
	wget --mirror --level=1 --page-requisites --convert-links --adjust-extension \
		--span-hosts --domains=almajnaadvisors.com,fonts.googleapis.com,fonts.gstatic.com \
		--restrict-file-names=windows --wait=1 -e robots=off --timeout=30 --tries=5 \
		-U "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36" \
		-i missing.txt -a wget.log || true
done
missing > missing.txt
if [ -s missing.txt ]; then
	echo "pages still missing:"; cat missing.txt; exit 1
fi
