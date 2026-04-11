#!/usr/bin/env bash
# Check whether docs/ exists on GitHub main (public API, no auth).
set -euo pipefail
URL="https://api.github.com/repos/SC32br/openclaw-skill-pixel-office/contents/docs?ref=main"
code=$(curl -sS -o /tmp/gh-docs-api.json -w "%{http_code}" "$URL")
if [[ "$code" == "200" ]]; then
  echo "OK: docs/ exists on GitHub main."
  head -c 200 /tmp/gh-docs-api.json
  echo
  exit 0
fi
echo "HTTP $code — docs/ is NOT on GitHub main yet (expected until you push)."
if [[ -f /tmp/gh-docs-api.json ]]; then
  head -c 300 /tmp/gh-docs-api.json
  echo
fi
exit 1
