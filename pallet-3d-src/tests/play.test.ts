import { describe, expect, it } from "vitest";
import { Battle } from "../src/game/battle";
import { buildDemoTown } from "../src/game/demoTown";
import { computeDamage, statsFromBase, toCombatant } from "../src/game/stats";
import { canEnter, isStandable, type Direction, type TownMap } from "../src/game/types";
import { STEP_SECONDS, Walker } from "../src/game/walker";

describe("demo town", () => {
  it("has a walk from the spawn into northern tall grass, and water stays blocked", () => {
    const town = buildDemoTown();
    expect(isStandable(town, town.spawnX, town.spawnY)).toBe(true);
    expect(town.cells[town.spawnY * town.width + town.spawnX].encounter).toBe(false);

    const seen = reachable(town, town.spawnX, town.spawnY);
    const grass = [...seen].some((key) => {
      const [x, y] = key.split(",").map(Number);
      return town.cells[y * town.width + x].encounter;
    });
    expect(grass).toBe(true);

    const water = town.cells.findIndex((cell) => cell.visual === "water");
    expect(water).toBeGreaterThan(-1);
    const waterX = water % town.width;
    const waterY = Math.floor(water / town.width);
    expect(seen.has(`${waterX},${waterY}`)).toBe(false);
    expect(town.player.name).toBe("Bramblo");
    expect(town.wildLocal[0].name).toBe("Pebblit");
  });
});

describe("walker", () => {
  it("steps onto open ground and bumps into a blocked tile", () => {
    const town = buildDemoTown();
    const blocked = {
      ...town,
      width: 3,
      height: 3,
      cells: town.cells.slice(0, 9).map((cell) => ({ ...cell, blocked: false, encounter: false, visual: "ground" as const })),
      spawnX: 1,
      spawnY: 2,
    };
    blocked.cells[1] = { ...blocked.cells[1], blocked: true, visual: "tree", height: 1 };
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
    expect(computeDamage({ attack: 10, level: 5 }, { defense: 8 }, 4, 1)).toBe(7);
    expect(computeDamage({ attack: 0, level: 0 }, { defense: 99 }, 1, 0.1)).toBe(1);
  });

  it("lets the faster side strike first and ends the fight at 0 HP", () => {
    const player = toCombatant({
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
    });
    const wild = toCombatant({
      name: "Pebblit",
      level: 3,
      baseHp: 30,
      baseAttack: 45,
      baseDefense: 55,
      baseSpeed: 35,
      moveName: "Pebble Toss",
      movePower: 4,
      accent: "#c4a06a",
      portrait: "pebblit",
    });
    const fight = new Battle(player, wild, () => 0);
    const first = fight.fight();
    expect(first[0]).toMatchObject({ kind: "hit", defender: "wild" });
    let guard = 0;
    while (!fight.over && guard < 8) {
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
