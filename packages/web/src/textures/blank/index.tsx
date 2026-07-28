import type { ControlsProps, PureModule } from '../../modules/types';
import { renderBlankTexture, type BlankParams } from './render';

/**
 * The blank template module — a documented starting point. Copy this folder to
 * build a new pure module: give it state + Controls, and a React-free `render`
 * (in `render.ts`) that maps state to lines. It renders nothing on its own.
 */
function BlankControls(_props: ControlsProps<BlankParams>) {
  return (
    <p className="paint-hint">
      A blank layer — nothing is drawn. This is the template module: copy{' '}
      <code>src/textures/blank</code> to build a new pure module (state +
      Controls + a React-free <code>render</code> in <code>render.ts</code>).
    </p>
  );
}

export const blankTexture: PureModule<BlankParams> = {
  kind: 'pure',
  id: 'blank',
  label: 'Blank (template)',
  category: 'textures',
  description: 'Empty module, the template for new ones',
  defaultState: () => ({}),
  Controls: BlankControls,
  render: renderBlankTexture,
  // Pure textures hold off `env.avoid` themselves (blank trivially so — it
  // draws nothing), so the compositor must not also trim their output.
  consumesAvoid: true,
};
