import { readAscii, readU8 } from "./bytes";
import { RomError } from "./error";

export interface RomHeader {
  code: string;
  title: string;
  version: number;
}

function codeAt(rom: Uint8Array, base: number): string {
  if (rom.length < base + 0xb0) return "";
  return readAscii(rom, base + 0xac, 4);
}

/**
 * Some dumps keep a 512-byte copier header in front of the GBA header.
 * If the game code isn't at 0xAC, shift a copy that has it at 0x2AC.
 */
export function normalizeRom(rom: Uint8Array): Uint8Array {
  if (codeAt(rom, 0) === "BPRE") return rom;
  if (rom.length > 512 && codeAt(rom, 512) === "BPRE") return rom.subarray(512);
  return rom;
}

export function readHeader(rom: Uint8Array): RomHeader {
  if (rom.length < 0xc0) {
    throw new RomError("That file is too small to be a Game Boy Advance ROM.");
  }
  const code = readAscii(rom, 0xac, 4);
  const title = readAscii(rom, 0xa0, 12).trim();
  const version = readU8(rom, 0xbc);
  const fixed = readU8(rom, 0xb2);

  if (code !== "BPRE") {
    const shown = code.replace(/[^\x20-\x7e]/g, "").trim();
    throw new RomError(
      shown
        ? `This ROM's game code is "${shown}", not FireRed US (BPRE). Choose a FireRed USA v1.0 file.`
        : "This file doesn't have a FireRed header. Choose a .gba ROM.",
    );
  }
  if (fixed !== 0x96) {
    throw new RomError("The header isn't a valid Game Boy Advance ROM (the fixed identifier is missing).");
  }
  if (version !== 0) {
    throw new RomError(
      `This is FireRed revision ${version}. This prototype only reads US v1.0 (revision byte 0).`,
    );
  }
  if (rom.length < 0x1000000) {
    throw new RomError("This file is shorter than FireRed US v1.0, which is a 16 MB ROM.");
  }
  return { code, title, version };
}
