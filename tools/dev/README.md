# Testing the admin panel locally

The admin panel saves through the GitHub API. To test it without touching
GitHub, `mock-github.py` serves the same few endpoints from a local git repo.

    # a throwaway repo with the site in it
    git init -b main /tmp/almajna-test && cp -r site content /tmp/almajna-test/
    git -C /tmp/almajna-test add -A && git -C /tmp/almajna-test commit -m init

    python3 tools/dev/mock-github.py /tmp/almajna-test 9100 &
    npm run build
    npx wrangler@3 pages dev dist --port 8799 --compatibility-date 2025-01-01 \
      --binding GITHUB_TOKEN=test --binding GITHUB_REPO=o/r \
      --binding GITHUB_API=http://127.0.0.1:9100 \
      --binding INSECURE_DEV_LOGIN_EMAIL=editor@almajna.test &

    # open http://127.0.0.1:8799/admin/  or run the browser test:
    node tools/dev/admin-e2e.cjs http://127.0.0.1:8799 /tmp/almajna-test some-photo.jpg

`INSECURE_DEV_LOGIN_EMAIL` skips the Cloudflare Access check, and only on
localhost; never set it in the Cloudflare project.
