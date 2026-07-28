import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MODULES } from '../modules/registry';
import { CATEGORY_ORDER, CATEGORY_LABELS } from '../modules/categories';
import { previewUrl } from '../modules/previews';

/**
 * The browse-all layer picker: a full-screen overlay of module cards — real
 * rendered thumbnails grouped under category headings, with a search box.
 * Rendered in a portal on `document.body` (like InfoTip's bubble) so the
 * sidebar's `overflow-y: auto` and the mobile bottom sheet never clip it.
 */
export function ModulePicker({
  onPick,
  onClose,
}: {
  /** Called with the chosen module id; the caller adds the layer and closes. */
  onPick: (moduleId: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => searchRef.current?.focus(), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Category sections in CATEGORY_ORDER; module order within a section follows
  // the registry (so Image → Ink stays first without reordering MODULES).
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = (m: (typeof MODULES)[number]) =>
      !q || `${m.label} ${m.description} ${m.id}`.toLowerCase().includes(q);
    return CATEGORY_ORDER.map((cat) => ({
      cat,
      mods: MODULES.filter((m) => m.category === cat && matches(m)),
    })).filter((g) => g.mods.length > 0);
  }, [query]);

  const first = groups[0]?.mods[0];

  return createPortal(
    <div className="module-picker-backdrop" onClick={onClose}>
      <div
        className="module-picker"
        role="dialog"
        aria-modal="true"
        aria-label="Add a layer"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="module-picker-head">
          <input
            ref={searchRef}
            type="search"
            placeholder="Search modules…"
            aria-label="Search modules"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && first) onPick(first.id);
            }}
          />
          <button type="button" className="module-picker-close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="module-picker-body">
          {groups.length === 0 && <p className="layer-empty">No modules match “{query}”.</p>}
          {groups.map(({ cat, mods }) => (
            <section key={cat}>
              <h4 className="section-title">{CATEGORY_LABELS[cat]}</h4>
              <div className="module-grid">
                {mods.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className="module-card"
                    onClick={() => onPick(m.id)}
                  >
                    <img src={previewUrl(m.id)} alt="" loading="lazy" />
                    <span className="module-card-label">{m.label}</span>
                    <span className="module-card-desc">{m.description}</span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}
