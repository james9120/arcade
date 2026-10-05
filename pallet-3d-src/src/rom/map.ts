import type { Cell, Direction, PartyMember, PropKind, TileVisual, TownMap, WildSlot } from "../game/types";
import { fileOffset, optionalFileOffset, readS32, readU16, readU32, readU8, sliceBytes } from "./bytes";
import {
  ATTR_BEHAVIOR_MASK,
  ATTR_ENCOUNTER_MASK,
  ATTR_ENCOUNTER_SHIFT,
  CONNECTION_NORTH,
  FIRERED_US_V10,
  LAND_WILD_COUNT,
  MAPGRID_COLLISION_SHIFT,
  MAPGRID_METATILE_ID_MASK,
  MB_IMPASSABLE_EAST,
  MB_IMPASSABLE_NORTH,
  MB_IMPASSABLE_SOUTH,
  MB_IMPASSABLE_WEST,
  MB_JUMP_EAST,
  MB_JUMP_NORTH,
  MB_JUMP_SOUTH,
  MB_JUMP_WEST,
  MB_TALL_GRASS,
  METATILE_BYTES,
  NUM_METATILES_IN_PRIMARY,
  NUM_METATILES_TOTAL,
  NUM_PALS_IN_PRIMARY,
  NUM_PALS_TOTAL,
  NUM_TILES_IN_PRIMARY,
  NUM_TILES_TOTAL,
  PALETTE_BYTES,
  TILE_BYTES,
  TILE_ENCOUNTER_LAND,
  type FireredTable,
} from "./constants";
import { RomError } from "./error";
import { normalizeRom, readHeader } from "./header";
import { decompressLz77 } from "./lz77";
import { readHero, readSpeciesProfile, readTypeChart } from "./monsters";
import { decodePalettes, renderMetatile, type Rgb } from "./tiles";

const WATER_BEHAVIORS = new Set([
  0x10, 0x11, 0x12, 0x13, 0x15, 0x16, 0x17, 0x19, 0x1a, 0x1b,
]);

const JUMP_DIRECTION: Record<number, Direction> = {
  [MB_JUMP_EAST]: "e",
  [MB_JUMP_WEST]: "w",
  [MB_JUMP_NORTH]: "n",
  [MB_JUMP_SOUTH]: "s",
};

const BLOCK_DIRECTION: Record<number, Direction> = {
  [MB_IMPASSABLE_EAST]: "e",
  [MB_IMPASSABLE_WEST]: "w",
  [MB_IMPASSABLE_NORTH]: "n",
  [MB_IMPASSABLE_SOUTH]: "s",
};

interface RawMap {
  width: number;
  height: number;
  cells: Cell[];
  warps: Warp[];
  north: { mapGroup: number; mapNum: number; offset: number } | null;
}

interface Warp {
  x: number;
  y: number;
  mapNum: number;
  mapGroup: number;
}

interface TilesetGraphics {
  pointer: number;
  tiles: Uint8Array;
  palettes: Rgb[][];
  metatiles: Uint8Array;
  attributes: Uint32Array;
  cache: Map<number, Uint8ClampedArray>;
}

export function loadFireRedTown(buffer: Uint8Array): TownMap {
  const rom = normalizeRom(buffer);
  const header = readHeader(rom);
  try {
    return parseTown(rom, FIRERED_US_V10, header.title);
  } catch (error) {
    if (error instanceof RomError) throw error;
    throw new RomError("Something in this ROM didn't match the US v1.0 layout.");
  }
}

