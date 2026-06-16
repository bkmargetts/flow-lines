import { toSVGLayers } from '@flow-lines/core';
import { usePostProcess } from '../PostProcessContext';
import { useOutput } from '../OutputContext';
import { downloadSvgText, triggerDownload } from '../lib/download';
import { zipStore } from '../lib/zip';
import { InfoTip } from './InfoTip';

/**
 * Shared Output / Post-processing section, mounted once in the shell so every
 * project tab gets the same finishing controls and download buttons. Density
 * protection caps how many pen passes pile onto one patch of paper; the active
 * project registers its current plot so the download buttons work uniformly.
 */
export function PostProcessingControls() {
  const { post, updateDensity } = usePostProcess();
  const { output } = useOutput();
  const density = post.density;
  const stats = output?.densityStats;

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
    <div className="post-controls">
      <div className="control-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={density.enabled}
            onChange={(e) => updateDensity({ enabled: e.target.checked })}
          />
          Density protection
          <InfoTip text="Caps how many pen passes land on the same patch of paper. A little overlap builds texture; too much inflates plot time and breaks the paper down. Removed strokes are shown ghosted in the plot window so you can see the impact." />
        </label>
      </div>

      {density.enabled && (
        <>
          <div className="control-group">
            <label>
              Max overlapping passes <span>{density.maxPasses}</span>
            </label>
            <input
              type="range"
              min="1"
              max="8"
              step="1"
              value={density.maxPasses}
              onChange={(e) => updateDensity({ maxPasses: parseInt(e.target.value, 10) })}
            />
          </div>
          <p className="post-readout">
            {stats && stats.enabled
              ? stats.removedCount > 0
                ? `Removed ${stats.removedCount} stroke${stats.removedCount === 1 ? '' : 's'} · saved ~${Math.round(stats.removedTravelMm)}mm of pen travel`
                : 'No overlapping strokes to remove at this limit.'
              : 'Adjust the limit; removed strokes appear ghosted in red.'}
          </p>
        </>
      )}

      <div className="button-group">
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
            Download layers (.zip)
          </button>
        )}
      </div>
    </div>
  );
}
