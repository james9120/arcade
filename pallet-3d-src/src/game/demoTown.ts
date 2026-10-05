import type { Cell, PartyMember, TileVisual, TownMap, WildSlot } from "./types";

export const DEMO_WIDTH = 20;
export const DEMO_HEIGHT = 18;
export const DEMO_SPAWN = { x: 9, y: 7 };

const PLAYER: PartyMember = {
  name: "Bramblo",
  level: 5,
  baseHp: 48,
  baseAttack: 55,
  baseDefense: 50,
  baseSpeed: 60,
  moveName: "Moss Ram",
  movePower: 4,
  accent: "#3f8f45",
  portrait: "bramblo",
};

const WILD: WildSlot = {
  name: "Pebblit",
  minLevel: 3,
  maxLevel: 3,
  baseHp: 30,
  baseAttack: 45,
  baseDefense: 55,
  baseSpeed: 35,
  moveName: "Pebble Toss",
  movePower: 4,
  accent: "#c4a06a",
  portrait: "pebblit",
};

/**
 * An original block town with the same walk the prototype needs:
 * houses and a lab around a path, water to the south, tall grass to the north.
 * Nothing here is extracted from a ROM.
 */
export function buildDemoTown(): TownMap {
  const cells: Cell[] = [];
  for (let y = 0; y < DEMO_HEIGHT; y++) {
    for (let x = 0; x < DEMO_WIDTH; x++) {
      cells.push(makeCell("ground"));
    }
  }
  const set = (x: number, y: number, visual: TileVisual) => {
    if (x < 0 || y < 0 || x >= DEMO_WIDTH || y >= DEMO_HEIGHT) return;
    cells[y * DEMO_WIDTH + x] = makeCell(visual);
  };
  const fill = (x0: number, y0: number, x1: number, y1: number, visual: TileVisual) => {
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) set(x, y, visual);
    }
  };

  fill(1, 0, DEMO_WIDTH - 2, 2, "tallGrass");
  for (let y = 0; y <= 15; y++) {
    set(0, y, "tree");
    set(DEMO_WIDTH - 1, y, "tree");
  }
  fill(1, 3, DEMO_WIDTH - 2, 3, "fence");
  fill(0, 15, DEMO_WIDTH - 1, 15, "shore");
  fill(0, 16, DEMO_WIDTH - 1, 17, "water");

  for (let y = 3; y <= 15; y++) {
    set(9, y, "path");
    set(10, y, "path");
  }
  fill(3, 9, 16, 9, "path");
  set(8, 12, "path");

  stampHouse(set, 2, 5, 5, 8, 3, 8);
  stampHouse(set, 14, 5, 17, 8, 15, 8);
  stampHouse(set, 2, 11, 7, 14, 7, 12);

  for (const [x, y] of [
    [2, 4],
    [3, 4],
    [5, 4],
    [4, 10],
    [15, 10],
    [16, 4],
    [12, 14],
  ] as const) {
    if (cells[y * DEMO_WIDTH + x].visual === "ground") set(x, y, "tree");
  }
  for (const [x, y] of [
    [6, 6],
    [13, 6],
    [8, 10],
    [11, 14],
    [4, 9],
  ] as const) {
    if (cells[y * DEMO_WIDTH + x].visual === "ground" || cells[y * DEMO_WIDTH + x].visual === "shore") {
      set(x, y, "flower");
    }
  }
  set(12, 8, "sign");
  set(8, 13, "sign");

  return {
    title: "Pallet Town",
    mode: "demo",
    modeDetail: "DEMO · original placeholder art",
    width: DEMO_WIDTH,
    height: DEMO_HEIGHT,
    cells,
    spawnX: DEMO_SPAWN.x,
    spawnY: DEMO_SPAWN.y,
    player: PLAYER,
    wildLocal: [WILD],
    wildNorth: [],
  };
}

function stampHouse(
  set: (x: number, y: number, visual: TileVisual) => void,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  doorX: number,
  doorY: number,
): void {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (x === doorX && y === doorY) set(x, y, "door");
      else if (y === y0) set(x, y, "roof");
      else set(x, y, "wall");
    }
  }
}

function makeCell(visual: TileVisual): Cell {
  switch (visual) {
    case "tallGrass":
      return { visual, blocked: false, encounter: true, height: 0, wild: "local" };
    case "water":
      return { visual, blocked: true, encounter: false, height: 0, wild: "none" };
    case "tree":
      return { visual, blocked: true, encounter: false, height: 1.8, wild: "none" };
    case "fence":
      return { visual, blocked: true, encounter: false, height: 0.42, wild: "none" };
    case "wall":
      return { visual, blocked: true, encounter: false, height: 1.2, wild: "none" };
    case "roof":
      return { visual, blocked: true, encounter: false, height: 1.65, wild: "none" };
    case "door":
      return { visual, blocked: true, encounter: false, height: 1.05, wild: "none" };
    case "sign":
      return { visual, blocked: true, encounter: false, height: 0.72, wild: "none" };
    case "ledge":
      return { visual, blocked: false, encounter: false, height: 0.2, wild: "none" };
    default:
      return { visual, blocked: false, encounter: false, height: 0, wild: "none" };
  }
}
