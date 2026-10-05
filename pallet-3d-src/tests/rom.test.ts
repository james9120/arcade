import { describe, expect, it } from "vitest";
import {
  FIRERED_US_V10,
  METATILE_BYTES,
  NUM_METATILES_IN_PRIMARY,
  NUM_METATILES_TOTAL,
  NUM_PALS_IN_PRIMARY,
  NUM_PALS_TOTAL,
  NUM_TILES_IN_PRIMARY,
  NUM_TILES_TOTAL,
  PALETTE_BYTES,
  TILE_BYTES,
  type FireredTable,
} from "../src/rom/constants";
import { RomError } from "../src/rom/error";
import { normalizeRom, readHeader } from "../src/rom/header";
import { decompressLz77 } from "../src/rom/lz77";
import { loadFireRedTown, parseTown } from "../src/rom/map";
import { decodeText } from "../src/rom/text";
import { decodePalettes, renderMetatile } from "../src/rom/tiles";

describe("header", () => {
  it("rejects a file that is not FireRed US v1.0", () => {
    const leaf = headerRom("BPGE", 0);
    expect(() => readHeader(leaf)).toThrow(/BPGE/);

    const later = headerRom("BPRE", 1);
    expect(() => readHeader(later)).toThrow(/revision 1/);

    const tiny = new Uint8Array(8);
    expect(() => readHeader(tiny)).toThrow(/too small/);

    const short = headerRom("BPRE", 0);
    expect(() => readHeader(short)).toThrow(/shorter/);
  });

  it("strips a 512-byte copier prefix before checking the header", () => {
    const raw = new Uint8Array(512 + 0x100);
    raw.set(ascii("BPRE"), 512 + 0xac);
    const normalized = normalizeRom(raw);
    expect(normalized.length).toBe(0x100);
    expect(String.fromCharCode(...normalized.subarray(0xac, 0xb0))).toBe("BPRE");
  });
});

describe("lz77", () => {
  it("decodes literals and a back-reference", () => {
    const literals = Uint8Array.from([0x10, 2, 0, 0, 0x00, 0x48, 0x69]);
    expect([...decompressLz77(literals, 0)]).toEqual([0x48, 0x69]);

    const repeated = Uint8Array.from([0x10, 6, 0, 0, 0x10, 0x61, 0x62, 0x63, 0x00, 0x02]);
    expect([...decompressLz77(repeated, 0)]).toEqual([0x61, 0x62, 0x63, 0x61, 0x62, 0x63]);
  });

  it("rejects a block that is not LZ77", () => {
    expect(() => decompressLz77(Uint8Array.from([0x00, 1, 0, 0]), 0)).toThrow(RomError);
  });
});

describe("text and tiles", () => {
  it("decodes the English letter range and stops at 0xFF", () => {
    expect(decodeText(Uint8Array.from([0xbb, 0xbc, 0x00, 0xd5, 0xff, 0xbd]))).toBe("AB a");
    expect(decodeText(Uint8Array.from([0xa1, 0xaa, 0xae]))).toBe("09-");
  });

  it("paints a 4bpp tile through a BGR555 palette", () => {
    const tiles = new Uint8Array(32);
    tiles[0] = 0x01;
    const palettes = decodePalettes(Uint8Array.of(0x00, 0x00, 0x1f, 0x00), 0, 1);
    const entries = new Uint8Array(16);
    const image = renderMetatile({ tiles, palettes, entries });
    expect(image[0]).toBe(255);
    expect(image[1]).toBe(0);
    expect(image[2]).toBe(0);
    expect(image[3]).toBe(255);
    expect(image[4]).toBe(0);
  });
});

describe("synthetic town", () => {
  it("reads collision, tall grass, names, and a north connection from a handmade ROM", () => {
    const aligned = buildFixture(0);
    expect(() => loadFireRedTown(aligned.rom)).toThrow(/shorter/);

    const town = parseTown(aligned.rom, aligned.table);
    expect(town.mode).toBe("rom");
    expect(town.width).toBe(4);
    expect(town.height).toBe(6);
    expect(town.cells[0].encounter).toBe(true);
    expect(town.cells[0].wild).toBe("north");
    expect(town.cells[0].pixels?.[0]).toBe(255);
    expect(town.cells[3 * 4 + 0].wild).toBe("local");
    expect(town.cells[3 * 4 + 2].blocked).toBe(true);
    expect(town.cells[5 * 4 + 2].visual).toBe("water");
    expect(town.cells[5 * 4 + 2].blocked).toBe(true);
    expect(town.spawnX).toBe(1);
    expect(town.spawnY).toBe(5);
    expect(town.player.name).toBe("PIP");
    expect(town.player.baseHp).toBe(40);
    expect(town.player.level).toBe(5);
    expect(town.wildLocal[0]).toMatchObject({ name: "MOSS", minLevel: 4, maxLevel: 6, baseHp: 22 });
    expect(town.wildNorth[0]).toMatchObject({ name: "QUILL", minLevel: 2, maxLevel: 2 });
  });

  it("aligns the north strip with the connection offset", () => {
    const shifted = buildFixture(1);
    const town = parseTown(shifted.rom, shifted.table);
    expect(town.cells[0].blocked).toBe(true);
    expect(town.cells[0].encounter).toBe(false);
    expect(town.cells[1].encounter).toBe(true);
    expect(town.cells[1].wild).toBe("north");
  });

  it("keeps the published US v1.0 table addresses stable", () => {
    expect(FIRERED_US_V10.mapGroups).toBe(0x083526a8);
    expect(FIRERED_US_V10.speciesInfo).toBe(0x08254784);
    expect(FIRERED_US_V10.speciesNames).toBe(0x08245ee0);
    expect(FIRERED_US_V10.wildMonHeaders).toBe(0x083c9cb8);
    expect(FIRERED_US_V10.speciesInfoStride).toBe(28);
    expect(FIRERED_US_V10.palletGroup).toBe(3);
    expect(FIRERED_US_V10.palletMap).toBe(0);
  });
});

