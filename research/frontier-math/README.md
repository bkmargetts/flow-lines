# Frontier mathematics for pen plotting — research log

Exploration of mathematics past the noise-field frontier, looking for
constructions whose **native output is already a curve or a line network**
rather than a scalar field you then contour.

Everything here is standalone `.mjs` under `lab/` — deliberately outside
`packages/core`, so the mathematics drives the code instead of the existing
API shapes. Nothing here is a module yet, and nothing here is wired into the
build, the tests or the lint run.

Run any of it with `node lab/run-<name>.mjs`; SVGs and PNGs land in
`out/` (gitignored), or wherever `FM_OUT` points. The SVG rasteriser needs the
repo's root dev dependencies (`pnpm install` at the repo root, for
`@resvg/resvg-js`); the sandpile's direct raster path in `lab/raster.mjs` has
no dependencies at all.

The selection criterion that turned out to matter most was not "is this deep"
but **"has anyone ever drawn it?"** Most deep mathematics has exactly one
figure, in one paper, at page size.

---

## 1. Tropical sandpile — built, then cut

`lab/sandpile.mjs`, `lab/vectorize.mjs`, `lab/run-sp.mjs`

**Verdict: rejected on the drawing.** This was shipped as a module and then
removed — the owner's judgement on the output was blunt and final, and it is the
judgement that counts. The mathematics below is correct and the code works; it
simply did not make a picture worth plotting. Recorded in full because a
research log that only keeps its successes is worthless, and because the
failure is instructive: every mechanical property one could ask for was
present — exact sampling, straight rational-slope edges, balanced trivalent
junctions, a genuine variational characterisation — and the drawing still came
out inert. Mechanical virtue is not the same as visual force, and no amount of
the former buys the latter.

Kalinin & Shkolnikov, *Tropical curves in sandpiles*, C. R. Acad. Sci. 354
(2016); *Sandpile solitons via smoothing of superharmonic functions*, CMP 378
(2020). Mikhalkin & Shkolnikov, *Wave fronts and caustics in the tropical
plane*. Shkolnikov, *Planar tropical caustics: trivalency and convexity* (2025).

Fill a lattice polygon with the **maximal stable state** — 3 grains on every
site, one short of toppling everywhere, so the domain is poised. Add one extra
grain at each of `k` chosen points and relax by the abelian toppling rule.

**Theorem.** The relaxation agrees with the maximal stable state almost
everywhere. The set where it does not — the *deviation locus* — converges after
rescaling to a **tropical curve through the k points**: a piecewise-linear graph
with rational-slope edges and integer weights, balanced at every vertex. Among
all tropical curves through those points it is the one of minimal tropical
symplectic area — a tropical Steiner problem.

So the drawing is not a picture *of* the sandpile. The sandpile is a machine
that solves a variational problem in tropical geometry, and the drawing is its
answer. The straightness, the rational slopes, the trivalent junctions and the
routing are all forced, not tuned.

Verification: the deviation locus grows as 439 → 899 → 1819 sites while the
grid quadruples (N = 101, 201, 401) — exactly one-dimensional, i.e. a curve.
Relaxation is abelian, so the output is exactly deterministic given the domain
and the points. ~700² with 120 points takes about 16s single-threaded.

**Vectorising.** 8-connected chain tracing fails: an edge of slope p/q renders
as a staircase and every step reads as a degree-3 junction (it produced 1779
two-point fragments for a curve with ~14 edges). The right primitive is
`straightRuns` — extend while the pixels stay collinear — because the limit
edges genuinely are straight. That returns 14 segments for the 3-point case
with total length matching the deviating-site count.

Parameter space: the domain shape, k, and the point positions. Also open — the
2026 many-point result (Kalinin–Lupercio–Serrano–Shkolnikov) says that after
rescaling by √k the tropical series converges to an Alexandrov solution of a
**Monge–Ampère equation**, so point *density* is the real control and a fully
nonlinear PDE governs the limit.

