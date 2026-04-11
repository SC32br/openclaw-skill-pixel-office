# Screenshots

| File | Description |
|------|-------------|
| [office-stream.png](office-stream.png) | `/office/stream` — Pixi office canvas, sidebar, header metrics |
| [office-costs.png](office-costs.png) | `/office/costs` — JSONL-based cost report |

## Publishing to GitHub

These PNGs are tracked in git. If they do not appear on [the repo](https://github.com/SC32br/openclaw-skill-pixel-office/tree/main/docs/screenshots), your local branch needs a push:

```bash
git status   # e.g. "ahead of origin/main"
git push origin main
```

## Refreshing captures (maintainers)

Run `npm run dev`, then capture the routes with headless Chromium or your browser. Use ~1600×950 viewport for consistency with the README layout.
