import { usePostProcess } from '../PostProcessContext';
import { useOutput } from '../OutputContext';
import { InfoTip } from './InfoTip';

/**
 * Post-processing settings shared by every tool: pen-plotting density
 * protection. Caps how many pen passes pile onto one patch of paper. A little
 * overlap builds texture; too much inflates plot time and breaks the paper
 * down. The active project registers its output so the readout can report the
 * impact; the download action itself lives in the pinned DownloadBar.
 */
export function PostProcessingControls() {
  const { post, updateDensity } = usePostProcess();
  const { output } = useOutput();
  const density = post.density;
  const stats = output?.densityStats;

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
    </div>
  );
}
