# Warp and Weft

## Artist statement

This is a portrait, cropped tight as a bust, plotted in the Doré-etching
style (`packages/core/src/pen-ink/styles/dore.ts`): long line systems
that wrap the form and carry tone by swelling weight rather than by
count. The sitter is `test-images/portrait-woman.jpg` — a studio photo
of a bride in a white kimono, laughing, in front of a slatted wooden
screen — one of the repo's rights-cleared test photos, not a posed
sitting for this piece.

The reason this plate survived the cull over a dozen others: the
technique and the subject turned out to be drawing the same thing three
times over without my asking them to. Doré-style cross-hatch is the
etcher's device for shade — two families of near-parallel lines laid
over each other. Behind this sitter is an actual wooden lattice screen.
Across her shoulders is a kimono woven in a key-fret pattern. Hatch,
screen, and cloth are all, literally, a weft over a warp — and once the
generator's shadow-hatch is dense enough to read as fabric, the drawing
stops looking like "a photo with lines added" and starts looking like
something built the way an etching plate is built: structure first,
tone as a by-product of covering it. The face — held apart by
`contourHalo` as a sliver of untouched paper — reads as the one place
the weave hasn't reached yet.

I tried the gentler Sumi-e preset first (radical restraint, a fat brush
gesture, most of the sheet empty); at this photo's scale the stroke
economy budget ate the face's short contours entirely and kept only the
architecture's long straight ones — a study of a wall, not a woman. I
tried a facet-hatch variant next, hoping for something calmer than a
continuous weave; it broke the background into a scatter of short ticks
that read as noise rather than fabric. The full uncropped frame carried
two rendering glitches — the white hair-flower ornament and a doorway
edge on the far right both confused the outline pass into small
hachured boxes. Cropping tight (a 4:5 bust, `--fit fill` against a
`240×300mm` sheet) solved both problems at once and made a stronger,
more intimate picture in the same move.

The single colour break — a small vermillion touch on the lips, added
by hand after the ink plot — is the one thing the plotter didn't draw.
It borrows from the Japanese hanko: a red seal is never inked by the
same tool that made the document it marks. Here it lands on her smile
instead of a signature corner.

## Materials

- **Paper** — one sheet of warm ivory hot-press illustration board or
  heavy printmaking stock, ~250–300gsm, cut to 240×300mm (comfortably
  inside the A3 plotter limit; can be cut from an A3 or larger blank).
  Approx. paper colour: ivory, hex `#f3ead8`.
- **Ink 1 (the plot)** — a warm near-black "sumi" ink, e.g. a fine
  technical fineliner or a sumi-loaded brush pen, hex `#221c16`, run at
  a 0.28mm line. This is the only ink the plotter touches.
- **Ink 2 (the hand accent)** — a small amount of vermillion/cinnabar
  ink — the red traditionally called *shu* (朱), the colour of a
  Japanese hanko seal — hex approx. `#c1341f`, applied with a fine
  brush (a 0/1 round or a waterbrush), by hand, after the plot is dry.
- **Mounting** — float-mounted on backing board behind a mat window,
  leaving the plotted 15mm margin visible as a plate-mark-like border.

## Process

1. Load the ivory sheet and plot `artwork.svg` in the sumi-black ink at
   0.28mm. Expect a dense woven crosshatch across most of the frame with
   a clear island of bare paper for the face and kimono collar — that
   contrast is the composition, not a partial render.
2. Let the ink cure fully (~10–15 minutes for a fineliner; longer for a
   brush pen) before touching the sheet again.
3. Load the fine brush with a small amount of vermillion ink. With one
   confident, unhurried stroke, follow the already-inked contour of the
   mouth, letting the colour sit just inside and slightly over that
   line — a single warm mark, not a filled shape. `preview.png` shows
   the intended placement and size: it sits centred on the smile, roughly
   two-thirds of the way across the sheet and just under halfway down.
   If it comes out crooked, it's meant to look like a hand made it —
   don't fuss over it.
4. Let the accent dry flat (a raised gel or brush ink can cockle thin
   paper; weight the sheet under glass overnight if needed).
5. Float-mount on backing board behind a mat window sized to the full
   240×300mm sheet plus the plotted margin.

No wash, no misregistration, no second plotted pass — one plotted plate,
one hand-placed mark.

## Plot settings

| | Value |
|---|---|
| Paper | 240×300mm (custom, portrait) |
| Margin | 15mm |
| Pen width | 0.28mm |
| Render resolution | 3 px/mm |
| Seed | 7 |
| Style | `dore` (Doré Etching), with `contourHalo: 3.8`, `counterchange: 0.65` overriding the preset |
| Strokes | 1,458 (chained + travel-ordered, `optimize: true`, the `image` command's default) |

## Reproduction

Built from the CLI against the repo's existing test photo and its
committed label sidecar — no new photography, no code changes.

```sh
pnpm install && pnpm build   # builds packages/cli/dist used below

node packages/cli/dist/cli.js image \
  -i test-images/portrait-woman.jpg \
  --label-image test-images/portrait-woman.labels.png \
  --style dore \
  --paper 240x300 --fit fill \
  --margin-mm 15 \
  --resolution 3 \
  --pen-width-mm 0.28 \
  --seed 7 \
  --contour-halo 3.8 \
  --counterchange 0.65 \
  -o artwork.svg
```

Verified byte-identical across two separate runs.

`preview.png` was rendered from `artwork.svg` with a small scratch
script built on `@resvg/resvg-js` (the same library `scripts/svg-to-png.mjs`
wraps): it recolours the paper to ivory and the strokes to the sumi ink
hex above — identical to what `scripts/svg-to-png.mjs in.svg out.png
--background '#f3ead8' --stroke '#221c16'` produces — then adds one
soft, blurred vermillion ellipse over the mouth (in the SVG's own
`viewBox` coordinates, before rasterizing) to preview the hand-inked
accent described above. That ellipse exists only in the preview script;
it is not part of `artwork.svg` and is not plotted.

## Wishes

- Raising `--resolution` from 3 to 4 on this exact command silently
  dropped the mouth's outline entirely (it survived at 3, vanished at
  4, everything else held). Contour survival shouldn't hinge on the
  chosen render density — worth tying the outline-length floor and
  sharpness gate to a real-world (mm) scale rather than raw output
  pixels, so bumping resolution for a bigger print can't quietly delete
  a facial feature.
- A CLI-level way to tag one small region (a label id, a manual mask, a
  bounding box) for a second pen/colour pass — "ink this bit again in
  ink B" — would have replaced the hand-rolled preview-only SVG splice
  above with something reproducible straight from the command line, and
  would generalise well beyond this one piece (spot-colour accents,
  registration-marked multi-pen plates).
