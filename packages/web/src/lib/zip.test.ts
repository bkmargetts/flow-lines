import { describe, it, expect } from 'vitest';
import { zipStore } from './zip';

/** Parse a store-only zip back into { name: text } by walking local headers */
async function unzipStored(blob: Blob): Promise<Record<string, string>> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  const view = new DataView(buf.buffer);
  const dec = new TextDecoder();
  const out: Record<string, string> = {};
  let p = 0;
  while (p + 4 <= buf.length && view.getUint32(p, true) === 0x04034b50) {
    const size = view.getUint32(p + 18, true); // compressed size (== uncompressed, stored)
    const nameLen = view.getUint16(p + 26, true);
    const extraLen = view.getUint16(p + 28, true);
    const nameStart = p + 30;
    const dataStart = nameStart + nameLen + extraLen;
    const name = dec.decode(buf.subarray(nameStart, nameStart + nameLen));
    out[name] = dec.decode(buf.subarray(dataStart, dataStart + size));
    p = dataStart + size;
  }
  return out;
}

describe('zipStore', () => {
  it('round-trips stored text entries', async () => {
    const entries = [
      { name: 'a.svg', text: '<svg>alpha</svg>' },
      { name: 'b.svg', text: '<svg>beta béta 🌀</svg>' },
    ];
    const blob = zipStore(entries);
    expect(blob.type).toBe('application/zip');

    const back = await unzipStored(blob);
    expect(Object.keys(back).sort()).toEqual(['a.svg', 'b.svg']);
    expect(back['a.svg']).toBe('<svg>alpha</svg>');
    expect(back['b.svg']).toBe('<svg>beta béta 🌀</svg>');
  });

  it('ends with an end-of-central-directory record naming the right count', async () => {
    const blob = zipStore([{ name: 'x.svg', text: 'x' }]);
    const buf = new Uint8Array(await blob.arrayBuffer());
    const view = new DataView(buf.buffer);
    // EOCD is the last 22 bytes (no comment)
    const eocd = buf.length - 22;
    expect(view.getUint32(eocd, true)).toBe(0x06054b50);
    expect(view.getUint16(eocd + 10, true)).toBe(1); // total entries
  });

  it('is deterministic', async () => {
    const a = await zipStore([{ name: 'f.svg', text: 'hello' }]).arrayBuffer();
    const b = await zipStore([{ name: 'f.svg', text: 'hello' }]).arrayBuffer();
    expect(new Uint8Array(a)).toEqual(new Uint8Array(b));
  });
});