export function parseTown(rom: Uint8Array, table: FireredTable, headerTitle = ""): TownMap {
  const pallet = readMap(rom, table, table.palletGroup, table.palletMap);
  if (table === FIRERED_US_V10 && (pallet.width < 10 || pallet.height < 10)) {
    throw new RomError(
      "The map table didn't point at a town-sized layout. This file may not be an unmodified US v1.0 ROM.",
    );
  }

  let northMap: RawMap | null = null;
  let northSlots: WildSlot[] = [];
  if (pallet.north) {
    try {
      northMap = readMap(rom, table, pallet.north.mapGroup, pallet.north.mapNum);
      northSlots = readWildSlots(rom, table, pallet.north.mapGroup, pallet.north.mapNum);
    } catch (error) {
      if (!(error instanceof RomError)) throw error;
      northMap = null;
      northSlots = [];
    }
  }

  const localSlots = readWildSlots(rom, table, table.palletGroup, table.palletMap);
  const stitched = stitchNorth(pallet, northMap, pallet.north?.offset ?? 0);
  const spawn = findSpawn(
    stitched.cells,
    stitched.width,
    stitched.height,
    pallet.warps,
    stitched.rowShift,
    table.indoorPalletGroup,
  );
  const starters = [table.starterA, table.starterB, table.starterC]
    .filter((species) => species > 0)
    .map((species) => readPartyMember(rom, table, species, table.partnerLevel));
  if (starters.length === 0) {
    throw new RomError("This ROM didn't contain a partner species to walk with.");
  }

  const title = headerTitle ? `Pallet Town · ${headerTitle}` : "Pallet Town";
  return {
    title,
    mode: "rom",
    modeDetail: "ROM · FireRed US v1.0",
    width: stitched.width,
    height: stitched.height,
    cells: stitched.cells,
    spawnX: spawn.x,
    spawnY: spawn.y,
    player: starters[0],
    starters,
    wildLocal: localSlots,
    wildNorth: northSlots,
    hero: readHero(rom, table),
    chart: readTypeChart(rom, table),
  };
}

function readMap(rom: Uint8Array, table: FireredTable, mapGroup: number, mapNum: number): RawMap {
  const groups = fileOffset(rom, table.mapGroups);
  const groupList = fileOffset(rom, readU32(rom, groups + mapGroup * 4));
  const header = fileOffset(rom, readU32(rom, groupList + mapNum * 4));
  const layout = fileOffset(rom, readU32(rom, header));
  const width = readS32(rom, layout);
  const height = readS32(rom, layout + 4);
  if (width < 2 || height < 2 || width > 200 || height > 200) {
    throw new RomError("A map layout in the ROM isn't a size this prototype can draw.");
  }

  const mapData = fileOffset(rom, readU32(rom, layout + 0x0c));
  const primaryPtr = readU32(rom, layout + 0x10);
  const secondaryPtr = readU32(rom, layout + 0x14);
  const primary = loadTileset(rom, primaryPtr, "primary");
  const secondary = loadTileset(rom, secondaryPtr, "secondary");
  const combinedTiles = new Uint8Array(NUM_TILES_TOTAL * TILE_BYTES);
  combinedTiles.set(primary.tiles.subarray(0, NUM_TILES_IN_PRIMARY * TILE_BYTES));
  combinedTiles.set(secondary.tiles.subarray(0, (NUM_TILES_TOTAL - NUM_TILES_IN_PRIMARY) * TILE_BYTES), NUM_TILES_IN_PRIMARY * TILE_BYTES);
  const palettes = primary.palettes.concat(secondary.palettes);

  const cells: Cell[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const entry = readU16(rom, mapData + (y * width + x) * 2);
      cells.push(cellFromEntry(entry, primary, secondary, combinedTiles, palettes));
    }
  }

  return {
    width,
    height,
    cells,
    warps: readWarps(rom, header),
    north: readNorthLink(rom, header),
  };
}

