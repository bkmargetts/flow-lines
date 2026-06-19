import type { Point } from '@flow-lines/core';
import { Preview } from './Preview';
import { useFrame } from '../FrameContext';
import { useComposite, useLayerStore } from '../LayerStore';
import { useInstanceApi } from '../projects/image-ink/instance-store';
import type { ImageInkLayerState } from '../projects/image-ink/types';

/**
 * The single composited sheet for the whole layer stack, on the shared paper
 * tone. Canvas interaction is surfaced for the *selected* layer only: an
 * Image→Ink layer gets focus-point selection (tap the subject), wired to its
 * per-instance api. Other modules render without interaction.
 */
export function PlotCanvas() {
  const { frame } = useFrame();
  const { layers, selectedId } = useLayerStore();
  const comp = useComposite();

  const selected = layers.find((l) => l.instanceId === selectedId);
  const isInk = selected?.moduleId === 'image-ink';
  // Hook called unconditionally; '' yields null when the selection isn't ink.
  const api = useInstanceApi(isInk ? selectedId : '');

  const inkLayout = api?.inkLayout ?? null;
  const settings = isInk ? (selected!.state as ImageInkLayerState).settings : null;

  const focusSelectMode = Boolean(isInk && api?.sourceImage);
  const focusMarkers =
    inkLayout && settings && api
      ? api.focusPoints.map((point) => ({
          x: inkLayout.rect.x + point.x * inkLayout.contentW,
          y: inkLayout.rect.y + point.y * inkLayout.contentH,
          radius:
            (settings.focusRadiusPct / 100) *
            Math.min(inkLayout.contentW, inkLayout.contentH),
        }))
      : [];

  const onSetFocus = (point: Point) => {
    if (!inkLayout || !api) return;
    // Map the page-pixel tap back to a coordinate normalised to the photo's
    // content rect, so border taps are ignored gracefully.
    api.setFocus({
      x: (point.x - inkLayout.rect.x) / inkLayout.contentW,
      y: (point.y - inkLayout.rect.y) / inkLayout.contentH,
    });
  };

  const showUploadHint = isInk && api != null && !api.sourceImage && layers.length === 1;

  return (
    <>
      {api?.isRendering && <div className="rendering-badge">Rendering…</div>}
      {showUploadHint ? (
        <div className="empty-state">
          <p>Upload an image to render it as pen-and-ink strokes.</p>
        </div>
      ) : (
        <Preview
          svgContent={comp.previewSvg}
          width={comp.width}
          height={comp.height}
          paintMode={false}
          paintedPoints={[]}
          showDots={false}
          onPaint={() => {}}
          focusSelectMode={focusSelectMode}
          focusMarkers={focusMarkers}
          onSetFocus={onSetFocus}
          background={frame.paperTone}
        />
      )}
    </>
  );
}
