import { Preview } from '../../components/Preview';
import { useConway } from './context';

/** Canvas pane for the Conway Long Exposure project: the rendered sheet. */
export function ConwayCanvas() {
  const { generated } = useConway();
  return (
    <Preview
      svgContent={generated.svg}
      width={generated.width}
      height={generated.height}
      paintMode={false}
      paintedPoints={[]}
      showDots={false}
      onPaint={() => {}}
    />
  );
}
