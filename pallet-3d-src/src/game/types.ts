export type Direction = "n" | "s" | "e" | "w";

export type TileVisual =
  | "ground"
  | "path"
  | "tallGrass"
  | "water"
  | "shore"
  | "tree"
  | "fence"
  | "wall"
  | "roof"
  | "door"
  | "sign"
  | "flower"
  | "ledge";

/** How the 3D scene should lift this metatile off the ground plane. */
export type PropKind = "ground" | "grass" | "water" | "ledge" | "tree" | "fence" | "sign" | "structure";

export type WildSource = "none" | "local" | "north";

export interface DecodedSprite {
  width: number;
  height: number;
  /** RGBA, row-major. Index 0 of the source palette is already transparent. */
  pixels: Uint8ClampedArray;
}

export interface LearnedMove {
  name: string;
  power: number;
  typeId: number;
  typeName: string;
}

export interface HeroSprite {
  width: number;
  height: number;
  /** On-foot frames. 0 south, 1 north, 2 west; later frames are the walk cycle. */
  frames: Uint8ClampedArray[];
}

export interface Cell {
  visual: TileVisual;
  kind: PropKind;
  blocked: boolean;
  encounter: boolean;
  /** Directions from which this tile refuses entry (ledges, one-way edges). */
  blockEnter?: Direction[];
  height: number;
  wild: WildSource;
  /** 16×16 RGBA from the metatile, when the picture came from a ROM tileset. */
  pixels?: Uint8ClampedArray;
  textureKey?: string;
}

export interface SpeciesTemplate {
  name: string;
  species: number;
  baseHp: number;
  baseAttack: number;
  baseDefense: number;
  baseSpeed: number;
  typeIds: number[];
  typeNames: string[];
  moveName: string;
  movePower: number;
  moveTypeId: number;
  moveTypeName: string;
  front: DecodedSprite | null;
  back: DecodedSprite | null;
}

export interface PartyMember extends SpeciesTemplate {
  level: number;
}

export interface WildSlot extends SpeciesTemplate {
  minLevel: number;
  maxLevel: number;
}

export interface Combatant {
  name: string;
  level: number;
  maxHp: number;
  hp: number;
  attack: number;
  defense: number;
  speed: number;
  moveName: string;
  movePower: number;
  moveTypeId: number;
  moveTypeName: string;
  typeIds: number[];
  typeNames: string[];
  front: DecodedSprite | null;
  back: DecodedSprite | null;
}

export interface TownMap {
  title: string;
  mode: "rom";
  modeDetail: string;
  width: number;
  height: number;
  /** Rows of the northern connected map. Pallet Town starts at this row. */
  northRows: number;
  cells: Cell[];
  spawnX: number;
  spawnY: number;
  player: PartyMember;
  starters: PartyMember[];
  wildLocal: WildSlot[];
  wildNorth: WildSlot[];
  hero: HeroSprite | null;
  /** Flat atk, def, multiplier triples from the ROM. Empty in synthetic fixtures. */
  chart: number[];
}

export function cellAt(town: TownMap, x: number, y: number): Cell | undefined {
  if (x < 0 || y < 0 || x >= town.width || y >= town.height) return undefined;
  return town.cells[y * town.width + x];
}

export function isStandable(town: TownMap, x: number, y: number): boolean {
  const cell = cellAt(town, x, y);
  if (!cell || cell.blocked || cell.visual === "water") return false;
  return true;
}

export function canEnter(town: TownMap, x: number, y: number, dir: Direction): boolean {
  const cell = cellAt(town, x, y);
  if (!cell || cell.blocked) return false;
  if (cell.blockEnter?.includes(dir)) return false;
  return true;
}
