# Screenshots

**Remote check:** On GitHub, `main` did not contain `docs/` until a successful `git push` (verified via public API `GET .../contents/docs?ref=main` → 404, and headless Chromium on `github.com/.../tree/main/docs/screenshots` → “page not found”). After you push, that URL and README images will work.

| File | Description |
|------|-------------|
| [office-stream.png](office-stream.png) | `/office/stream` — Pixi office canvas, sidebar, header metrics |
| [office-costs.png](office-costs.png) | `/office/costs` — JSONL-based cost report |

## Publishing to GitHub

These PNGs are tracked in git. They **do not** show on GitHub until someone runs:

```bash
git status   # e.g. "ahead of origin/main"
git push origin main
```

After a successful push, the folder will be at  
`https://github.com/SC32br/openclaw-skill-pixel-office/tree/main/docs/screenshots`  
(if that URL 404s, `main` on GitHub does not have these files yet — compare with `git log origin/main..HEAD`).

## Refreshing captures (maintainers)

Run `npm run dev`, then capture the routes with headless Chromium or your browser. Use ~1600×950 viewport for consistency with the README layout.
