# Flow Lines — open ideas

Shipped work is not listed here. For where the *rendering* frontier is (mark
strategies, light direction, semantic-label depth), see the "Where the frontier
is" section of `CLAUDE.md`.

## Interactive painting modes

Image → Ink already supports painted subject isolation and focal points. The
remaining painting ideas apply to the flow-field family:

- [ ] **Paint attractors/repellers** — draw areas that flow lines curve toward
      or away from, with adjustable influence radius and strength.
- [ ] **Paint direction override** — drag to override the noise-field direction
      in specific areas, guiding flow locally while keeping noise elsewhere.
- [ ] **Paint density** — a brush that raises or lowers line density in painted
      regions; combines with seed points for fine control.

## Web app

- [ ] Save/load the whole plot (layer stack + frame) to a file. Per-module
      presets and undo/redo exist; the document itself does not persist across a
      refresh.
- [ ] Session persistence for uploaded photos (undoing an image-layer deletion
      currently restores settings but needs the photo re-uploaded).
- [ ] Share links / URL state.
- [ ] Raster (PNG) export alongside SVG.
- [ ] Plotter-native export — HPGL / GCode / AxiDraw.
- [ ] Cancel an in-flight render.

## CLI

- [ ] Commands for the web-only generators: Reaction–Diffusion, Lenia,
      Physarum, Colour Field, City, Stick Men, Sports Balls, Hearts, Ribbon
      Weave, Complex Flow.
- [ ] Paper and tiling flags for `generate` and `grid`, which are still
      pixel-only.
- [ ] `--split-layers` for `botanical`, `planet` and `landscape` — they emit
      multi-pen output but cannot export one SVG per pen.
- [ ] Expose the Conway art-treatment options (`artStyle`, `valueBands`,
      `vignette`, hatch angles) that are currently web-only.

## Other

- [ ] Multiple noise layers with blending.
- [ ] Animated flow lines (screen display only, not plotter output).
