# Melbourne ArtStudio Mockup Tool

Client-side React app that rectifies photos of traditional artwork and composites them into a framed gallery-wall mockup. Nothing is uploaded to a server.

## Run locally

```bash
npm install
npm run dev
```

Open the printed local URL, upload 1–3 JPG/PNG photos, straighten corners, then download a PNG for web/social.

## Deploying

This app is not deployed on its own — it's built here, then the static output is copied into the main site repo and served as a subpath at `melbourneartstudio.com/mockup-tool/` by the existing GitHub Pages workflow (no separate hosting, no workflow changes needed there).

```bash
npm run build

MAIN="/path/to/melbourne_art_studio"
SRC="./dist"
rm -rf "$MAIN/mockup-tool"
mkdir -p "$MAIN/mockup-tool"
cp -R "$SRC"/. "$MAIN/mockup-tool"/
```

Then commit and push inside the `melbourne_art_studio` repo (not this one) — that push is what actually goes live once GitHub Pages redeploys.
