import { Preview } from '../../components/Preview';
import { useFrame } from '../../FrameContext';
import { useConway } from './context';

/** Canvas pane for the Conway Long Exposure project: the rendered sheet on the
 * shared paper tone, with a small plate caption (preview-only — never part of
 * the plotted SVG). */
export function ConwayCanvas() {
  const { generated, state } = useConway();
  const { frame } = useFrame();

  const subject =
    state.seedCount > 1 ? `${state.seedCount} R-pentominoes` : 'R-pentomino';
  const caption = `${subject} · gen ${state.generations} · seed ${state.seed}`;

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
