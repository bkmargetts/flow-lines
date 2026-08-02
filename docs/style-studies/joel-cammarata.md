# Style study: Joel Cammarata

An analysis of Joel Cammarata's pen-plotting practice and a roadmap of
ways Flow Lines could absorb what makes it work. Sources: his
[site](https://www.joelcammarata.com/) and
[shop](https://www.joelcammarata.com/shop), the
[Bantam Tools artist page](https://bantamtools.com/products/bt-cma-05-joel-cammarata-copy)
for `BT.2412.03.02`, and pen-plotter community writeups.

## A. What his work is

Cammarata comes from architecture: pieces are **drafted in CAD**, with
layer properties assigned there, then plotted small (postcards up to
18"×24", AxiDraw / Bantam Tools NextDraw + ArtFrame) on **watercolor
paper**, in editions or 1/1s. Series are named after their *medium*
(`Lead Study`, `Ink Test`, `Bic Stripes`, `Ribbon`, `G2.Sq`), which is
the tell for the whole practice:

1. **The field is a substrate for material physics.** His own framing:
   "consistent spacing and repetitive linework sets up a field in which
   the physical properties of the ink" carry the piece. The geometry is
   deliberately simple and regular — stripes, squares, ribbon bands —
   precisely so that ink pooling, gel-pen sheen, ballpoint blobbing and
   skipping become the subject. This is the inverse of Flow Lines'
   stance: we use the pen to depict a subject; he uses a drawing to
   depict the pen.

2. **Multi-pen colour interleaving.** The `Ribbon` series layers red /
   blue / black gel pens (Uniball Signo UM-153) and primary-colour
   fountain inks so that "each colour takes its turn in the
   foreground" — plotting order alternates *locally*, not one colour
   globally on top. Overlap, slight misregistration and interleave
   order create the depth; there is no hold-off — inks physically cross.

3. **Plot order made visible.** `Lead Study` plots red + blue Blackwing
   pencils and lets the lead wear *during* the plot: "the sharp initial
   line fades to a slight blur." The temporal order of strokes becomes a
   spatial gradient on the sheet. `Ink Test` does the same with fountain
   pen depletion and pooling at large format.

4. **Machine structure + hand chaos.** The larger Bantam pieces start as
   CAD-plotted geometric frameworks and then take intuitive spray paint
   / paint interventions inside them — "control and chaos, digital
   systems and organic spontaneity." Mistakes and surprises are kept.

5. **Restraint of format and vocabulary.** Small sheets, one or two
   geometric ideas per piece, two or three inks, lots of paper. The
   composition is drafted, not searched-for generatively.

## B. Where Flow Lines already lines up

- **Multi-pen plumbing is done.** The layer stack namespaces pen layers
  per slot, exports one SVG per pen, and draws corner registration
  crosses for re-registering between pen swaps (`lib/composite.ts`) —
  exactly the workflow his multi-ink pieces need.
- **`color-field`** is the closest existing module: every ink is an
  interleaved grating over the whole field with density drifting along a
  gradient — optical mixing through repetitive linework. It's the seed
  of his "field" idea, but it targets smooth gradients, not
  material-forward regular fields.
- **`ribbon-weave`** shares a name but not a concept: it's a
  representational woven ribbon with shading. His ribbons are abstract
  offset-pass bands per ink.
- **Misregistration** exists in humanisation as a subtle wobble tell,
  not as a deliberate compositional device.
- **`concept-brainstorming/`** already documents named inks, paper and
  hand processes per piece (`ARTWORK.md`) — the natural home for
  plot-plus-paint hybrids.

## C. Extension ideas, roughly ranked

1. **Overprint interleave (compositor).** The single biggest unlock.
   Composite today does top→bottom hold-off — upper layers knock out
   lower ones to keep paper honest. Cammarata's look *requires* inks
   crossing. Add a per-layer **overprint flag** (skip hold-off for that
   layer) plus an **interleave order** concept for multi-ink modules:
   which pen is "on top" swaps by stripe / band / region, so each colour
   takes its turn in the foreground. Everything stays plain stroked
   paths at one width per pen; only the hold-off and the per-pen
   grouping change.

2. **Material-field module family.** A pure module whose whole job is
   dense, evenly spaced repetitive linework as an ink substrate:
   boustrophedon fills, stripe blocks, concentric passes; spacing
   dialled at or below the pen's bleed width so adjacent lines merge
   physically on the paper; 1–3 inks with interleave patterns and
   per-ink phase offsets. Think `Bic Stripes` / `G2.Sq` as a genome.
   Cheap to build (it's mostly `polyline.ts` arithmetic), and the
   plotted result depends on the pen in a way the SVG preview honestly
   can't show — which is the point.

3. **Plot order as a compositional axis.** Pencil wear and ink depletion
   follow stroke order, not stroke position. Add an `orderPlot` mode
   that orders strokes along a chosen spatial ramp (left→right,
   centre→out, dark→light) instead of nearest-neighbour, so wear
   becomes a deliberate sharp→blur gradient across the sheet — a
   `Lead Study` in one flag. Geometry stays byte-identical (it's pure
   reordering, same contract as `orderPlot`), at the cost of pen-up
   travel — worth exposing the trade-off. A "swap/refill pen every N
   metres of drawn travel" annotation in the SVG per-layer metadata
   would complete it.

4. **Offset-pass ribbon style.** Either a new abstract module or a
   `style` on `ribbon-weave`: one drafted guide curve, N offset repeats
   per ink with per-ink phase and a few tenths of a millimetre of
   deliberate misregistration, colours braiding in front of each other
   via the interleave order from (1).

5. **Deliberate misregistration controls.** Promote misregistration from
   a humanisation constant to a first-class multi-ink parameter: per-ink
   dx/dy (mm) and repeat-pass count. Doubles as a general "risograph"
   knob for every multi-pen stack.

6. **Paint-zone planning layer.** For the machine+hand hybrid: a module
   that generates intervention zones as faint plotted outlines plus a
   separate stencil/cut SVG per zone, so a concept-brainstorming run can
   specify "plot layers 1–3, spray through stencil A, plot layer 4" in
   `ARTWORK.md` with real registration.

7. **Pen/media presets.** A small pen library (gel, fountain, ballpoint,
   pencil, fineliner) carrying bleed width, recommended min spacing and
   max density; material-field defaults and the page pen-width control
   read from it. Mostly metadata, big quality-of-life for actually
   plotting the above.

8. **Photo crossover (later).** A `stripeField` rendering mode for
   image-ink: tone carried by a single uniform-direction interleaved
   multi-ink field (spacing/interleave modulated by tone) instead of
   streamline hatching — a photograph rendered in his vocabulary. Fun,
   but the abstract modules above are the honest first step.

Items 1–3 are the core; they generalise beyond imitating one artist —
overprint, material-aware fields and order-aware plotting are missing
capabilities of the toolbox, not style presets.

## Shipped

Items 1–3 landed alongside this study:

1. **Overprint** — a per-layer ⊗ toggle in the web layer stack: the
   layer's pens preview/export with multiply blend, it never carves
   hold-off halos in layers beneath, and its own halo is ignored
   (`lib/composite.ts`).
2. **Material fields** — `generateInkField` (core) + the **Ink Field**
   web module + `flow-lines ink-field` (CLI): `ribbon` (drafted
   filleted band, vernier-braided inks), `lattice` (colour planes by
   density inside one grid), `stripes` (drifting bands, optional ruled
   blocks), with per-ink misregistration and optional per-ink proof dots.
3. **Plot order** — `optimizePlot`/`orderPlot` take an order strategy
   (`sweep` / `centerOut` / `centerIn`); exposed as the module's
   "Plot order (wear)" group and `--plot-order` on the `ink-field` and
   `image` commands.

The implementation was subsequently **generalised away from the
reference works**: the study keeps the attribution, but the tool ships
techniques, not signatures — generic ink palette, proof dots opt-in, no
artist naming in product-facing text. Studying a practice is homage;
shipping its recognisable gestalt as a default is imitation, and
imitation can't produce a personal style anyway.

## Toward a native style: hybrid directions

The point of absorbing these techniques is to cross them with what this
toolbox already does that nobody else's does: **photographic pen-and-ink
with a compositional value engine** (`valueBands`, `massing`, the
importance map, semantic labels). His work is abstract and drafted; ours
reads the world. The hybrids live where material physics meets
photographic structure — in rough order of promise:

1. **Colour planes from the value plan** (image-ink). The lattice style
   invents its planes from seeded wedges; the photo pipeline already
   *computes* better ones — the massing/value-band abstraction of a real
   scene. Feed the banded value plan in as the plane map: each value
   band carries an ink-weight vector, and a photograph renders as a
   committed multi-ink field where the colour geometry *is* the tonal
   composition. This is the flagship hybrid: material-forward surface,
   photographic bones.
2. **Wear-order by importance** (core + image-ink). The sweep modes
   order strokes spatially; a small extension (an order key computed
   per stroke) would let plot order follow the *importance map* — the
   pen freshest on the subject, dulling and depleting into the
   backgrounds it already dissolves. Physical media doing the job the
   importance map does digitally.
3. **Overprint shadow hatch** (image-ink). Deep cross-hatch layers are
   currently the same ink piling to black. Give layers 2+ a second ink
   with slight misregistration and overprint: shadows become physically
   mixed colour — richer than black, and unmistakably plotted.
4. **Ribbon guides from photographic geometry** (image-ink / core). The
   offset-band engine is style-agnostic about its centreline. Feed it a
   long confident contour chain from the edge detector, or a dominant
   streamline of the orientation field, and a subject's silhouette
   renders as one braided band — drawing and material study at once.
5. **Overprint echo as a stack gesture** (web tooling). Duplicate-layer
   + new seed + misregistration + the ⊗ toggle is already a manual
   idiom; a one-click "echo as overprint" action on the layer row would
   make vernier/misregistration effects available to *every* module
   (flow fields, marbling, conway) with zero per-module work.
6. **Material drift in existing scene marks** (landscape). Calm water's
   long broken horizontals and the sky stipple are natural hosts for
   two-ink stripe drift — tonal features that pick up subtle colour
   temperature without leaving the scene vocabulary.
7. **The autonomous studio** (concept-brainstorming). The brief can now
   spec overprint stacks, wear gradients and per-ink files; ARTWORK.md
   already documents named inks and hand processes, so the routine can
   design *for* the physics — and the gallery judges the results.

The through-line: his insight — *let the material do the talking over a
deliberately simple substrate* — applied to substrates that carry a
photograph's structure. That combination exists nowhere else, which is
what makes it a style rather than a borrowing.
