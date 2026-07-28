/**
 * Picker thumbnails, one PNG per module id — regenerate with `pnpm previews`
 * (repo root; see module-previews.test.ts). Bundled as hashed assets so the
 * GitHub Pages base path and cache-busting are handled by Vite, and
 * module-previews.test.ts guarantees a PNG exists for every registered module.
 */
const urls = import.meta.glob('./previews/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

export function previewUrl(id: string): string | undefined {
  return urls[`./previews/${id}.png`];
}
