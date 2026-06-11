# Test Images

Drop reference photos here (PNG/JPEG) and run the gallery to render every
image through every style preset as one contact sheet:

```bash
pnpm build
node scripts/gallery.mjs            # renders test-images/ -> gallery/index.html
node scripts/gallery.mjs my-photos  # or any other directory
```

Use it as the eyeball-regression suite when tuning renderer defaults: any
change should be judged against the whole album, not a single image.

**Privacy note:** if this repository is public, anything committed here is
public too. Keep sensitive photos out, or keep the repo private.

The bundled photo bank is sourced from Google's public sample-data
buckets (`cloud-samples-data`, `mediapipe-assets`), which Google
publishes as demo assets for its API documentation. They are used here
solely as rendering test fixtures. The `test-*.png` files are synthetic.

The gallery runs the CLI, so depth-based features are only exercised if a
matching depth map exists: for `photo.jpg`, provide `photo.depth.png`
(bright = near; exportable from depth tools or the web app). Likewise
`photo.normal.png` is picked up as a direction field (R/G = X/Y).
