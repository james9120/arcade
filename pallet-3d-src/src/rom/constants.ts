/**
 * FireRed US v1.0 (game code BPRE, revision 0) layout.
 *
 * Addresses are GBA ROM addresses (file offset = address - 0x08000000), taken
 * from the public pret/pokefirered symbol map `pokefirered.sym` for the
 * matching US v1.0 image. Struct field offsets follow the public headers
 * (global.fieldmap.h, pokemon.h, wild_encounter.h, fieldmap.h). No game
 * graphics, scripts, names, or stat tables are stored here.
 */
export const FIRERED_US_V10 = {
  mapGroups: 0x083526a8,
  speciesInfo: 0x08254784,
  /** gSpeciesInfo symbol size 0x2D10 / 412 entries. */
  speciesInfoStride: 28,
  speciesCount: 412,
  speciesNames: 0x08245ee0,
  /** 10 characters plus the 0xFF terminator. */
  speciesNameStride: 11,
  wildMonHeaders: 0x083c9cb8,
  /** Symbol size 0xA64 / 20-byte headers. */
  wildHeaderCount: 133,
  wildHeaderStride: 20,
  /** gMapGroup_TownsAndRoutes, from data/maps/map_groups.json order. */
  palletGroup: 3,
  palletMap: 0,
  /** gMapGroup_IndoorPallet. */
  indoorPalletGroup: 4,
  /** First partner species index in the species table. Name and stats are read from the ROM. */
  partnerSpecies: 1,
  partnerLevel: 5,
} as const;

export type FireredTable = { [K in keyof typeof FIRERED_US_V10]: number };

export const NUM_TILES_IN_PRIMARY = 640;
export const NUM_TILES_TOTAL = 1024;
export const NUM_METATILES_IN_PRIMARY = 640;
export const NUM_METATILES_TOTAL = 1024;
export const NUM_PALS_IN_PRIMARY = 7;
export const NUM_PALS_TOTAL = 13;
export const NUM_TILES_PER_METATILE = 8;
export const TILE_BYTES = 32;
export const METATILE_BYTES = 16;
export const PALETTE_BYTES = 32;
export const LAND_WILD_COUNT = 12;
/** How many rows of a north connection to pull in (the engine's MAP_OFFSET). */
export const NORTH_STRIP_ROWS = 7;

export const MAPGRID_METATILE_ID_MASK = 0x03ff;
export const MAPGRID_COLLISION_SHIFT = 10;

/** Low 9 bits of a metatile attribute word. */
export const ATTR_BEHAVIOR_MASK = 0x000001ff;
/** Bits 24–26. 1 means a land encounter. */
export const ATTR_ENCOUNTER_SHIFT = 24;
export const ATTR_ENCOUNTER_MASK = 0x7;

export const MB_TALL_GRASS = 0x02;
export const MB_POND_WATER = 0x10;
export const MB_JUMP_EAST = 0x38;
export const MB_JUMP_WEST = 0x39;
export const MB_JUMP_NORTH = 0x3a;
export const MB_JUMP_SOUTH = 0x3b;
export const MB_IMPASSABLE_EAST = 0x30;
export const MB_IMPASSABLE_WEST = 0x31;
export const MB_IMPASSABLE_NORTH = 0x32;
export const MB_IMPASSABLE_SOUTH = 0x33;

export const CONNECTION_NORTH = 2;

export const TILE_ENCOUNTER_LAND = 1;
