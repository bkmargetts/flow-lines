import { toSVGLayers } from '@flow-lines/core';
import { useOutput } from '../OutputContext';
import { downloadSvgText, triggerDownload } from '../lib/download';
import { zipStore } from '../lib/zip';

/**
 * The plot's download action, pinned to the bottom of the sidebar and shared by
 * every tool. The active project registers its current output, so this stays
 * reachable whichever settings (tool or shared) are on screen. Download is an
 * action, not configuration, so it lives apart from the settings groups.
 */
export function DownloadBar() {
  const { output } = useOutput();
  const canDownload = !!output?.exportSvg;

  const downloadSVG = (): void => {
    if (!output?.exportSvg) return;
    downloadSvgText(output.exportSvg, `${output.baseName}-${output.seed}.svg`);
  };

  const downloadLayers = (): void => {
    if (!output?.result) return;
    const layers = toSVGLayers(output.result, output.svgOptions);
    const zip = zipStore(
      layers.map(({ layer, svg }) => ({ name: `${output.baseName}-${output.seed}-${layer}.svg`, text: svg }))
    );
    triggerDownload(zip, `${output.baseName}-${output.seed}-layers.zip`);
  };

  return (
    <div className="download-bar">
      <button type="button" className="primary" onClick={downloadSVG} disabled={!canDownload}>
        Download SVG
      </button>
      {output?.hasLayers && (
        <button
          type="button"
          className="secondary"
          onClick={downloadLayers}
          title="One SVG per pen layer, zipped — plot each with a different pen"
        >
          Layers (.zip)
        </button>
      )}
    </div>
  );
}
