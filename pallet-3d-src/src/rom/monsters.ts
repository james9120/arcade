import type { DecodedSprite, HeroSprite, LearnedMove } from "../game/types";
import { fileOffset, readU16, readU32, readU8, sliceBytes } from "./bytes";
import type { FireredTable } from "./constants";
import { RomError } from "./error";
import { decompressLz77 } from "./lz77";
import { decodeText } from "./text";
import { decodePalettes, renderSprite, type Rgb } from "./tiles";

const FALLBACK_MOVE: LearnedMove = {
  name: "Strike",
  power: 4,
  typeId: 0,
  typeName: "",
};

export interface SpeciesProfile {
  name: string;
  species: number;
  baseHp: number;
  baseAttack: number;
  baseDefense: number;
  baseSpeed: number;
  typeIds: number[];
  typeNames: string[];
  move: LearnedMove;
  front: DecodedSprite | null;
  back: DecodedSprite | null;
}

export function readSpeciesProfile(
  rom: Uint8Array,
  table: FireredTable,
  species: number,
  level: number,
): SpeciesProfile {
  if (species <= 0 || species >= table.speciesCount) {
    throw new RomError("A species index in the ROM is outside the US v1.0 table.");
  }
  const info = fileOffset(rom, table.speciesInfo) + species * table.speciesInfoStride;
  const nameOffset = fileOffset(rom, table.speciesNames) + species * table.speciesNameStride;
  const name = decodeText(sliceBytes(rom, nameOffset, table.speciesNameStride));
  if (!/[A-Za-z0-9]/.test(name)) {
    throw new RomError(
      "Species names at the US v1.0 table didn't decode. This may not be an unmodified v1.0 ROM.",
    );
  }
  const typeIds = [readU8(rom, info + 6), readU8(rom, info + 7)];
  return {
    name,
    species,
    baseHp: readU8(rom, info),
    baseAttack: readU8(rom, info + 1),
    baseDefense: readU8(rom, info + 2),
    baseSpeed: readU8(rom, info + 3),
    typeIds,
    typeNames: typeIds.map((id) => readTypeName(rom, table, id)),
    move: readBestMove(rom, table, species, level),
    front: readMonSprite(rom, table.frontPicTable, table.monPalettes, species),
    back: readMonSprite(rom, table.backPicTable, table.monPalettes, species),
  };
}

export function readTypeChart(rom: Uint8Array, table: FireredTable): number[] {
  if (table.typeChart === 0) return [];
  const start = fileOffset(rom, table.typeChart);
  const chart: number[] = [];
  for (let index = 0; index < 600; index++) {
    const value = readU8(rom, start + index);
    if (value === 0xff) break;
    chart.push(value);
  }
  return chart;
}

export function typeMultiplier(chart: readonly number[], attackType: number, defenderTypes: readonly number[]): number {
  let scale = 1;
  for (const defender of defenderTypes) {
    scale *= pairMultiplier(chart, attackType, defender);
  }
  return scale;
}

export function readHero(rom: Uint8Array, table: FireredTable): HeroSprite | null {
  if (table.objectGraphics === 0 || table.objectPalettes === 0) return null;
  const infoPointer = readU32(rom, fileOffset(rom, table.objectGraphics));
  const info = fileOffset(rom, infoPointer);
  const width = readU16(rom, info + 8);
  const height = readU16(rom, info + 10);
  if (width < 8 || height < 8 || width > 64 || height > 64) {
    throw new RomError("The player overworld sprite in this ROM isn't a size this page can draw.");
  }
  const paletteTag = readU16(rom, info + 2);
  const palette = findObjectPalette(rom, table, paletteTag);
  const images = fileOffset(rom, readU32(rom, info + 0x1c));
  const frameBytes = (width * height) / 2;
  const frames: Uint8ClampedArray[] = [];
  for (let index = 0; index < 12; index++) {
    const pointer = readU32(rom, images + index * 8);
    const size = readU16(rom, images + index * 8 + 4);
    if (size !== frameBytes || pointer === 0) break;
    const raw = sliceBytes(rom, fileOffset(rom, pointer), size);
    frames.push(renderSprite(raw, palette, width, height));
  }
  if (frames.length < 3) {
    throw new RomError("Couldn't read the player overworld sprite from this ROM.");
  }
  return { width, height, frames };
}

