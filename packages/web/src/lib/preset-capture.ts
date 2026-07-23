/**
 * Capture and re-apply user-saved presets. A custom preset is a full
 * snapshot of a layer's module state — seed included, unlike the built-in
 * preset tables — so applying one reproduces the exact drawing (for
 * image-ink, given the same photo: the photo itself never lives in layer
 * state). Because it's a full snapshot, capture needs no per-module code.
 *
 * Stored and imported presets outlive state-shape changes, so application
 * is defensive: values merge onto today's `defaultState()` and anything the
 * defaults don't recognise is dropped.
 */

/** Deep-copy a layer's state for storage. State is JSON-serializable for
 *  every module (enforced by the store's design), so this never throws on
 *  registry modules; a defensive fallback keeps the app alive regardless. */
export function capturePreset(state: unknown): Record<string, unknown> {
  try {
    return structuredClone(state) as Record<string, unknown>;
  } catch {
    return JSON.parse(JSON.stringify(state)) as Record<string, unknown>;
  }
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Keep only the parts of `stored` that today's defaults recognise: keys must
 * exist in `defaults` with the same primitive typeof; plain objects recurse
 * (image-ink's nested `settings`); arrays are kept only where the default is
 * an array. Unknown keys and type mismatches vanish — that's the whole
 * versioning story for old or hand-edited presets.
 */
export function sanitizePresetState(
  stored: unknown,
  defaults: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!isPlainObject(stored)) return out;
  for (const [key, def] of Object.entries(defaults)) {
    if (!(key in stored)) continue;
    const val = stored[key];
    if (Array.isArray(def)) {
      if (Array.isArray(val)) out[key] = val;
    } else if (isPlainObject(def)) {
      if (isPlainObject(val)) out[key] = { ...def, ...sanitizePresetState(val, def) };
    } else if (typeof val === typeof def && !isPlainObject(val) && !Array.isArray(val)) {
      out[key] = val;
    }
  }
  return out;
}

/**
 * The patch to apply a stored preset to a layer: the sanitized snapshot
 * merged over a fresh `defaultState()`, so keys the preset predates get
 * today's defaults rather than surviving from the layer's current state.
 */
export function applyPreset(
  stored: unknown,
  defaults: Record<string, unknown>
): Record<string, unknown> {
  return { ...defaults, ...sanitizePresetState(stored, defaults) };
}
