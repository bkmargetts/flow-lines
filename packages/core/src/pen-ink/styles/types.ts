import type { PenInkOptions } from '../options.js';

/**
 * An artist style: a whole coherent philosophy of ink rendering, expressed
 * as a curated option bundle. A style is data, not code — every capability
 * it turns on is an ordinary `PenInkOptions` field (inert by default), so
 * styles compose with explicit user overrides, serialize, and stay
 * identical across the web app and the CLI.
 */
export interface PenInkStyle {
  id: string;
  label: string;
  /** One-line statement of the style's philosophy, surfaced as UI hint text */
  description: string;
  options: Partial<PenInkOptions>;
}
