import { FrameControls } from './FrameControls';
import { PostProcessingControls } from './PostProcessingControls';

/**
 * The 'Shared' settings view: everything that applies to every tool — the page
 * frame (paper, margin, border, texture) and pen-plotting post-processing.
 * Shown when the sidebar's Tool / Shared switch is set to Shared.
 */
export function SharedControls() {
  return (
    <div className="shared-controls">
      <h3 className="section-title">Page</h3>
      <FrameControls />

      <h3 className="section-title section-title-spaced">Post-processing</h3>
      <PostProcessingControls />
    </div>
  );
}