### The A3 segment budget — do this before building anything on a lattice

A lattice construction quantises, and whether that reads as a woodcut or as a
jaggy circle on graph paper is decided entirely by segment length in
millimetres. At A3 with 15mm margins a 701 lattice is **0.38mm per unit**:

| domain / k | segments | <3mm | 3–8mm | >8mm | median |
|---|---|---|---|---|---|
| square / 7   |  38 |  3% |  8% | 89% | 46.9mm |
| square / 40  | 234 | 35% | 12% | 52% |  9.2mm |
| square / 120 | 686 | 42% | 20% | 38% |  4.2mm |
| hex / 80     | 682 | 50% | 22% | 28% |  3.1mm |
| tri / 60     | 706 | 62% | 18% | 20% |  2.2mm |

So the dense, best-looking-on-screen configurations are exactly the ones in the
aliasing regime. Worse, refining the lattice with the point configuration held
fixed makes it *worse*, not better — the sub-3mm fraction goes 29% → 50% → 67%
for N = 401 → 701 → 1101, and total ink grows with it. The locus keeps genuine
fine structure at every lattice scale; these are not artefacts that converge
away.

It is recoverable in extraction, though. Sweeping the straight-run parameters:

| tol | minLen | segments | <3mm | median | coverage |
|---|---|---|---|---|---|
| 1.1 |  4 | 682 | 50% |  3.1mm | 90% |
| 2.0 | 10 | 321 |  3% | 12.0mm | 86% |
| 2.0 | 20 | 222 |  0% | 18.9mm | 79% |

`tol=2.0, minLen=10` is the default now: half the segments, median 12mm instead
of 3.1mm, and **visually indistinguishable** (`images/mm-budget.png`) — the
discarded 14% is filigree finer than a 0.3mm nib can render. The lesson
generalises: compute the millimetre budget before writing the code, not after.

### Open lead: the α-tropical area

The strongest idea to come out of the invention pass, and a well-posed
generalisation of exactly this object. Deform the tropical symplectic area by
replacing its linear edge weight with a concave one:

```
E_α(C) = Σ_e |m⃗_e|^α · ℓ_e
```
minimised over tropical curves through the prescribed points. α = 1 is
Kalinin–Shkolnikov's sandpile functional — what we already compute. α = 0 is a
lattice-direction Steiner problem. In between, the minimiser's *combinatorial
type* should jump at a finite set of critical exponents: a one-parameter family
with genuine phase transitions rather than a single canonical picture. This is
the same move that deforms Steiner into Gilbert–Steiner irrigation.

Honest risk, stated by its proposer: if the point constraints plus the zero
boundary condition already pin the combinatorial type, C_α does not move with α
and the family is eleven copies of one object. Test that first, cheaply, before
building anything.

## 2. Tropical caustic of a convex domain — correct but visually thin

`lab/caustic.mjs`, `lab/run-caustic.mjs`, `lab/run-caustic2.mjs`

```
F_Φ(x) = min           ( h_Φ(v) − ⟨v,x⟩ )        h_Φ(v) = sup ⟨v,y⟩
         v ∈ Z²\{0}                                        y∈Φ
```
K_Φ is the corner locus of F_Φ. Two traps: `v = 0` must be excluded or F ≡ 0 on
Φ; and non-primitive `v = ku` never wins strictly inside Φ, which is where the
Farey/Stern-Brocot structure comes from.

F is a min of affine functions, so it is concave, its superlevel sets are convex
polygons with integer normals, and the caustic is the trace of their corners as
they shrink — which is why the vertices are trivalent (each is an edge
vanishing).

Unit test: a square has rational-slope sides, so its caustic must be finite.
Ours returns exactly the two diagonals, 4 edges meeting at the centre. Verified
independently against a raster of the argmin field.

