import { Preview } from '../../components/Preview';
import { useFrame } from '../../FrameContext';
import { useFlowField } from './context';

/** Canvas pane for the Flow Field project: the rendered sheet with optional
 * paint-to-seed interaction. */
export function FlowFieldCanvas() {
  const flow = useFlowField();
  const { frame } = useFrame();
  const { generated, state } = flow;
  return (
    <Preview
      svgContent={generated.svg}
      width={generated.width}
      height={generated.height}
      paintMode={state.paintMode}
      paintedPoints={state.paintedPoints}
      showDots={state.showDots}
      onPaint={flow.addPaintedPoint}
      background={frame.paperTone}
    />
  );
}
