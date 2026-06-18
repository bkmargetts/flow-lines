import { Preview } from '../../components/Preview';
import { useFrame } from '../../FrameContext';
import { useNoiseTexture } from './context';

/** Canvas pane for the Noise Texture project: the rendered swatch sheet.
 * Paint-to-draw-a-path is wired here later; for now swatches are straight. */
export function NoiseTextureCanvas() {
  const { generated } = useNoiseTexture();
  const { frame } = useFrame();
  return (
    <Preview
      svgContent={generated.svg}
      width={generated.width}
      height={generated.height}
      paintMode={false}
      paintedPoints={[]}
      showDots={false}
      onPaint={() => {}}
      background={frame.paperTone}
    />
  );
}