function loadTileset(rom: Uint8Array, pointer: number, role: "primary" | "secondary"): TilesetGraphics {
  const base = fileOffset(rom, pointer);
  const compressed = readU8(rom, base) !== 0;
  const tileCount = role === "primary" ? NUM_TILES_IN_PRIMARY : NUM_TILES_TOTAL - NUM_TILES_IN_PRIMARY;
  const metatileCount = role === "primary" ? NUM_METATILES_IN_PRIMARY : NUM_METATILES_TOTAL - NUM_METATILES_IN_PRIMARY;
  const paletteCount = role === "primary" ? NUM_PALS_IN_PRIMARY : NUM_PALS_TOTAL - NUM_PALS_IN_PRIMARY;

  const tilesPointer = readU32(rom, base + 4);
  const palettePointer = readU32(rom, base + 8);
  const metatilePointer = readU32(rom, base + 0x0c);
  const attributePointer = readU32(rom, base + 0x14);

  const tiles = readTiles(rom, tilesPointer, compressed, tileCount);
  const paletteOffset = fileOffset(rom, palettePointer);
  const paletteBytes = sliceBytes(rom, paletteOffset, paletteCount * PALETTE_BYTES);
  const palettes = decodePalettes(paletteBytes, 0, paletteCount);
  const metatiles = sliceBytes(rom, fileOffset(rom, metatilePointer), metatileCount * METATILE_BYTES);
  const attributeBytes = sliceBytes(rom, fileOffset(rom, attributePointer), metatileCount * 4);
  const attributes = new Uint32Array(metatileCount);
  for (let i = 0; i < metatileCount; i++) {
    attributes[i] =
      (attributeBytes[i * 4] |
        (attributeBytes[i * 4 + 1] << 8) |
        (attributeBytes[i * 4 + 2] << 16) |
        (attributeBytes[i * 4 + 3] << 24)) >>>
      0;
  }

  return {
    pointer,
    tiles,
    palettes,
    metatiles,
    attributes,
    cache: new Map(),
  };
}

function readTiles(rom: Uint8Array, pointer: number, compressed: boolean, tileCount: number): Uint8Array {
  const offset = fileOffset(rom, pointer);
  const needed = tileCount * TILE_BYTES;
  if (!compressed) {
    const raw = sliceBytes(rom, offset, needed);
    return new Uint8Array(raw);
  }
  const decoded = decompressLz77(rom, offset);
  if (decoded.length < needed) {
    const padded = new Uint8Array(needed);
    padded.set(decoded);
    return padded;
  }
  return decoded.subarray(0, needed);
}

function cellFromEntry(
  entry: number,
  primary: TilesetGraphics,
  secondary: TilesetGraphics,
  tiles: Uint8Array,
  palettes: Rgb[][],
): Cell {
  const metatileId = entry & MAPGRID_METATILE_ID_MASK;
  const collision = (entry >> MAPGRID_COLLISION_SHIFT) & 0x3;
  const tileset = metatileId < NUM_METATILES_IN_PRIMARY ? primary : secondary;
  const localId = metatileId < NUM_METATILES_IN_PRIMARY ? metatileId : metatileId - NUM_METATILES_IN_PRIMARY;
  const attributes = localId < tileset.attributes.length ? tileset.attributes[localId] : 0;
  const behavior = attributes & ATTR_BEHAVIOR_MASK;
  const encounterType = (attributes >>> ATTR_ENCOUNTER_SHIFT) & ATTR_ENCOUNTER_MASK;
  const pixels = metatileImage(tileset, localId, tiles, palettes);
  const textureKey = `${tileset.pointer}:${localId}`;

  const jump = JUMP_DIRECTION[behavior];
  const oneWay = BLOCK_DIRECTION[behavior];
  const tallGrass = behavior === MB_TALL_GRASS || encounterType === TILE_ENCOUNTER_LAND;
  const water = WATER_BEHAVIORS.has(behavior);
  const furniture = behavior >= 0x80 && behavior <= 0xa3;

  let blocked = collision !== 0 || water || furniture;
  let encounter = false;
  let blockEnter: Direction[] | undefined;
  let visual: TileVisual = "ground";
  let kind: PropKind = "ground";
  let height = 0;

  if (water) {
    visual = "water";
    kind = "water";
    blocked = true;
  } else if (tallGrass && collision === 0) {
    visual = "tallGrass";
    kind = "grass";
    blocked = false;
    encounter = true;
  } else if (jump && collision === 0) {
    visual = "ledge";
    kind = "ledge";
    blocked = false;
    blockEnter = (["n", "s", "e", "w"] as Direction[]).filter((dir) => dir !== jump);
    height = 0.18;
  } else if (oneWay && !blocked) {
    blockEnter = [oneWay];
    visual = "ledge";
    kind = "ledge";
    height = 0.12;
  } else if (blocked) {
    const sample = sampleImage(pixels);
    if (furniture) {
      visual = "sign";
      kind = "sign";
      height = 0.7;
    } else if (sample.alphaTop < 0.35 && sample.alphaBottom > 0.4) {
      visual = "fence";
      kind = "fence";
      height = 0.55;
    } else if (sample.green > 0.42) {
      visual = "tree";
      kind = "tree";
      height = 1.6;
    } else if (sample.red > 0.28) {
      visual = "roof";
      kind = "structure";
      height = 0.5;
    } else {
      visual = "wall";
      kind = "structure";
      height = 0.85;
    }
  }

  return { visual, kind, blocked, encounter, blockEnter, height, wild: "none", pixels, textureKey };
}

