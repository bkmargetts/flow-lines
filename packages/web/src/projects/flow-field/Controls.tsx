import { Controls } from '../../components/Controls';
import { useFlowField } from './context';

/** Sidebar controls for the Flow Field project, wired to its context. */
export function FlowFieldControls() {
  const flow = useFlowField();
  return (
    <Controls
      state={flow.state}
      updateState={flow.updateState}
      randomizeSeed={flow.randomizeSeed}
      togglePaintMode={flow.togglePaintMode}
      clearPaintedPoints={flow.clearPaintedPoints}
    />
  );
}
