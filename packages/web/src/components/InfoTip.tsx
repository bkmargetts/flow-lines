/**
 * A small "ⓘ" affordance that surfaces a one-line explanation on hover/focus.
 * Uses the native `title` tooltip so it is never clipped by the sidebar's
 * `overflow-y: auto` (a CSS-positioned tooltip would be), and exposes the same
 * text to assistive tech via `aria-label`.
 */
export function InfoTip({ text }: { text: string }) {
  return (
    <span className="info-tip" tabIndex={0} role="img" aria-label={text} title={text}>
      i
    </span>
  );
}
