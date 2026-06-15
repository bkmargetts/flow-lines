/**
 * Minimal, dependency-free ZIP writer (store / no compression).
 *
 * The web app has no archive library, and the one transitive `adm-zip` is
 * Node-only. A store-only archive is all we need to hand the user one file
 * containing several layer SVGs — text compresses poorly enough that the lack
 * of DEFLATE barely matters for a handful of small SVGs, and the writer stays
 * tiny and deterministic (fixed timestamps).
 */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Growable little-endian byte buffer */
class ByteWriter {
  private chunks: Uint8Array[] = [];
  length = 0;

  u16(v: number): void {
    this.chunks.push(new Uint8Array([v & 0xff, (v >>> 8) & 0xff]));
    this.length += 2;
  }
  u32(v: number): void {
    this.chunks.push(
      new Uint8Array([v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff])
    );
    this.length += 4;
  }
  bytes(b: Uint8Array): void {
    this.chunks.push(b);
    this.length += b.length;
  }
  concat(): Uint8Array<ArrayBuffer> {
    const out = new Uint8Array(new ArrayBuffer(this.length));
    let offset = 0;
    for (const c of this.chunks) {
      out.set(c, offset);
      offset += c.length;
    }
    return out;
  }
}

export interface ZipEntry {
  name: string;
  /** UTF-8 text content */
  text: string;
}

/** Pack text entries into a stored (uncompressed) ZIP blob */
export function zipStore(entries: ZipEntry[]): Blob {
  const encoder = new TextEncoder();
  const w = new ByteWriter();
  const central: Array<{ name: Uint8Array; crc: number; size: number; offset: number }> = [];

  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const data = encoder.encode(entry.text);
    const crc = crc32(data);
    const offset = w.length;

    // Local file header
    w.u32(0x04034b50);
    w.u16(20); // version needed
    w.u16(0); // flags
    w.u16(0); // method: store
    w.u16(0); // mod time (fixed → deterministic)
    w.u16(0); // mod date
    w.u32(crc);
    w.u32(data.length); // compressed size
    w.u32(data.length); // uncompressed size
    w.u16(name.length);
    w.u16(0); // extra length
    w.bytes(name);
    w.bytes(data);

    central.push({ name, crc, size: data.length, offset });
  }

  const centralStart = w.length;
  for (const c of central) {
    w.u32(0x02014b50);
    w.u16(20); // version made by
    w.u16(20); // version needed
    w.u16(0); // flags
    w.u16(0); // method
    w.u16(0); // time
    w.u16(0); // date
    w.u32(c.crc);
    w.u32(c.size);
    w.u32(c.size);
    w.u16(c.name.length);
    w.u16(0); // extra
    w.u16(0); // comment
    w.u16(0); // disk number
    w.u16(0); // internal attrs
    w.u32(0); // external attrs
    w.u32(c.offset);
    w.bytes(c.name);
  }
  const centralSize = w.length - centralStart;

  // End of central directory
  w.u32(0x06054b50);
  w.u16(0); // disk
  w.u16(0); // disk with central dir
  w.u16(central.length);
  w.u16(central.length);
  w.u32(centralSize);
  w.u32(centralStart);
  w.u16(0); // comment length

  return new Blob([w.concat()], { type: 'application/zip' });
}
