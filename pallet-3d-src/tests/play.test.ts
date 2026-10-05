import { describe, expect, it } from "vitest";
import { Battle } from "../src/game/battle";
import { computeDamage, statsFromBase, toCombatant } from "../src/game/stats";
import { canEnter, isStandable, type Cell, type Direction, type PartyMember, type TownMap } from "../src/game/types";
import { STEP_SECONDS, Walker } from "../src/game/walker";

function member(name: string, speed: number): PartyMember {
  return {
    name,
    species: 1,
    level: 5,
    baseHp: name === "PIP" ? 48 : 30,
    baseAttack: 55,
    baseDefense: 50,
    baseSpeed: speed,
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

function openCell(): Cell {
  return { visual: "ground", kind: "ground", blocked: false, encounter: false, height: 0, wild: "none" };
}

function tinyTown(): TownMap {
  const cells = Array.from({ length: 9 }, openCell);
  cells[1] = { ...openCell(), encounter: true, visual: "tallGrass", kind: "grass", wild: "north" };
  cells[8] = { ...openCell(), blocked: true, visual: "water", kind: "water" };
  return {
    title: "",
    mode: "rom",
    modeDetail: "",
    width: 3,
    height: 3,
    cells,
    spawnX: 1,
    spawnY: 2,
    player: member("PIP", 60),
    starters: [],
    wildLocal: [],
    wildNorth: [],
    hero: null,
    chart: [],
  };
}

describe("walking", () => {
  it("reaches tall grass and treats water as blocked", () => {
    const town = tinyTown();
    expect(isStandable(town, town.spawnX, town.spawnY)).toBe(true);
    const seen = reachable(town, town.spawnX, town.spawnY);
    expect(seen.has("1,0")).toBe(true);
    expect(town.cells[1].encounter).toBe(true);
    expect(seen.has("2,2")).toBe(false);
  });
});

describe("walker", () => {
  it("steps onto open ground and bumps into a blocked tile", () => {
    const blocked = tinyTown();
    blocked.cells = blocked.cells.map((cell) => ({ ...cell, blocked: false, encounter: false, visual: "ground" as const, kind: "ground" as const }));
    blocked.cells[1] = { ...blocked.cells[1], blocked: true, visual: "tree", kind: "tree", height: 1 };
    const walker = new Walker(blocked, 1, 2);
    walker.hold("n");
    walker.update(STEP_SECONDS);
    const arrived = walker.update(STEP_SECONDS);
    expect(arrived.entered).toBe(true);
    expect(walker.y).toBe(1);
    expect(arrived.bumped).toBe(true);
    expect(walker.y).toBe(1);
  });
});

describe("battle math", () => {
  it("scales stats and keeps damage at least 1", () => {
    expect(statsFromBase(48, 55, 50, 60, 5)).toEqual({ hp: 19, attack: 10, defense: 10, speed: 11 });
    expect(computeDamage({ attack: 10, level: 5 }, { defense: 8 }, 4, 1)).toBe(2);
    expect(computeDamage({ attack: 0, level: 0 }, { defense: 99 }, 1, 0.1)).toBe(1);
  });

  it("lets the faster side strike first and ends the fight at 0 HP", () => {
    const player = toCombatant({ ...member("PIP", 60), level: 5, baseHp: 48 });
    const wild = toCombatant({ ...member("MOSS", 35), level: 3, baseHp: 30, baseAttack: 45, baseDefense: 55 });
    const fight = new Battle(player, wild, () => 0);
    const first = fight.fight();
    expect(first[0]).toMatchObject({ kind: "hit", defender: "wild" });
    let guard = 0;
    while (!fight.over && guard < 20) {
      fight.fight();
      guard += 1;
    }
    expect(fight.outcome).toBe("win");
    expect(wild.hp).toBe(0);
  });
});

function reachable(town: TownMap, startX: number, startY: number): Set<string> {
  const seen = new Set<string>();
  const queue: Array<[number, number]> = [[startX, startY]];
  const delta: Record<Direction, [number, number]> = {
    n: [0, -1],
    s: [0, 1],
    e: [1, 0],
    w: [-1, 0],
  };
  while (queue.length > 0) {
    const next = queue.shift();
    if (!next) break;
    const [x, y] = next;
    const key = `${x},${y}`;
    if (seen.has(key)) continue;
    seen.add(key);
    for (const dir of Object.keys(delta) as Direction[]) {
      const [dx, dy] = delta[dir];
      const nx = x + dx;
      const ny = y + dy;
      if (canEnter(town, nx, ny, dir)) queue.push([nx, ny]);
    }
  }
  return seen;
}
