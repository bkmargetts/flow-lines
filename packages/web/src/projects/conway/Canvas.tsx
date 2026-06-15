import { Preview } from '../../components/Preview';
import { useConway } from './context';

/** Canvas pane for the Conway Long Exposure project: the rendered sheet,
 * presented on warm paper with a small plate caption (both preview-only —
 * never part of the plotted SVG). */
export function ConwayCanvas() {
  const { generated, state } = useConway();

  const subject =
    state.seedCount > 1 ? `${state.seedCount} R-pentominoes` : 'R-pentomino';
  const caption = `${subject} · gen ${state.generations} · seed ${state.seed}`;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.6rem',
      }}
    >
      <div
        style={{
          // A faint paper grain behind the sheet — soft enough not to fight
          // the ink, and purely cosmetic (the SVG itself carries the paper rect).
          padding: state.artStyle ? '1.4rem' : 0,
          background: state.artStyle
            ? `radial-gradient(circle at 30% 25%, rgba(0,0,0,0.035), transparent 60%), ${state.paperTone}`
            : 'transparent',
          boxShadow: state.artStyle ? '0 2px 14px rgba(0,0,0,0.18)' : 'none',
          borderRadius: 2,
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
        />
      </div>
      {state.artStyle && (
        <div
          style={{
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontStyle: 'italic',
            fontSize: '0.8rem',
            letterSpacing: '0.02em',
            color: '#6b6b66',
            opacity: 0.85,
          }}
        >
          {caption}
        </div>
      )}
    </div>
  );
}
