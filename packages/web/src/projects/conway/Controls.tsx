import { InfoTip } from '../../components/InfoTip';
import { ColorField } from '../../components/ColorField';
import { AdvancedSection, AdvGroup } from '../../components/controls/AdvancedSection';
import { RandomiseButton } from '../../components/controls/RandomiseButton';
import { SeedControl } from '../../components/controls/SeedControl';
import { Slider } from '../../components/controls/Slider';
import { randomSeed } from '../../lib/random';
import type { ControlsProps } from '../../modules/types';
import type { ConwayState } from './types';

const CONWAY_STYLES: ConwayState['style'][] = [
  'marks',
  'contour',
  'streaks',
  'slipstream',
  'embers',
];

/** Roll a whole new exposure — style, run length, fade tiers and the art
 *  treatment all land inside their slider ranges, biased off the extremes.
 *  Cell size floors at 1.4mm (a 1mm grid over 1000+ generations is a
 *  multi-second cliff) and the three fade thresholds roll in disjoint
 *  sub-ranges so faint < medium < solid always holds. The art-style master
 *  switches and the pen/ink prefs are left alone. Exported for the genome
 *  test. */
export function randomConwayGenome(rng: () => number): Partial<ConwayState> {
  return {
    style: CONWAY_STYLES[Math.floor(rng() * CONWAY_STYLES.length)],
    seedCount: 1 + Math.floor(rng() * rng() * 8),
    generations: 200 + 20 * Math.floor(rng() * 41),
    decay: Number((0.82 + rng() * 0.15).toFixed(2)),
    cellSize: Number((1.4 + rng() * 1.6).toFixed(1)),
    gamma: Number((0.3 + rng() * 0.6).toFixed(2)),
    faintThreshold: Number((0.06 + 0.02 * Math.floor(rng() * 8)).toFixed(2)),
    mediumThreshold: Number((0.26 + 0.02 * Math.floor(rng() * 13)).toFixed(2)),
    solidThreshold: Number((0.56 + 0.02 * Math.floor(rng() * 15)).toFixed(2)),
    residueMaxCells: 2 + Math.floor(rng() * 13),
    wobble: Number((0.2 + rng() * 1.8).toFixed(1)),
    haloMm: Number((0.4 + rng() * 2.1).toFixed(1)),
    contourLevels: 3 + Math.floor(rng() * 7),
    slipstreamSpacing: Number((0.6 + 0.05 * Math.floor(rng() * 21)).toFixed(2)),
    stippleDensity: 3 + Math.floor(rng() * 10),
    hatchAngle: Math.round(-90 + rng() * 180),
    crossHatchAmount: Number((0.05 * Math.floor(rng() * 21)).toFixed(2)),
    hatchJitter: Number((0.05 * Math.floor(rng() * 21)).toFixed(2)),
    valueBands: rng() < 0.25 ? 0 : 3 + Math.floor(rng() * 4),
    offCenter: Number((0.05 * Math.floor(rng() * 21)).toFixed(2)),
    vignette: Number((0.05 * Math.floor(rng() * 15)).toFixed(2)),
  };
}

