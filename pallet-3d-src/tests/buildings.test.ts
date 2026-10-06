import { describe, expect, it } from "vitest";
import type { Cell, TileVisual, PropKind } from "../src/game/types";
import { eaveRowCount, findOpenings, groupBlocks, roofRowCount } from "../src/render/footprints";
import { readGraphicsMode } from "../src/render/quality";

function paint(color: [number, number, number]): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(16 * 16 * 4);
  for (let index = 0; index < pixels.length; index += 4) {
    pixels[index] = color[0];
    pixels[index + 1] = color[1];
    pixels[index + 2] = color[2];
    pixels[index + 3] = 255;
  }
  return pixels;
}

function cell(kind: PropKind, visual: TileVisual, color: [number, number, number]): Cell {
  return {
    visual,
    kind,
    blocked: true,
    encounter: false,
    height: 1,
    wild: "none",
    pixels: paint(color),
    textureKey: visual,
  };
}

describe("building footprints", () => {
  it("splits houses from fence runs and cliff strips", () => {
    const width = 12;
    const height = 10;
    const cells = Array.from({ length: width * height }, () => cell("ground", "ground", [120, 160, 90]));
    const roof: [number, number, number] = [210, 120, 90];
    const wall: [number, number, number] = [170, 185, 200];
    for (let y = 1; y <= 4; y++) {
      for (let x = 1; x <= 5; x++) {
        cells[y * width + x] = cell("structure", y <= 2 ? "roof" : "wall", y <= 2 ? roof : wall);
      }
    }
    for (let x = 7; x <= 10; x++) cells[2 * width + x] = cell("structure", "roof", [140, 80, 60]);
    for (let x = 7; x <= 10; x++) cells[6 * width + x] = cell("structure", "wall", [150, 155, 160]);

    const blocks = groupBlocks({ width, height, cells });
    const roles = blocks.map((block) => block.role).sort();
    expect(roles).toEqual(["building", "fence", "ledge"]);
    const house = blocks.find((block) => block.role === "building");
    expect(house).toBeTruthy();
    expect(roofRowCount(house!)).toBe(2);
  });

  it("finds inset windows and doors on a front wall", () => {
    const width = 48;
    const height = 32;
    const pixels = new Uint8ClampedArray(width * height * 4);
    for (let index = 0; index < pixels.length; index += 4) {
      pixels[index] = 186;
      pixels[index + 1] = 198;
      pixels[index + 2] = 210;
      pixels[index + 3] = 255;
    }
    fill(pixels, width, 8, 4, 12, 8, [99, 165, 222]);
    fill(pixels, width, 28, 4, 10, 8, [99, 165, 222]);
    fill(pixels, width, 18, 16, 12, 14, [74, 206, 132]);

    const openings = findOpenings(pixels, width, height);
    expect(openings.filter((opening) => opening.kind === "window").length).toBeGreaterThanOrEqual(2);
    expect(openings.some((opening) => opening.kind === "door")).toBe(true);
    const door = openings.find((opening) => opening.kind === "door");
    expect(door && door.y + door.h).toBeGreaterThan(height - 4);
  });

  it("keeps the eave to the bottom rows of a roof tile", () => {
    const width = 32;
    const height = 16;
    const pixels = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
      const eave = y >= 8;
      for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4;
        pixels[index] = eave ? 148 : 230;
        pixels[index + 1] = eave ? 165 : 120;
        pixels[index + 2] = eave ? 181 : 96;
        pixels[index + 3] = 255;
      }
    }
    expect(eaveRowCount(pixels, width, height)).toBe(8);
    pixels.fill(200);
    for (let index = 3; index < pixels.length; index += 4) pixels[index] = 255;
    expect(eaveRowCount(pixels, width, height)).toBe(0);
  });
});

describe("graphics mode", () => {
  it("defaults high on desktop and honors an explicit override", () => {
    expect(readGraphicsMode("", true)).toBe("high");
    expect(readGraphicsMode("", false)).toBe("low");
    expect(readGraphicsMode("?gfx=low", true)).toBe("low");
    expect(readGraphicsMode("?quality=high", false)).toBe("high");
  });
});

function fill(
  pixels: Uint8ClampedArray,
  width: number,
  left: number,
  top: number,
  w: number,
  h: number,
  color: [number, number, number],
): void {
  for (let y = top; y < top + h; y++) {
    for (let x = left; x < left + w; x++) {
      const index = (y * width + x) * 4;
      pixels[index] = color[0];
      pixels[index + 1] = color[1];
      pixels[index + 2] = color[2];
      pixels[index + 3] = 255;
    }
  }
}
