import { Preview } from '../../components/Preview';
import { useFrame } from '../../FrameContext';
import { useLenia } from './context';

/** Canvas pane for the Lenia project: the rendered sheet on the shared paper
 * tone, with a small plate caption (preview-only — never part of the plotted
 * SVG). */
export function LeniaCanvas() {
  const { generated, state } = useLenia();
  const { frame } = useFrame();

  const exposure = state.longExposure ? ' · long exposure' : '';
  const caption = `${state.preset} · R${state.kernelRadius} · ${state.steps} steps${exposure} · seed ${state.seed}`;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        width: '100%',
        height: '100%',
        minHeight: 0,
        gap: '0.6rem',
      }}
    >
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
      {state.artStyle && (
        <div
          style={{
            alignSelf: 'center',
            flex: '0 0 auto',
            paddingBottom: '0.4rem',
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontStyle: 'italic',
            fontSize: '0.8rem',
            letterSpacing: '0.02em',
            color: 'var(--text-secondary)',
            opacity: 0.85,
          }}
        >
          {caption}
        </div>
      )}
    </div>
  );
}
