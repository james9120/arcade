import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { canEnter, type Direction } from "../src/game/types";
import { loadFireRedTown } from "../src/rom/map";

const romPath = process.env.FIRERED_ROM;

describe.skipIf(!romPath)("local FireRed ROM", () => {
  it("builds a recognizable Pallet Town, Route 1, and real battle data", () => {
    const rom = new Uint8Array(readFileSync(romPath as string));
    const town = loadFireRedTown(rom);

    expect(town.mode).toBe("rom");
    expect(town.width).toBe(24);
    expect(town.height).toBe(60);
    expect(town.northRows).toBe(40);
    expect(town.starters.map((starter) => starter.name)).toEqual(["BULBASAUR", "CHARMANDER", "SQUIRTLE"]);
    expect(town.starters[0]).toMatchObject({ baseHp: 45, level: 5, moveName: "TACKLE" });
    expect(town.starters[0].typeNames).toEqual(["GRASS", "POISON"]);
    expect(town.starters[1].moveName).toBe("SCRATCH");
    expect(town.starters[1].baseHp).toBe(39);
    expect(town.starters[2].moveName).toBe("TACKLE");
    expect(town.starters[0].front?.width).toBe(64);
    expect(opaque(town.starters[0].front?.pixels)).toBeGreaterThan(400);
    expect(town.starters[0].back?.width).toBe(64);
    expect(town.hero?.width).toBe(16);
    expect(town.hero?.height).toBe(32);
    expect(town.hero?.frames.length).toBeGreaterThanOrEqual(9);

    const northNames = new Set(town.wildNorth.map((slot) => slot.name));
    expect(northNames.has("PIDGEY")).toBe(true);
    expect(northNames.has("RATTATA")).toBe(true);
    expect(town.wildNorth.find((slot) => slot.name === "PIDGEY")?.front?.width).toBe(64);

    const grass = town.cells.findIndex((cell) => cell.encounter && cell.wild === "north" && cell.kind === "grass");
    expect(grass).toBeGreaterThan(-1);
    const grassY = Math.floor(grass / town.width);
    expect(grassY).toBeLessThan(town.spawnY);
    expect(opaque(town.cells[grass].pixels)).toBeGreaterThan(20);

    const seen = reachable(town, town.spawnX, town.spawnY);
    expect([...seen].some((key) => {
      const [x, y] = key.split(",").map(Number);
      return town.cells[y * town.width + x].encounter;
    })).toBe(true);
  });
});

function opaque(pixels: Uint8ClampedArray | undefined): number {
  if (!pixels) return 0;
  let count = 0;
  for (let index = 3; index < pixels.length; index += 4) {
    if (pixels[index] > 0) count++;
  }
  return count;
}

function reachable(town: ReturnType<typeof loadFireRedTown>, startX: number, startY: number): Set<string> {
  const seen = new Set<string>();
  const queue: Array<[number, number]> = [[startX, startY]];
  const delta: Record<Direction, [number, number]> = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };
  while (queue.length > 0) {
    const next = queue.shift();
    if (!next) break;
    const [x, y] = next;
    const key = `${x},${y}`;
    if (seen.has(key)) continue;
    seen.add(key);
    for (const dir of Object.keys(delta) as Direction[]) {
      const [dx, dy] = delta[dir];
      if (canEnter(town, x + dx, y + dy, dir)) queue.push([x + dx, y + dy]);
    }
  }
  return seen;
}