function pairMultiplier(chart: readonly number[], attackType: number, defenderType: number): number {
  for (let index = 0; index + 2 < chart.length; index += 3) {
    if (chart[index] === attackType && chart[index + 1] === defenderType) {
      return chart[index + 2] / 10;
    }
  }
  return 1;
}

function readTypeName(rom: Uint8Array, table: FireredTable, typeId: number): string {
  if (table.typeNames === 0) return "";
  const offset = fileOffset(rom, table.typeNames) + typeId * table.typeNameStride;
  return decodeText(sliceBytes(rom, offset, table.typeNameStride)).trim();
}

function readBestMove(rom: Uint8Array, table: FireredTable, species: number, level: number): LearnedMove {
  if (table.levelUpLearnsets === 0 || table.battleMoves === 0 || table.moveNames === 0) {
    return FALLBACK_MOVE;
  }
  const listPointer = readU32(rom, fileOffset(rom, table.levelUpLearnsets) + species * 4);
  if (listPointer === 0) return FALLBACK_MOVE;
  const list = fileOffset(rom, listPointer);
  let first: LearnedMove | null = null;
  let best: LearnedMove | null = null;
  for (let index = 0; index < 40; index++) {
    const raw = readU16(rom, list + index * 2);
    const moveId = raw & 0x1ff;
    const moveLevel = raw >> 9;
    if (moveLevel === 0x7f || moveId === 0) break;
    const move = readBattleMove(rom, table, moveId);
    if (!first) first = move;
    if (moveLevel <= level && move.power > 0 && (!best || move.power >= best.power)) best = move;
  }
  return best ?? first ?? FALLBACK_MOVE;
}

function readBattleMove(rom: Uint8Array, table: FireredTable, moveId: number): LearnedMove {
  const at = fileOffset(rom, table.battleMoves) + moveId * 12;
  const typeId = readU8(rom, at + 2);
  return {
    name: decodeText(sliceBytes(rom, fileOffset(rom, table.moveNames) + moveId * table.moveNameStride, table.moveNameStride)),
    power: readU8(rom, at + 1),
    typeId,
    typeName: readTypeName(rom, table, typeId),
  };
}

function readMonSprite(
  rom: Uint8Array,
  picTable: number,
  paletteTable: number,
  species: number,
): DecodedSprite | null {
  if (picTable === 0 || paletteTable === 0) return null;
  const entry = fileOffset(rom, picTable) + species * 8;
  const pointer = readU32(rom, entry);
  if (pointer === 0) return null;
  const raw = decompressLz77(rom, fileOffset(rom, pointer));
  const side = spriteSide(raw.length);
  const palettePointer = readU32(rom, fileOffset(rom, paletteTable) + species * 8);
  const paletteRaw = decompressLz77(rom, fileOffset(rom, palettePointer));
  const palette = decodePalettes(paletteRaw, 0, 1)[0];
  if (!palette) return null;
  return {
    width: side,
    height: side,
    pixels: renderSprite(raw, palette, side, side),
  };
}

function spriteSide(byteLength: number): number {
  const pixels = byteLength * 2;
  const side = Math.round(Math.sqrt(pixels));
  const tiled = side - (side % 8);
  if (tiled >= 8 && tiled * tiled === pixels) return tiled;
  return 64;
}

function findObjectPalette(rom: Uint8Array, table: FireredTable, tag: number): Rgb[] {
  const start = fileOffset(rom, table.objectPalettes);
  for (let index = 0; index < 80; index++) {
    const at = start + index * 8;
    const pointer = readU32(rom, at);
    if (pointer === 0) break;
    if (readU16(rom, at + 4) !== tag) continue;
    const bytes = sliceBytes(rom, fileOffset(rom, pointer), 32);
    const palette = decodePalettes(bytes, 0, 1)[0];
    if (!palette) break;
    return palette;
  }
  throw new RomError("Couldn't find the player overworld palette in this ROM.");
}