function headerRom(code: string, version: number): Uint8Array {
  const rom = new Uint8Array(0x100);
  rom.set(ascii(code), 0xac);
  rom[0xb2] = 0x96;
  rom[0xbc] = version;
  return rom;
}

function ascii(text: string): Uint8Array {
  return Uint8Array.from([...text].map((char) => char.charCodeAt(0)));
}

function buildFixture(northOffset: number): { rom: Uint8Array; table: FireredTable } {
  const primaryTiles = 0x400;
  const primaryPals = primaryTiles + NUM_TILES_IN_PRIMARY * TILE_BYTES;
  const primaryMetas = align(primaryPals + NUM_PALS_IN_PRIMARY * PALETTE_BYTES);
  const primaryAttrs = primaryMetas + NUM_METATILES_IN_PRIMARY * METATILE_BYTES;
  const secondaryTiles = align(primaryAttrs + NUM_METATILES_IN_PRIMARY * 4);
  const secondaryCount = NUM_TILES_TOTAL - NUM_TILES_IN_PRIMARY;
  const secondaryMetaCount = NUM_METATILES_TOTAL - NUM_METATILES_IN_PRIMARY;
  const secondaryPals = secondaryTiles + secondaryCount * TILE_BYTES;
  const secondaryMetas = align(secondaryPals + (NUM_PALS_TOTAL - NUM_PALS_IN_PRIMARY) * PALETTE_BYTES);
  const secondaryAttrs = secondaryMetas + secondaryMetaCount * METATILE_BYTES;
  const speciesInfo = align(secondaryAttrs + secondaryMetaCount * 4);
  const speciesNames = align(speciesInfo + 4 * 28);
  const wildHeaders = align(speciesNames + 4 * 11);
  const landInfo = align(wildHeaders + 4 * 20);
  const landMons = landInfo + 8;
  const northInfo = landMons + 12 * 4;
  const northMons = northInfo + 8;
  const rom = new Uint8Array(northMons + 12 * 4);

  rom.set(ascii("BPRE"), 0xac);
  rom[0xb2] = 0x96;
  rom[0xbc] = 0;

  const pointer = (offset: number) => 0x08000000 + offset;
  writeU32(rom, 0x100 + 3 * 4, pointer(0x110));
  writeU32(rom, 0x110, pointer(0x120));
  writeU32(rom, 0x114, pointer(0x1d0));

  writeHeader(rom, 0x120, 0x140, 0x160, 0x1a0);
  writeLayout(rom, 0x140, 4, 3, 0x210, 0x250, 0x270);
  writeU32(rom, 0x160 + 8, pointer(0x180));
  rom[0x161] = 1;
  writeU16(rom, 0x180, 1);
  writeU16(rom, 0x182, 2);
  rom[0x186] = 0;
  rom[0x187] = 4;
  writeS32(rom, 0x1a0, 1);
  writeU32(rom, 0x1a4, pointer(0x1b0));
  rom[0x1b0] = 2;
  writeS32(rom, 0x1b4, northOffset);
  rom[0x1b8] = 3;
  rom[0x1b9] = 1;

  writeHeader(rom, 0x1d0, 0x1f0, 0, 0);
  writeLayout(rom, 0x1f0, 4, 3, 0x230, 0x250, 0x270);

  const entry = (id: number, collision: number) => (id & 0x3ff) | ((collision & 3) << 10);
  const pallet = [
    entry(0, 0), entry(0, 0), entry(1, 1), entry(3, 0),
    entry(3, 0), entry(3, 0), entry(3, 0), entry(3, 0),
    entry(3, 0), entry(3, 0), entry(2, 0), entry(3, 0),
  ];
  pallet.forEach((value, index) => writeU16(rom, 0x210 + index * 2, value));
  for (let index = 0; index < 12; index++) writeU16(rom, 0x230 + index * 2, entry(0, 0));

  writeTileset(rom, 0x250, primaryTiles, primaryPals, primaryMetas, primaryAttrs);
  writeTileset(rom, 0x270, secondaryTiles, secondaryPals, secondaryMetas, secondaryAttrs);
  rom[0x271] = 1;

  rom[primaryTiles] = 0x01;
  writeU16(rom, primaryPals + 2, 0x001f);
  writeU32(rom, primaryAttrs, 2);
  writeU32(rom, primaryAttrs + 8, 0x10);

  writeSpecies(rom, speciesInfo, speciesNames, 1, "PIP", [40, 30, 20, 25], 3);
  writeSpecies(rom, speciesInfo, speciesNames, 2, "MOSS", [22, 18, 14, 16], 5);
  writeSpecies(rom, speciesInfo, speciesNames, 3, "QUILL", [18, 16, 12, 14], 1);

  writeWildHeader(rom, wildHeaders, 3, 0, landInfo);
  writeWildHeader(rom, wildHeaders + 20, 3, 1, northInfo);
  rom[landInfo] = 20;
  writeU32(rom, landInfo + 4, pointer(landMons));
  rom[landMons] = 4;
  rom[landMons + 1] = 6;
  writeU16(rom, landMons + 2, 2);
  rom[northInfo] = 10;
  writeU32(rom, northInfo + 4, pointer(northMons));
  rom[northMons] = 2;
  rom[northMons + 1] = 2;
  writeU16(rom, northMons + 2, 3);

  const table: FireredTable = {
    ...FIRERED_US_V10,
    mapGroups: pointer(0x100),
    speciesInfo: pointer(speciesInfo),
    speciesNames: pointer(speciesNames),
    wildMonHeaders: pointer(wildHeaders),
    speciesCount: 8,
    wildHeaderCount: 4,
  };
  return { rom, table };
}

