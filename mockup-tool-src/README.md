# Melbourne ArtStudio Mockup Tool — source

Client-side React app that rectifies photos of traditional artwork and composites them into a framed gallery-wall mockup. Nothing is uploaded to a server.

**This folder is a synced snapshot of the source**, kept here (inside the public site repo) so the readable code has a public home and history alongside the site itself. Active development happens in a separate local working copy that also has its own private git history and product/PRD docs — those aren't published here. After a change is ready, the working copy's `src/`, `public/`, etc. get re-synced into this folder (excluding `node_modules`, `dist`, and the PRD docs) and committed here.

## Run locally

```bash
npm install
npm run dev
```

Open the printed local URL, upload 1–5 JPG/PNG photos, straighten corners, then download a PNG for web/social.

## Deploying

This app isn't served from `mockup-tool-src/` directly — it's built, then the static output is copied into `../mockup-tool/` (a sibling folder in this same repo) and served as a subpath at `melbourneartstudio.com/mockup-tool/` by the existing GitHub Pages workflow (no separate hosting, no workflow changes needed).

```bash
npm run build

MAIN="/path/to/melbourne_art_studio"   # repo root, one level up from this folder
SRC="./dist"
rm -rf "$MAIN/mockup-tool"
mkdir -p "$MAIN/mockup-tool"
cp -R "$SRC"/. "$MAIN/mockup-tool"/
```

Then commit and push both the updated `mockup-tool-src/` and `mockup-tool/` — that push is what actually goes live once GitHub Pages redeploys.
