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

export type Portrait = "bramblo" | "pebblit" | "blob";

export type WildSource = "none" | "local" | "north";

export interface Cell {
  visual: TileVisual;
  blocked: boolean;
  encounter: boolean;
  /** Directions from which this tile refuses entry (ledges, one-way edges). */
  blockEnter?: Direction[];
  height: number;
  wild: WildSource;
  /** 16×16 RGBA, present when the picture came from a ROM tileset. */
  pixels?: Uint8ClampedArray;
  textureKey?: string;
}

export interface SpeciesTemplate {
  name: string;
  baseHp: number;
  baseAttack: number;
  baseDefense: number;
  baseSpeed: number;
  moveName: string;
  movePower: number;
  accent: string;
  portrait: Portrait;
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
  accent: string;
  portrait: Portrait;
}

export interface TownMap {
  title: string;
  mode: "demo" | "rom";
  modeDetail: string;
  width: number;
  height: number;
  cells: Cell[];
  spawnX: number;
  spawnY: number;
  player: PartyMember;
  wildLocal: WildSlot[];
  wildNorth: WildSlot[];
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
