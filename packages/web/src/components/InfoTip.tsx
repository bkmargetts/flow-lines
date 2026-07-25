import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

/**
 * A small "ⓘ" affordance that surfaces a one-line explanation. The bubble is
 * rendered in a portal on `document.body` (fixed-positioned from the icon's
 * rect) so the sidebar's `overflow-y: auto` — and the mobile bottom sheet —
 * never clip it.
 *
 * Works on every input: hover/focus on desktop, tap to toggle on touch (the
 * native `title` tooltip it used to rely on never appears on touch devices).
 */
export function InfoTip({ text }: { text: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  // Two independent triggers that never cancel each other: `hovered` (mouse
  // hover/keyboard focus, desktop) and `pinned` (a tap, touch). Either shows it.
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const open = hovered || pinned;
  const close = useCallback(() => {
    setHovered(false);
    setPinned(false);
  }, []);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  // Only honour hover on devices that actually hover; on touch the emulated
  // pointer events would otherwise leave `hovered` stuck true (no leave event),
  // so a second tap couldn't dismiss the bubble. Touch uses `pinned` (tap) only.
  const [canHover, setCanHover] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia('(hover: hover)');
    const update = () => setCanHover(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  const place = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    // Centre under the icon, clamped so a near-edge tip stays on screen.
    const left = Math.min(Math.max(r.left + r.width / 2, 130), window.innerWidth - 130);
    setPos({ top: r.bottom + 8, left });
  }, []);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  // Close on outside interaction, scroll (the bubble is fixed and would drift),
  // resize, or Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: Event) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    const dismiss = () => close();
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', dismiss, true);
    window.addEventListener('resize', dismiss);
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', dismiss, true);
      window.removeEventListener('resize', dismiss);
    };
  }, [open, close]);

  return (
    <>
      <span
        ref={ref}
        className="info-tip"
        tabIndex={0}
        role="button"
        aria-label={text}
        aria-expanded={open}
        onPointerEnter={(e) => {
          if (canHover && e.pointerType === 'mouse') setHovered(true);
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === 'mouse') setHovered(false);
        }}
        onFocus={(e) => {
          // Only keyboard focus opens it; a tap also focuses, but touch should
          // go through the tap-toggle path instead of being pinned open here.
          if (e.target.matches(':focus-visible')) setHovered(true);
        }}
        onBlur={() => setHovered(false)}
        onClick={(e) => {
          // Don't let the tap toggle the surrounding label/summary control.
          e.preventDefault();
          e.stopPropagation();
          setPinned((p) => !p);
        }}
      >
        i
      </span>
      {open &&
        pos &&
        createPortal(
          <span
            className="info-tip-bubble"
            role="tooltip"
            style={{ top: pos.top, left: pos.left }}
          >
            {text}
          </span>,
          document.body
        )}
    </>
  );
}
