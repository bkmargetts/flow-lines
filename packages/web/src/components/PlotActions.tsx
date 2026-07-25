import { useMemo } from 'react';
import { useFrame } from '../FrameContext';
import { useComposite, useCompositeBusy, usePage } from '../LayerStore';
import { compositeLayers } from '../lib/composite';
import { computePlotStats, formatDistance, formatDuration } from '../lib/plot-stats';
import { downloadSvgText, triggerDownload } from '../lib/download';
import { sheetsZipEntries } from '../lib/tile-export';
import { tilingOptionsFromFrame, useTileLayout } from '../lib/use-tile-layout';
import { zipStore } from '../lib/zip';

/**
 * Frame-level export of the whole composited stack: one combined SVG, one
 * SVG per pen layer (namespaced `L{n}/…`) zipped for multi-pen plotting, or —
 * with "Split across sheets" on — one SVG per physical sheet, sliced from the
 * same composited result so every sheet is an exact slice of the drawing.
 */
export function PlotActions() {
  const comp = useComposite();
  const { frame } = useFrame();
  const page = usePage();
  const { layout: tileLayout } = useTileLayout();
  // Block export while a newer sheet is compositing — downloading the stale
  // one would silently mismatch the settings on screen.
  const busy = useCompositeBusy();
  const hasContent = !busy && comp.result.lines.length > 0;

  const downloadSVG = () => {
    if (!comp.exportSvg) return;
    downloadSvgText(comp.exportSvg, 'flow-lines.svg');
  };

  const downloadLayers = () => {
    const layers = compositeLayers(comp);
    if (!layers.length) return;
    const zip = zipStore(
      layers.map(({ layer, svg }) => ({
        name: `flow-lines-${layer.replace(/\//g, '-')}.svg`,
        text: svg,
      }))
    );
    triggerDownload(zip, 'flow-lines-layers.zip');
  };

  const downloadSheets = () => {
    if (!tileLayout) return;
    const entries = sheetsZipEntries(
      comp.result,
      page,
      tileLayout,
      tilingOptionsFromFrame(frame),
      comp.svgOptions,
      comp.hasLayers
    );
    triggerDownload(zipStore(entries), 'flow-lines-sheets.zip');
  };

  // Plot cost of what's on screen. Recomputed only when the composited result
  // changes — it's a full pass over every stroke.
  const stats = useMemo(
    () => (hasContent ? computePlotStats(comp.result, page.pxPerMm) : null),
    [hasContent, comp.result, page.pxPerMm]
  );

  return (
    <>
      {stats && (
        <dl className="plot-stats" aria-label="Plot estimate">
          <div>
            <dt>Strokes</dt>
            <dd>{stats.strokes.toLocaleString()}</dd>
          </div>
          <div>
            <dt>Drawn</dt>
            <dd>{formatDistance(stats.drawnMm)}</dd>
          </div>
          <div>
            <dt>Pen-up</dt>
            <dd>{formatDistance(stats.travelMm)}</dd>
          </div>
          <div>
            <dt>Est. plot</dt>
            <dd title="Rough estimate at 25mm/s drawing, 75mm/s travel — your plotter will differ">
              ~{formatDuration(stats.seconds)}
            </dd>
          </div>
        </dl>
      )}
      <div className="button-group">
      <button type="button" className="primary" disabled={!hasContent} onClick={downloadSVG}>
        Download SVG
      </button>
      <button
        type="button"
        className="secondary"
        disabled={busy || !comp.hasLayers}
        onClick={downloadLayers}
        title="One SVG per pen layer, zipped — plot each with a different pen"
      >
        Download layers (.zip)
      </button>
      {frame.tileEnabled && (
        <button
          type="button"
          className="secondary"
          disabled={!hasContent || !tileLayout}
          onClick={downloadSheets}
          title="One SVG per physical sheet, zipped — trim and assemble into the full drawing. With multiple pen layers: one folder per sheet, one registered SVG per pen inside"
        >
          Download sheets (.zip)
        </button>
      )}
      </div>
    </>
  );
}
