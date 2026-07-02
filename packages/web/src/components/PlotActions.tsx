import { useComposite, useCompositeBusy } from '../LayerStore';
import { compositeLayers } from '../lib/composite';
import { downloadSvgText, triggerDownload } from '../lib/download';
import { zipStore } from '../lib/zip';

/**
 * Frame-level export of the whole composited stack: one combined SVG, or one
 * SVG per pen layer (namespaced `L{n}/…`) zipped for multi-pen plotting.
 * Replaces each project's own download buttons.
 */
export function PlotActions() {
  const comp = useComposite();
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
    </div>
  );
}
