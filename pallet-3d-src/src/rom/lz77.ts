import { RomError } from "./error";

const MAX_OUTPUT = 262144;

/**
 * GBA BIOS LZ77 (compression type 0x10). Used for tileset graphics.
 * Flag bits are consumed most-significant first. A set bit is a 2-byte
 * back-reference: length = high nibble + 3, distance = low 12 bits + 1.
 */
export function decompressLz77(src: Uint8Array, offset: number): Uint8Array {
  if (offset < 0 || offset >= src.length || src[offset] !== 0x10) {
    throw new RomError("Expected compressed graphics and found a different block.");
  }
  if (offset + 4 > src.length) {
    throw new RomError("Compressed graphics ended early.");
  }
  const size = src[offset + 1] | (src[offset + 2] << 8) | (src[offset + 3] << 16);
  if (size <= 0 || size > MAX_OUTPUT) {
    throw new RomError("A compressed block in the ROM is an unexpected size.");
  }

  const out = new Uint8Array(size);
  let inPos = offset + 4;
  let outPos = 0;

  while (outPos < size) {
    if (inPos >= src.length) throw new RomError("Compressed graphics ended early.");
    const flags = src[inPos++];
    for (let bit = 7; bit >= 0 && outPos < size; bit--) {
      const isBackref = ((flags >> bit) & 1) === 1;
      if (!isBackref) {
        if (inPos >= src.length) throw new RomError("Compressed graphics ended early.");
        out[outPos++] = src[inPos++];
        continue;
      }
      if (inPos + 1 >= src.length) throw new RomError("Compressed graphics ended early.");
      const first = src[inPos++];
      const second = src[inPos++];
      const length = (first >> 4) + 3;
      const distance = (((first & 0x0f) << 8) | second) + 1;
      if (distance <= 0 || distance > outPos) {
        throw new RomError("Compressed graphics in the ROM are malformed.");
      }
      for (let i = 0; i < length && outPos < size; i++) {
        out[outPos] = out[outPos - distance];
        outPos++;
      }
    }
  }

  return out;
}
