import type { Point } from '@flow-lines/core';
import { useMemo, useState } from 'react';
import { Preview } from './Preview';
import { useFrame } from '../FrameContext';
import { tilingOptionsFromFrame, useTileLayout } from '../lib/use-tile-layout';
import { buildAssembledPreview, buildSheetsPreview } from '../lib/tile-preview';
import { useComposite, useCompositeBusy, useLayerStore, usePage } from '../LayerStore';
import { useInstanceApi } from '../projects/image-ink/instance-store';
import type { ImageInkLayerState } from '../projects/image-ink/types';

/**
 * The single composited sheet for the whole layer stack, on the shared paper
 * tone. Canvas interaction is surfaced for the *selected* layer only: an
 * Image→Ink layer gets focus-point selection (tap the subject), wired to its
 * per-instance api. Other modules render without interaction.
 */
/** A layer state that supports drawing a band centreline on the canvas
 *  (the grating / noise-texture modules: a `drawMode` toggle + `maskPath`). */
interface DrawableState {
  drawMode: boolean;
  maskPath: Point[];
}
function isDrawable(state: unknown): state is DrawableState {
  return (
    !!state &&
    typeof (state as DrawableState).drawMode === 'boolean' &&
    Array.isArray((state as DrawableState).maskPath)
  );
}

export function PlotCanvas() {
  const { frame } = useFrame();
  const { layers, selectedId, updateState } = useLayerStore();
  const comp = useComposite();
  const compositing = useCompositeBusy();
  const page = usePage();
  const { layout: tileGrid } = useTileLayout();

  // Split view: 'sheets' shows each page separately (what the export zip
  // contains); 'assembled' composes them at their final taped positions —
  // the total expected sheet, for judging how each page pieces into the
  // larger plot. Presentation-only, so plain local state (never part of the
  // frame snapshot/undo history).
  const [assembledView, setAssembledView] = useState(false);

  // Split preview: the sheets themselves, each with its clear per-page
  // margin, artwork continuing across the printable areas — what the export
  // zip will actually contain. Null when splitting is off (or its settings
  // are degenerate), which falls back to the continuous single-sheet view.
  const sheetsPreview = useMemo(() => {
    if (!frame.tileEnabled || !tileGrid || comp.result.lines.length === 0) return null;
    const build = assembledView ? buildAssembledPreview : buildSheetsPreview;
    return build(
      comp.result,
      page,
      tileGrid,
      tilingOptionsFromFrame(frame),
      comp.svgOptions,
      frame.paperTone
    );
  }, [frame, tileGrid, comp, page, assembledView]);

  const selected = layers.find((l) => l.instanceId === selectedId);
  const isInk = selected?.moduleId === 'image-ink';
  // Hook called unconditionally; '' yields null when the selection isn't ink.
  const api = useInstanceApi(isInk ? selectedId : '');

  // Band-drawing for the selected grating/noise-texture layer: the canvas drag
  // appends the centreline to its `maskPath` (in canvas px, what `onPaint`
  // gives), so "Draw line" actually draws. Inert for modules without a band.
  const drawable = !isInk && selected && isDrawable(selected.state) ? selected.state : null;
  const paintMode = Boolean(drawable?.drawMode);
  const maskPath = drawable?.maskPath ?? [];
  const onPaint = (point: Point) => {
    if (!drawable) return;
    // Functional update so a fast drag never drops points.
    updateState(selectedId, (cur) => ({
      maskPath: [...(cur as DrawableState).maskPath, point],
    }));
  };

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

  // Empty stack → prompt to add a layer. A lone Image→Ink layer with no photo
  // yet → prompt to upload (its composite is empty until an image lands).
  const emptyHint =
    layers.length === 0
      ? 'Add a layer to begin — pick a module below the layer list.'
      : isInk && api != null && !api.sourceImage && comp.result.lines.length === 0
        ? 'Upload an image to render it as pen-and-ink strokes.'
        : null;

  return (
    <>
      {(api?.isRendering || compositing) && <div className="rendering-badge">Rendering…</div>}
      {sheetsPreview && (
        <div className="preview-mode-toggle">
          <button
            type="button"
            className={assembledView ? '' : 'active'}
            onClick={() => setAssembledView(false)}
          >
            Sheets
          </button>
          <button
            type="button"
            className={assembledView ? 'active' : ''}
            onClick={() => setAssembledView(true)}
          >
            Assembled
          </button>
        </div>
      )}
      {emptyHint ? (
        <div className="empty-state">
          <p>{emptyHint}</p>
        </div>
      ) : (
        <Preview
          svgContent={sheetsPreview ? sheetsPreview.svg : comp.previewSvg}
          width={sheetsPreview ? sheetsPreview.width : comp.width}
          height={sheetsPreview ? sheetsPreview.height : comp.height}
          // Canvas interactions map taps to single-sheet artwork coordinates,
          // which don't exist in the sheets layout — toggle the split off to
          // paint or pick focus points.
          paintMode={sheetsPreview ? false : paintMode}
          paintedPoints={sheetsPreview ? [] : maskPath}
          showDots={!sheetsPreview && (paintMode || maskPath.length > 0)}
          onPaint={onPaint}
          focusSelectMode={sheetsPreview ? false : focusSelectMode}
          focusMarkers={sheetsPreview ? [] : focusMarkers}
          onSetFocus={onSetFocus}
          // The sheets draw their own paper; the stage shows through the
          // gutters between pages.
          background={sheetsPreview ? undefined : frame.paperTone}
        />
      )}
    </>
  );
}
