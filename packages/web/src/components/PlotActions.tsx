import { toSVG, sliceResultIntoTiles, tileLabel, TILE_MARKS_LAYER, type SVGOptions } from '@flow-lines/core';
import { useFrame } from '../FrameContext';
import { useComposite, useCompositeBusy, usePage } from '../LayerStore';
import { compositeLayers } from '../lib/composite';
import { downloadSvgText, triggerDownload } from '../lib/download';
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
    const opts = tilingOptionsFromFrame(frame);
    const tiles = sliceResultIntoTiles(comp.result, page, tileLayout, opts);
    const zip = zipStore(
      tiles.map((t) => {
        const svgOptions: SVGOptions = {
          ...comp.svgOptions,
          physicalWidth: t.physicalWidth,
          physicalHeight: t.physicalHeight,
          ...(opts.registrationMarks
            ? {
                layerColors: {
                  ...comp.svgOptions.layerColors,
                  [TILE_MARKS_LAYER]: comp.svgOptions.strokeColor ?? '#111111',
                },
              }
            : {}),
        };
        return {
          name: `flow-lines-${tileLabel(t.tile)}.svg`,
          text: toSVG(t.result, svgOptions),
        };
      })
    );
    triggerDownload(zip, 'flow-lines-sheets.zip');
  };

  return (
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
          title="One SVG per physical sheet, zipped — trim and assemble into the full drawing"
        >
          Download sheets (.zip)
        </button>
      )}
    </div>
  );
}
