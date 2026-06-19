import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Guardrail: every slider's value must be click-to-type editable.
 *
 * Each `<input type="range">` config control should render its value badge
 * through the shared `EditableValue` component so the number can be clicked
 * and typed (see CLAUDE.md). This test scans the web source and fails if any
 * `.tsx` file has more range sliders than `<EditableValue>` wrappers — i.e. a
 * slider was added without making its value editable. It keeps the convention
 * enforced in CI instead of relying on reviewers to remember it.
 */

const srcDir = fileURLToPath(new URL('.', import.meta.url));

function tsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...tsxFiles(p));
    else if (entry.name.endsWith('.tsx') && !entry.name.endsWith('.test.tsx')) out.push(p);
  }
  return out;
}

const rangeRe = /type=["']range["']/g;
const editableRe = /<EditableValue[\s>]/g;

describe('every range slider has an editable value', () => {
  const files = tsxFiles(srcDir).filter((f) => (readFileSync(f, 'utf8').match(rangeRe) ?? []).length > 0);

  it('finds files with sliders to check (sanity)', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    const rel = file.slice(srcDir.length);
    it(`${rel}: each <input type="range"> is wrapped in <EditableValue>`, () => {
      const src = readFileSync(file, 'utf8');
      const sliders = (src.match(rangeRe) ?? []).length;
      const editables = (src.match(editableRe) ?? []).length;
      expect(
        editables,
        `${rel} has ${sliders} range slider(s) but only ${editables} <EditableValue>; ` +
          'wrap every slider value in EditableValue (see CLAUDE.md).',
      ).toBeGreaterThanOrEqual(sliders);
    });
  }
});
