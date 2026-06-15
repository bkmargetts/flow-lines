import { Preview } from '../../components/Preview';
import { useFrame } from '../../FrameContext';
import { useImageInk } from './context';

/** Canvas pane for the Image → Ink project: the rendered sheet (or the
 * upload prompt), with focus-point selection wired to its context. */
export function ImageInkCanvas() {
  const ink = useImageInk();
  const { frame } = useFrame();
  const { generated, inkLayout, sourceImage, focusPoints, settings } = ink;

  if (!sourceImage) {
    return (
      <div className="empty-state">
        <p>Upload an image to render it as pen-and-ink strokes.</p>
      </div>
    );
  }

  return (
    <>
      {ink.isRendering && <div className="rendering-badge">Rendering…</div>}
      <Preview
        svgContent={generated.svg}
        width={generated.width}
        height={generated.height}
        paintMode={false}
        paintedPoints={[]}
        showDots={false}
        onPaint={() => {}}
        background={frame.paperTone}
        focusSelectMode={!!sourceImage}
        focusMarkers={
          inkLayout
            ? focusPoints.map((point) => ({
                x: inkLayout.rect.x + point.x * inkLayout.contentW,
                y: inkLayout.rect.y + point.y * inkLayout.contentH,
                radius:
                  (settings.focusRadiusPct / 100) *
                  Math.min(inkLayout.contentW, inkLayout.contentH),
              }))
            : []
        }
        onSetFocus={(point) => {
          if (!inkLayout) return;
          // Map the page-pixel tap back to a coordinate normalised to the
          // photo (its content rect), so border taps are ignored gracefully
          ink.setFocus({
            x: (point.x - inkLayout.rect.x) / inkLayout.contentW,
            y: (point.y - inkLayout.rect.y) / inkLayout.contentH,
          });
        }}
      />
    </>
  );
}
