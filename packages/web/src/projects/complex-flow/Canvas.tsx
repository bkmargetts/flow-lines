import { Preview } from '../../components/Preview';
import { useFrame } from '../../FrameContext';
import { useComplexFlow } from './context';

/** Canvas pane for Complex Flow: the rendered sheet with tap-to-place poles &
 * zeros. Reuses Preview's paint plumbing — zeros show as dots (paintedPoints),
 * poles as dashed circles (focusMarkers). */
export function ComplexFlowCanvas() {
  const cf = useComplexFlow();
  const { frame } = useFrame();
  const { generated, state } = cf;
  return (
    <Preview
      svgContent={generated.svg}
      width={generated.width}
      height={generated.height}
      paintMode={state.placeMode}
      paintedPoints={state.showSingularities ? state.manualZeros : []}
      showDots={state.showSingularities}
      onPaint={cf.addSingularity}
      focusMarkers={
        state.showSingularities
          ? state.manualPoles.map((p) => ({ x: p.x, y: p.y, radius: 8 }))
          : []
      }
      background={state.background === 'dark' ? '#0d0d12' : frame.paperTone}
    />
  );
}
