import { Preview } from '../../components/Preview';
import { useFrame } from '../../FrameContext';
import { useNoiseTexture } from './context';

/** Canvas pane for the Noise Texture project. When the band mask is in draw
 * mode, dragging the canvas lays down the band centreline. */
export function NoiseTextureCanvas() {
  const { generated, state, addMaskPoint } = useNoiseTexture();
  const { frame } = useFrame();
  const drawing = state.maskMode === 'band' && state.drawMode;
  return (
    <Preview
      svgContent={generated.svg}
      width={generated.width}
      height={generated.height}
      paintMode={drawing}
      paintedPoints={state.maskMode === 'band' ? state.maskPath : []}
      showDots={state.maskMode === 'band' && state.maskPath.length > 0}
      onPaint={addMaskPoint}
      background={frame.paperTone}
    />
  );
}