function metatileImage(
  tileset: TilesetGraphics,
  localId: number,
  tiles: Uint8Array,
  palettes: Rgb[][],
): Uint8ClampedArray {
  const cached = tileset.cache.get(localId);
  if (cached) return cached;
  const entryAt = localId * METATILE_BYTES;
  const entries = entryAt + METATILE_BYTES <= tileset.metatiles.length
    ? tileset.metatiles.subarray(entryAt, entryAt + METATILE_BYTES)
    : new Uint8Array(METATILE_BYTES);
  const image = renderMetatile({
    tiles,
    palettes,
    entries,
  });
  tileset.cache.set(localId, image);
  return image;
}

function sampleImage(pixels: Uint8ClampedArray): {
  green: number;
  red: number;
  alphaTop: number;
  alphaBottom: number;
} {
  let opaque = 0;
  let green = 0;
  let red = 0;
  let top = 0;
  let topCount = 0;
  let bottom = 0;
  let bottomCount = 0;
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const index = (y * 16 + x) * 4;
      const alpha = pixels[index + 3];
      if (y < 6) {
        topCount++;
        if (alpha > 128) top++;
      }
      if (y > 9) {
        bottomCount++;
        if (alpha > 128) bottom++;
      }
      if (alpha < 128) continue;
      opaque++;
      const r = pixels[index];
      const g = pixels[index + 1];
      const b = pixels[index + 2];
      if (g > r + 15 && g > b + 10) green++;
      if (r > g + 20 && r > b) red++;
    }
  }
  return {
    green: opaque ? green / opaque : 0,
    red: opaque ? red / opaque : 0,
    alphaTop: topCount ? top / topCount : 0,
    alphaBottom: bottomCount ? bottom / bottomCount : 0,
  };
}

function readWarps(rom: Uint8Array, header: number): Warp[] {
  const eventsPointer = readU32(rom, header + 4);
  if (eventsPointer === 0) return [];
  const events = fileOffset(rom, eventsPointer);
  const warpCount = readU8(rom, events + 1);
  if (warpCount <= 0 || warpCount > 64) return [];
  const warpsPointer = readU32(rom, events + 8);
  if (warpsPointer === 0) return [];
  const warps = fileOffset(rom, warpsPointer);
  const list: Warp[] = [];
  for (let i = 0; i < warpCount; i++) {
    const at = warps + i * 8;
    list.push({
      x: readU16(rom, at),
      y: readU16(rom, at + 2),
      mapNum: readU8(rom, at + 6),
      mapGroup: readU8(rom, at + 7),
    });
  }
  return list;
}