function writeHeader(rom: Uint8Array, at: number, layout: number, events: number, connections: number): void {
  const pointer = (offset: number) => (offset === 0 ? 0 : 0x08000000 + offset);
  writeU32(rom, at, pointer(layout));
  writeU32(rom, at + 4, pointer(events));
  writeU32(rom, at + 12, pointer(connections));
}

function writeLayout(
  rom: Uint8Array,
  at: number,
  width: number,
  height: number,
  map: number,
  primary: number,
  secondary: number,
): void {
  const pointer = (offset: number) => 0x08000000 + offset;
  writeS32(rom, at, width);
  writeS32(rom, at + 4, height);
  writeU32(rom, at + 12, pointer(map));
  writeU32(rom, at + 16, pointer(primary));
  writeU32(rom, at + 20, pointer(secondary));
}

function writeTileset(
  rom: Uint8Array,
  at: number,
  tiles: number,
  palettes: number,
  metatiles: number,
  attributes: number,
): void {
  const pointer = (offset: number) => 0x08000000 + offset;
  writeU32(rom, at + 4, pointer(tiles));
  writeU32(rom, at + 8, pointer(palettes));
  writeU32(rom, at + 12, pointer(metatiles));
  writeU32(rom, at + 20, pointer(attributes));
}

function writeSpecies(
  rom: Uint8Array,
  infoBase: number,
  nameBase: number,
  index: number,
  name: string,
  stats: number[],
  body: number,
): void {
  const info = infoBase + index * 28;
  stats.forEach((stat, statIndex) => {
    rom[info + statIndex] = stat;
  });
  rom[info + 0x19] = body;
  const encoded = [...name].map((char) => 0xbb + char.charCodeAt(0) - 65);
  const slot = nameBase + index * 11;
  encoded.forEach((byte, byteIndex) => {
    rom[slot + byteIndex] = byte;
  });
  for (let pad = encoded.length; pad < 11; pad++) rom[slot + pad] = 0xff;
}

function writeWildHeader(rom: Uint8Array, at: number, mapGroup: number, mapNum: number, info: number): void {
  rom[at] = mapGroup;
  rom[at + 1] = mapNum;
  writeU32(rom, at + 4, 0x08000000 + info);
}

function writeU16(rom: Uint8Array, offset: number, value: number): void {
  rom[offset] = value & 0xff;
  rom[offset + 1] = (value >> 8) & 0xff;
}

function writeU32(rom: Uint8Array, offset: number, value: number): void {
  rom[offset] = value & 0xff;
  rom[offset + 1] = (value >> 8) & 0xff;
  rom[offset + 2] = (value >> 16) & 0xff;
  rom[offset + 3] = (value >> 24) & 0xff;
}

function writeS32(rom: Uint8Array, offset: number, value: number): void {
  writeU32(rom, offset, value >>> 0);
}

function align(value: number): number {
  return (value + 3) & ~3;
}