**Verdict: park it.** The tropical offset of a disk is essentially a square
(front edge counts 508 → 8 → 8 → 4), so the tree's infinitude is crushed into a
boundary layer and the canonical caustic of a smooth convex body is an X with an
invisible fringe. The mathematics is lovely; the composition is thin. The
sandpile's many-point version is the same circle of ideas and fills the page.

## 3. Quadratic differential trajectories — good, not groundbreaking

`lab/quaddiff.mjs`, `lab/evenspace.mjs`, `lab/run-qd*.mjs`

Horizontal trajectories of Q(z)dz²: `Im ∫√Q dw = const`, i.e. `dz/dt = 1/√Q`.

The point is that this is a **line field**, not a vector field — √Q is
two-valued — so the singularities have *half-integer* index. At a simple zero of
Q exactly three trajectories meet at 120°. A smooth vector field cannot make a
3-pronged singularity, ever; that trivalent mark is the visual signature and it
is forced by the square root. The bold seams are the critical graph; at special
phases it snaps shut zero-to-zero (Boutroux / Chebotarëv continuum).

Verification: prong directions 0°/120°/240°, gaps 120.0/120.0/120.0, and
`Im(⅔z^{3/2})` constant along a trajectory to 6 decimals.

Two bugs worth remembering: the trace launches *through* the zero unless the
initial sign is chosen analytically against the outward radial; and streamline
spacing needs real Jobard–Lefer (commit points only when a line finishes)
rather than an occupancy grid, or a few long trajectories claim the plane.

Escalation not yet done: spectral networks (Gaiotto–Moore–Neitzke), where
sweeping the phase *creates* new walls — wall-crossing made visible.

## 4. Arctic phenomena — strong, held in reserve

`lab/aztec.mjs`, `lab/marks.mjs`, `lab/arctic.mjs`

Exact uniform random domino tilings of the Aztec diamond by domino shuffling
(Elkies–Kuperberg–Larsen–Propp): O(n²), exactly uniform, no Markov chain.
Drawn as welded pen strokes of a single domino class, it gives a solid mass
dissolving into speckle along a razor-sharp circular arc — the arctic circle
theorem. Nothing in the algorithm mentions a circle.

Two traps recorded: the shuffle consumes *more* than n(n+1)/2 coins, because a
bad block's contents are destroyed and resampled, so it is not a bijection on
tilings — only measure-preserving; and newly created dominoes must join the
covered set immediately, since diagonal neighbours in the same parity class
overlap.

The Glauber/plane-partition route (`arctic.mjs`) is included as a cautionary
tale: it silently returned unmixed samples. The complementation symmetry
π ↦ c−π forces E[volume] = abc/2 *exactly*, which caught it at 59% of the true
value. These models come with exact identities — use them as unit tests.

## 5. Imaginary geometry — mechanism excellent, output too familiar

`lab/gff.mjs`, `lab/run-gff*.mjs`

Flow lines of the Gaussian free field, θ(z) = h(z)/χ + θ₀ (Miller–Sheffield).
Log-correlated, hence exactly scale-invariant — verified, covariance affine in
log r with R² = 0.977. Flow lines of the same angle *merge* as a theorem, which
a smooth field cannot do by uniqueness of ODE solutions; merging also cut the
plot from 669k to 25k segments. Composition control by adding a *harmonic*
function, which moves where the tree goes while leaving the fluctuation intact.

**Verdict: rejected on output, and the mechanism claim was overstated too.**

A merging tree in a random field lands in the same visual family as river
networks and DLA. But the sharper correction came from the adversarial pass and
it is worth recording, because it bears on `flow-field.ts` directly:

fBm sums octaves with amplitude pⁿ at frequency lⁿ, an envelope of
|k|^(−log(1/p)/log l). At the repo's defaults — **persistence 0.5, lacunarity
2** — that is exactly |k|^(−1), which is precisely the 2D GFF's amplitude
spectrum. The repo's default simplex fBm is a *band-limited Gaussian free
field*. The claim that a noise field structurally cannot be scale-invariant was
wrong.

