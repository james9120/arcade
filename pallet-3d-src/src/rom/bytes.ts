import { RomError } from "./error";

export function readU8(rom: Uint8Array, offset: number): number {
  if (offset < 0 || offset >= rom.length) {
    throw new RomError("The ROM ended before a value this prototype needed.");
  }
  return rom[offset];
}

export function readU16(rom: Uint8Array, offset: number): number {
  if (offset < 0 || offset + 2 > rom.length) {
    throw new RomError("The ROM ended before a value this prototype needed.");
  }
  return rom[offset] | (rom[offset + 1] << 8);
}

export function readU32(rom: Uint8Array, offset: number): number {
  if (offset < 0 || offset + 4 > rom.length) {
    throw new RomError("The ROM ended before a value this prototype needed.");
  }
  return (
    (rom[offset] |
      (rom[offset + 1] << 8) |
      (rom[offset + 2] << 16) |
      (rom[offset + 3] << 24)) >>>
    0
  );
}

export function readS32(rom: Uint8Array, offset: number): number {
  const value = readU32(rom, offset);
  return value > 0x7fffffff ? value - 0x100000000 : value;
}

export function sliceBytes(rom: Uint8Array, offset: number, length: number): Uint8Array {
  if (offset < 0 || length < 0 || offset + length > rom.length) {
    throw new RomError(
      "The ROM ended in the middle of a map or creature table. It may be truncated, or it isn't US v1.0.",
    );
  }
  return rom.subarray(offset, offset + length);
}

/** Map a GBA ROM pointer (0x08xxxxxx / 0x09xxxxxx) to a file offset. */
export function fileOffset(rom: Uint8Array, pointer: number): number {
  if (pointer === 0) {
    throw new RomError("The ROM is missing a pointer this prototype needed.");
  }
  const bank = pointer >>> 24;
  if (bank !== 0x08 && bank !== 0x09) {
    throw new RomError("A pointer in the ROM doesn't point at ROM data.");
  }
  const offset = pointer & 0x01ffffff;
  if (offset >= rom.length) {
    throw new RomError("A pointer in the ROM falls outside the file.");
  }
  return offset;
}

export function optionalFileOffset(rom: Uint8Array, pointer: number): number | null {
  if (pointer === 0) return null;
  return fileOffset(rom, pointer);
}

export function readAscii(rom: Uint8Array, offset: number, length: number): string {
  const bytes = sliceBytes(rom, offset, length);
  let out = "";
  for (const byte of bytes) {
    if (byte === 0) break;
    out += String.fromCharCode(byte);
  }
  return out;
}