/** Sidebar controls for the Conway Long Exposure module. */
export function ConwayControls({ state, update }: ControlsProps<ConwayState>) {
  const updateState = update;
  const surprise = () => update({ ...randomConwayGenome(Math.random), seed: randomSeed() });

  return (
    <div className="controls">
      <RandomiseButton onClick={surprise} hint="One roll for a whole new exposure — or tune anything below." />

      <h3 className="section-title">Render</h3>

      <div className="control-group">
        <label>
          <span className="label-text">
            Style
            <InfoTip text="Marks: discrete per-cell strokes. Contour ridges: nested smooth contours of the light field — organic, topographic. Comet streaks: each glider's path traced as one continuous flowing line, the core left as soft contours. Slipstream: the whole exposure as evenly-spaced streamlines following the colony's motion, woven tight in the core and fanning into the tails. Embers: the trails as stipple dots — dense comet heads scattering off into sparse sparks." />
          </span>
        </label>
        <select
          value={state.style}
          onChange={(e) => updateState({ style: e.target.value as ConwayState['style'] })}
        >
          <option value="marks">Marks (discrete)</option>
          <option value="contour">Contour ridges (organic)</option>
          <option value="streaks">Comet streaks (organic)</option>
          <option value="slipstream">Slipstream (flow)</option>
          <option value="embers">Embers (stipple)</option>
        </select>
      </div>

      <div className="control-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={state.artStyle}
            onChange={(e) => updateState({ artStyle: e.target.checked })}
          />
          Art style
          <InfoTip text="The hand-drawn treatment: the present is drawn as one confident hatched mass instead of a grid of boxes, trails commit to a few tonal shapes, the composition sits off-centre on warm paper, and it prints in two or three inks. Turn off for the faithful, literal simulation render." />
        </label>
      </div>

      <Slider
        labelNode={
          <span className="label-text">
            Trail halo
            <InfoTip text="A sliver of clean paper reserved around the crisp present — history marks and trails hold back from it, so the 'now' reads with a glow. 0 lets them crowd right up to it." />
          </span>
        }
        value={state.haloMm}
        min={0}
        max={4}
        step={0.1}
        onChange={(v) => updateState({ haloMm: v })}
        format={(v) => `${v.toFixed(1)}mm`}
      />

      {state.style === 'contour' && (
        <Slider
          labelNode={
            <span className="label-text">
              Contour levels
              <InfoTip text="How many nested iso-contours trace the light field. More levels give a finer tonal gradient (denser shading); fewer give bold, sparse rings." />
            </span>
          }
          value={state.contourLevels}
          min={2}
          max={10}
          step={1}
          onChange={(v) => updateState({ contourLevels: v })}
        />
      )}

      {state.style === 'slipstream' && (
        <Slider
          labelNode={
            <span className="label-text">
              Flow line spacing
              <InfoTip text="Base separation between the flowing streamlines, in grid cells. Tone tightens it (the lines weave dense through the core) and loosens it (they fan out in the faint tails). Lower packs the lines for a woven, near-solid field; higher leaves open paper between them." />
            </span>
          }
          value={state.slipstreamSpacing}
          min={0.5}
          max={2}
          step={0.05}
          onChange={(v) => updateState({ slipstreamSpacing: v })}
          format={(v) => v.toFixed(2)}
        />
      )}

      {state.style === 'embers' && (
        <Slider
          labelNode={
            <span className="label-text">
              Dot density
              <InfoTip text="How many stipple dots a fully-exposed cell gets. Density carries the tone, so the dark comet heads cluster dense and the faint tails scatter to a spark or two. Higher builds a richer, smokier field; lower keeps it sparse and airy." />
            </span>
          }
          value={state.stippleDensity}
          min={2}
          max={16}
          step={1}
          onChange={(v) => updateState({ stippleDensity: v })}
        />
      )}

      <h3 className="section-title">Exposure</h3>

      <Slider
        labelNode={
          <span className="label-text">
            Generations
            <InfoTip text="How long the colony runs before the shutter closes. The R-pentomino stays chaotic until it burns out around generation 1100, then settles into static debris — so higher values streak the gliders further out, but past ~1100 the life goes out of the frame." />
          </span>
        }
        value={state.generations}
        min={20}
        max={1200}
        step={20}
        onChange={(v) => updateState({ generations: v })}
      />

      <Slider
        labelNode={
          <span className="label-text">
            Trail length (decay)
            <InfoTip text="How slowly the past fades. Each generation multiplies every cell's exposure by this, so higher keeps more history visible — longer comet tails — while lower leaves only the most recent moments." />
          </span>
        }
        value={state.decay}
        min={0.8}
        max={0.98}
        step={0.01}
        onChange={(v) => updateState({ decay: v })}
        format={(v) => v.toFixed(2)}
      />

      <Slider
        labelNode={
          <span className="label-text">
            Grid cell size
            <InfoTip text="Physical size of one Life cell on the page. Smaller cells mean a finer, denser grid (more marks, longer plot); larger cells make a coarser, bolder composition." />
          </span>
        }
        value={state.cellSize}
        min={1}
        max={4}
        step={0.1}
        onChange={(v) => updateState({ cellSize: v })}
        format={(v) => `${v.toFixed(1)}mm`}
      />

      <h3 className="section-title">Style</h3>

      <Slider
        labelNode={
          <span className="label-text">
            Pen Width
            <InfoTip text="Plotted line weight in millimetres — match it to the pen you'll draw with so the solid cores fill in cleanly." />
          </span>
        }
        value={state.penWidthMm}
        min={0.1}
        max={1.5}
        step={0.05}
        onChange={(v) => updateState({ penWidthMm: v })}
        format={(v) => `${v}mm`}
      />

      <div className="control-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={state.multiInk}
            onChange={(e) => updateState({ multiInk: e.target.checked })}
          />
          Multiple inks
          <InfoTip text="Draw the present, mid-tone ghosts and faint trails in different inks (e.g. near-black, warm grey, sepia). Each layer still plots with one pen, and the per-layer SVG export keeps them separate — so this is a genuine 2–3 pen plot, not a colour trick." />
        </label>
      </div>

      {state.multiInk ? (
        <>
          <ColorField
            label="Present ink"
            value={state.presentColor}
            onChange={(presentColor) => updateState({ presentColor })}
            info="Ink for the crisp present mass and the plate border — the darkest, most committed marks."
          />
          <ColorField
            label="Ghost ink"
            value={state.ghostColor}
            onChange={(ghostColor) => updateState({ ghostColor })}
            info="Ink for the mid-tone ghosts — the recent history hatching."
          />
          <ColorField
            label="Trail ink"
            value={state.trailColor}
            onChange={(trailColor) => updateState({ trailColor })}
            info="Ink for the faint comet trails — the oldest, dimmest marks."
          />
        </>
      ) : (
        <ColorField
          label="Stroke Color"
          value={state.strokeColor}
          onChange={(strokeColor) => updateState({ strokeColor })}
          info="Ink colour of the preview and exported SVG. Plotting still uses a single pen — colour is just for on-screen and paper choice."
        />
      )}


      <h3 className="section-title">Seed</h3>

      <Slider
        labelNode={
          <span className="label-text">
            Starting cells
            <InfoTip text="How many R-pentominoes detonate at the start. One sits near the centre; more are scattered across the frame, each rotated differently, so their colonies collide and interleave into a busier, more crowded exposure." />
          </span>
        }
        value={state.seedCount}
        min={1}
        max={12}
        step={1}
        onChange={(v) => updateState({ seedCount: v })}
      />

      <SeedControl seed={state.seed} onChange={(seed) => updateState({ seed })}>
        <label>
          <span className="label-text">
            Seed
            <InfoTip text="The Game of Life is deterministic — the seed only sets where the starting pentominoes sit and how they're rotated, giving a different composition without changing the rules." />
          </span>
        </label>
      </SeedControl>

      <AdvancedSection>
        <AdvGroup title="Fade & tiers">
          <Slider
            labelNode={
              <span className="label-text">
                Trail brightness (gamma)
                <InfoTip text="Lifts the faint trails so they read against the solid core. A moving cell deposits little exposure, so values below 1 brighten the comet tails; 1 leaves the raw, dimmer falloff." />
              </span>
            }
            value={state.gamma}
            min={0.2}
            max={1}
            step={0.05}
            onChange={(v) => updateState({ gamma: v })}
            format={(v) => v.toFixed(2)}
          />

          <Slider
            labelNode={
              <span className="label-text">
                Faint cutoff
                <InfoTip text="Exposure below this leaves blank paper. Raise it to silence the dimmest ghosts and keep more open space; lower it to let even faint, ancient tracks register." />
              </span>
            }
            value={state.faintThreshold}
            min={0}
            max={0.4}
            step={0.02}
            onChange={(v) => updateState({ faintThreshold: v })}
            format={(v) => v.toFixed(2)}
          />

          <Slider
            labelNode={
              <span className="label-text">
                Faint → medium
                <InfoTip text="Tone at which a single comet dash gives way to a few hatch strokes — the boundary between the faintest tracks and the mid-tone ghosts." />
              </span>
            }
            value={state.mediumThreshold}
            min={0.1}
            max={0.6}
            step={0.02}
            onChange={(v) => updateState({ mediumThreshold: v })}
            format={(v) => v.toFixed(2)}
          />

          <Slider
            labelNode={
              <span className="label-text">
                Medium → solid
                <InfoTip text="Tone at which hatching gives way to a solid filled cell — how bright a region must be before it reads as part of the crisp present rather than a ghost." />
              </span>
            }
            value={state.solidThreshold}
            min={0.4}
            max={0.9}
            step={0.02}
            onChange={(v) => updateState({ solidThreshold: v })}
            format={(v) => v.toFixed(2)}
          />
        </AdvGroup>

        <AdvGroup title="Forms & hand">
          <Slider
            labelNode={
              <span className="label-text">
                Residue cluster size
                <InfoTip text="A surviving clump this size or smaller is drawn as a crisp hollow outline (the quiet still-lifes and glider heads); anything larger is the turbulent core and fills solid." />
              </span>
            }
            value={state.residueMaxCells}
            min={1}
            max={20}
            step={1}
            onChange={(v) => updateState({ residueMaxCells: v })}
          />

          <Slider
            labelNode={
              <span className="label-text">
                Wobble
                <InfoTip text="Hand-drawn shake on the strokes. Faint old marks wobble most (haunted); the crisp final cells stay steady. 0 is ruler-straight." />
              </span>
            }
            value={state.wobble}
            min={0}
            max={3}
            step={0.1}
            onChange={(v) => updateState({ wobble: v })}
            format={(v) => `${v.toFixed(1)}px`}
          />
        </AdvGroup>

        {state.artStyle && (
          <AdvGroup title="Art — mass & composition">
            <div className="control-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={state.massCore}
                  onChange={(e) => updateState({ massCore: e.target.checked })}
                />
                Draw core as a mass
                <InfoTip text="Trace the turbulent present as one confident silhouette filled with angled hatching, instead of a grid of filled boxes. The single biggest step from 'computer' to 'drawn'." />
              </label>
            </div>

            <Slider
              labelNode={
                <span className="label-text">
                  Hatch angle
                  <InfoTip text="Direction of the strokes filling the present mass. The cross-hatch layer sits at a shallow offset to this." />
                </span>
              }
              value={state.hatchAngle}
              min={-90}
              max={90}
              step={1}
              onChange={(v) => updateState({ hatchAngle: v })}
              format={(v) => `${v}°`}
            />

            <Slider
              labelNode={
                <span className="label-text">
                  Cross-hatch amount
                  <InfoTip text="How much of the present mass gets a second layer of hatching at a shallow angle — more darkens and enriches the core; less keeps it open and linear." />
                </span>
              }
              value={state.crossHatchAmount}
              min={0}
              max={1}
              step={0.05}
              onChange={(v) => updateState({ crossHatchAmount: v })}
              format={(v) => v.toFixed(2)}
            />

            <Slider
              labelNode={
                <span className="label-text">
                  Hatch jitter
                  <InfoTip text="Low-frequency variation in hatch spacing and phase, so the fill reads as a hand laying down strokes rather than an even mechanical screen." />
                </span>
              }
              value={state.hatchJitter}
              min={0}
              max={1}
              step={0.05}
              onChange={(v) => updateState({ hatchJitter: v })}
              format={(v) => v.toFixed(2)}
            />

            <Slider
              labelNode={
                <span className="label-text">
                  Value bands
                  <InfoTip text="Commit the trail tones to this many decisive value shapes instead of continuous photographic gradation — the artist's tonal abstraction. 0 keeps continuous tone." />
                </span>
              }
              value={state.valueBands}
              min={0}
              max={6}
              step={1}
              onChange={(v) => updateState({ valueBands: v })}
              format={(v) => (v === 0 ? 'Continuous' : v)}
            />

            <Slider
              labelNode={
                <span className="label-text">
                  Off-centre
                  <InfoTip text="Bias a single detonation toward a rule-of-thirds point so the composition isn't dead-centre, leaving negative space on the open side. 0 centres it. (No effect with multiple starting cells — those already scatter.)" />
                </span>
              }
              value={state.offCenter}
              min={0}
              max={1}
              step={0.05}
              onChange={(v) => updateState({ offCenter: v })}
              format={(v) => v.toFixed(2)}
            />

            <Slider
              labelNode={
                <span className="label-text">
                  Corner vignette
                  <InfoTip text="Hold faint marks off the frame corners so the negative space reads as a decision. Higher clears more; 0 lets trails run to the edges." />
                </span>
              }
              value={state.vignette}
              min={0}
              max={1}
              step={0.05}
              onChange={(v) => updateState({ vignette: v })}
              format={(v) => v.toFixed(2)}
            />
          </AdvGroup>
        )}
      </AdvancedSection>
    </div>
  );
}