What is true is a matter of degree, and `lab/bandtest.mjs` measures it —
truncating a true 1/|k| field to a finite octave band and refitting covariance
against log r:

| octaves | scale range | R² of log-correlation |
|---|---|---|
| 2 |   4:1 | 0.674 |
| 3 |   8:1 | 0.809 |
| 4 |  16:1 | 0.926 |
| 5 |  32:1 | 0.982 |
| 7 | 128:1 | 0.989 |
| ∞ |   all | 0.995 |

A3 at a 0.3mm nib resolves ~990:1, about 10 octaves. So the repo's default of
**4 octaves covers only 16:1** and is measurably not scale-free — but raising
`octaves` to 5–7, a knob that already exists, gets most of the way to a real
GFF for free. That is the actionable finding, and it is worth more than the
module would have been.

The genuinely GFF-only property is the *merging theorem*. But merging here was
imposed with an occupancy grid, not derived — so even that was a rule written
by hand, and the same rule bolted onto the existing flow field would give a
comparable drawing.

(Note: the FFT is radix-2 and now throws on a non-power-of-two size — it
silently produced NaN before.)

## 6. Convex integration — weakest

`lab/corrugate.mjs`, `lab/run-corr*.mjs`

Nash–Kuiper corrugation in the explicit Borrelli–Jabrane–Lazarus–Thibert form.
Force a curve's length up by ripples whose amplitude is set exactly by
`J₀(α) = 1/r`, because ⟨cos(α cos t)⟩ = J₀(α). Iterate at geometrically
increasing frequency for ripples at every scale. Bessel inversion verified to 5
decimals; a 4-stage tower hits 5.997× against a target of 6.

**Verdict: park it.** In single-pen 2D one corrugated loop is a hairy ring. The
regime matters — the first stage's amplitude is ≈ αL/(πN) and must be small
against the radius, or the curve simply wanders off. Possible future job:
corrugating a whole hatching field rather than one loop.

---

## Rejected without prototyping

Surveyed and stress-tested, kept here so they are not re-proposed: CLE loop
ensembles and percolation interfaces (rendering discipline is the only novelty);
UST Peano curves (one step from a maze); KPZ/Busemann geodesic trees (reads as
a river network); Kleinian limit sets and Poincaré-disc tilings (thoroughly
mined); plain hat-monotile plots (everywhere since 2023); Viro patchworking
(polymake already ships it).

The adversarial pass killed 17 of 24 candidates. Survivors worth keeping on the
list, with the fix each needs: **Arctic / non-intersecting path ensembles**
(beauty 8 — and its prescribed fix, "ink one worm family, not all N", is
independently what §4 arrived at empirically); **Uniaxial**, Lang tree-method
origami circle–river packings (8); **Drape**, Chebyshev nets and the 2π
obstruction driven by discrete conical charges (8); **Wave Grain**, random-wave
grain with a chirped wavelength and the separatrices used as invisible
terminators rather than stroked (8); **Outer Billiard Web**, the singular set of
a piecewise isometry in exact Z[ζ_n] arithmetic (7); **Phason**, dislocated
quasicrystals where the grid curves are the drawing and the tiling is absent (7).

Still on the frontier list, unbuilt:

- **The Badlands** — the dense wall region of a rank-2 cluster scattering
  diagram. Bridgeland's own figure marks the interesting region with two
  literal dots. Never drawn.
- **Ammann bars on the hat monotile** — 2024 mathematics, three families of
  straight bars with Fibonacci spacing forced by a single seed tile.
- **Spectral minimal partitions** — equal-angle networks with angles quantised
  to 2π/ν and a parity obstruction; published only as small colour-filled cell
  plots, never as lines.
- **The SL₂ line configuration** from the 2025 resolution of the 3D Kakeya
  conjecture. No picture of it exists anywhere.
- **Novikov's problem** — chaotic plane sections of triply periodic surfaces;
  a single unbounded non-self-intersecting curve, with a fractal structure of
  stability zones on the direction sphere.
