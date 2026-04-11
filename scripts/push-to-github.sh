#!/usr/bin/env bash
# Push local main to origin. Requires a GitHub personal access token (classic: repo scope)
# or fine-grained token with Contents: Read and write.
#
# Usage:
#   export GITHUB_TOKEN=ghp_xxxxxxxx
#   ./scripts/push-to-github.sh
#
# Or one line:
#   GITHUB_TOKEN=ghp_xxx ./scripts/push-to-github.sh

set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

if [[ -z "${GITHUB_TOKEN:-}" ]]; then
  echo "GITHUB_TOKEN is not set."
  echo "Create a token: GitHub → Settings → Developer settings → Personal access tokens."
  echo "Then: export GITHUB_TOKEN=ghp_... && $0"
  exit 1
fi

REMOTE_URL="https://${GITHUB_TOKEN}@github.com/SC32br/openclaw-skill-pixel-office.git"
git push "$REMOTE_URL" main

echo "OK: pushed main. Check: https://github.com/SC32br/openclaw-skill-pixel-office/tree/main/docs/screenshots"