function readNorthLink(rom: Uint8Array, header: number): RawMap["north"] {
  const connectionsPointer = readU32(rom, header + 0x0c);
  if (connectionsPointer === 0) return null;
  const connections = fileOffset(rom, connectionsPointer);
  const count = readS32(rom, connections);
  if (count <= 0 || count > 16) return null;
  const listPointer = readU32(rom, connections + 4);
  if (listPointer === 0) return null;
  const list = fileOffset(rom, listPointer);
  for (let i = 0; i < count; i++) {
    const at = list + i * 12;
    const direction = readU8(rom, at);
    if (direction !== CONNECTION_NORTH) continue;
    return {
      offset: readS32(rom, at + 4),
      mapGroup: readU8(rom, at + 8),
      mapNum: readU8(rom, at + 9),
    };
  }
  return null;
}

function stitchNorth(
  pallet: RawMap,
  north: RawMap | null,
  offset: number,
): { width: number; height: number; cells: Cell[]; rowShift: number } {
  tagEncounters(pallet.cells, "local");
  if (!north) {
    return { width: pallet.width, height: pallet.height, cells: pallet.cells, rowShift: 0 };
  }
  const minX = Math.min(0, offset);
  const maxX = Math.max(pallet.width, offset + north.width);
  const width = maxX - minX;
  const height = north.height + pallet.height;
  const cells: Cell[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const worldX = x + minX;
      if (y < north.height) {
        const sourceX = worldX - offset;
        if (sourceX < 0 || sourceX >= north.width) {
          cells.push(edgeCell());
          continue;
        }
        const source = north.cells[y * north.width + sourceX];
        cells.push({ ...source, wild: source.encounter ? "north" : "none" });
        continue;
      }
      const sourceX = worldX;
      const sourceY = y - north.height;
      if (sourceX < 0 || sourceX >= pallet.width) {
        cells.push(edgeCell());
        continue;
      }
      cells.push(pallet.cells[sourceY * pallet.width + sourceX]);
    }
  }
  return { width, height, cells, rowShift: north.height };
}

function tagEncounters(cells: Cell[], source: "local" | "north"): void {
  for (const cell of cells) {
    if (cell.encounter) cell.wild = source;
  }
}

function edgeCell(): Cell {
  return {
    visual: "tree",
    kind: "tree",
    blocked: true,
    encounter: false,
    height: 1.4,
    wild: "none",
  };
}

function findSpawn(
  cells: Cell[],
  width: number,
  height: number,
  warps: Warp[],
  rowShift: number,
  indoorGroup: number,
): { x: number; y: number } {
  const town = {
    width,
    height,
    cells,
    title: "",
    mode: "rom" as const,
    modeDetail: "",
    spawnX: 0,
    spawnY: 0,
    player: unusedMember(),
    starters: [],
    wildLocal: [],
    wildNorth: [],
    hero: null,
    chart: [],
  };
  const ranked = [...warps].sort((a, b) => warpRank(a, indoorGroup) - warpRank(b, indoorGroup));
  const neighborOrder: Array<[number, number]> = [
    [0, 1],
    [0, 0],
    [-1, 0],
    [1, 0],
    [0, -1],
  ];
  for (const warp of ranked) {
    for (const [dx, dy] of neighborOrder) {
      const x = (warp.x & 0xffff) + dx;
      const y = (warp.y & 0xffff) + rowShift + dy;
      if (standable(town, x, y) && !town.cells[y * width + x].encounter) return { x, y };
    }
  }
  return nearestStandable(town);
}

function warpRank(warp: Warp, indoorGroup: number): number {
  if (warp.mapGroup === indoorGroup && warp.mapNum === 0) return 0;
  if (warp.mapGroup === indoorGroup) return 1;
  return 2;
}

function nearestStandable(town: TownMap): { x: number; y: number } {
  const cx = Math.floor(town.width / 2);
  const cy = Math.floor(town.height / 2);
  let best: { x: number; y: number; distance: number } | null = null;
  for (let y = 0; y < town.height; y++) {
    for (let x = 0; x < town.width; x++) {
      const cell = town.cells[y * town.width + x];
      if (!standable(town, x, y) || cell.encounter) continue;
      const distance = Math.abs(x - cx) + Math.abs(y - cy);
      if (!best || distance < best.distance) best = { x, y, distance };
    }
  }
  if (best) return best;
  return { x: Math.min(1, town.width - 1), y: Math.min(1, town.height - 1) };
}

function standable(town: TownMap, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= town.width || y >= town.height) return false;
  const cell = town.cells[y * town.width + x];
  return !cell.blocked && cell.visual !== "water";
}

function readWildSlots(rom: Uint8Array, table: FireredTable, mapGroup: number, mapNum: number): WildSlot[] {
  const tableOffset = fileOffset(rom, table.wildMonHeaders);
  for (let index = 0; index < table.wildHeaderCount; index++) {
    const at = tableOffset + index * table.wildHeaderStride;
    const group = readU8(rom, at);
    const num = readU8(rom, at + 1);
    if (group !== mapGroup || num !== mapNum) continue;
    const landPointer = readU32(rom, at + 4);
    const land = optionalFileOffset(rom, landPointer);
    if (land === null) return [];
    const monsPointer = readU32(rom, land + 4);
    const mons = fileOffset(rom, monsPointer);
    const slots: WildSlot[] = [];
    for (let slot = 0; slot < LAND_WILD_COUNT; slot++) {
      const entry = mons + slot * 4;
      const minLevel = readU8(rom, entry);
      const maxLevel = readU8(rom, entry + 1);
      const species = readU16(rom, entry + 2);
      if (species <= 0 || species >= table.speciesCount) continue;
      const template = readSpecies(rom, table, species);
      const low = Math.max(1, Math.min(minLevel, maxLevel));
      const high = Math.max(low, Math.max(minLevel, maxLevel));
      slots.push({ ...template, minLevel: low, maxLevel: high });
    }
    return slots;
  }
  return [];
}

function readPartyMember(rom: Uint8Array, table: FireredTable, species: number, level: number): PartyMember {
  const profile = readSpeciesProfile(rom, table, species, level);
  return {
    name: profile.name,
    species: profile.species,
    level,
    baseHp: profile.baseHp,
    baseAttack: profile.baseAttack,
    baseDefense: profile.baseDefense,
    baseSpeed: profile.baseSpeed,
    typeIds: profile.typeIds,
    typeNames: profile.typeNames,
    moveName: profile.move.name,
    movePower: profile.move.power,
    moveTypeId: profile.move.typeId,
    moveTypeName: profile.move.typeName,
    front: profile.front,
    back: profile.back,
  };
}

function readSpecies(rom: Uint8Array, table: FireredTable, species: number) {
  const profile = readSpeciesProfile(rom, table, species, 1);
  return {
    name: profile.name,
    species: profile.species,
    baseHp: profile.baseHp,
    baseAttack: profile.baseAttack,
    baseDefense: profile.baseDefense,
    baseSpeed: profile.baseSpeed,
    typeIds: profile.typeIds,
    typeNames: profile.typeNames,
    moveName: profile.move.name,
    movePower: profile.move.power,
    moveTypeId: profile.move.typeId,
    moveTypeName: profile.move.typeName,
    front: profile.front,
    back: profile.back,
  };
}

function unusedMember(): PartyMember {
  return {
    name: "",
    species: 0,
    level: 1,
    baseHp: 1,
    baseAttack: 1,
    baseDefense: 1,
    baseSpeed: 1,
    typeIds: [],
    typeNames: [],
    moveName: "Strike",
    movePower: 4,
    moveTypeId: 0,
    moveTypeName: "",
    front: null,
    back: null,
  };
}
