import type { TileVisual, TownMap } from "../game/types";

const TILE = 32;

export function paintTown(town: TownMap): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = town.width * TILE;
  canvas.height = town.height * TILE;
  const context = canvas.getContext("2d");
  if (!context) return canvas;
  context.imageSmoothingEnabled = false;

  const chip = document.createElement("canvas");
  chip.width = 16;
  chip.height = 16;
  const chipContext = chip.getContext("2d");

  for (let y = 0; y < town.height; y++) {
    for (let x = 0; x < town.width; x++) {
      const cell = town.cells[y * town.width + x];
      const left = x * TILE;
      const top = y * TILE;
      if (cell.pixels && chipContext) {
        context.fillStyle = baseColor(cell.visual);
        context.fillRect(left, top, TILE, TILE);
        const image = new ImageData(new Uint8ClampedArray(cell.pixels), 16, 16);
        chipContext.putImageData(image, 0, 0);
        context.drawImage(chip, left, top, TILE, TILE);
      } else {
        paintDemoTile(context, cell.visual, left, top, TILE, x, y);
      }
    }
  }
  return canvas;
}

export function buildingTexture(kind: "wall" | "roof" | "door" | "fence" | "sign"): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext("2d");
  if (!context) return canvas;
  if (kind === "wall") {
    context.fillStyle = "#f4e6cf";
    context.fillRect(0, 0, 64, 64);
    context.fillStyle = "#e7d3b4";
    context.fillRect(0, 0, 64, 8);
    context.fillStyle = "#8ec6e4";
    context.fillRect(18, 16, 28, 22);
    context.strokeStyle = "#f7f3ea";
    context.lineWidth = 3;
    context.strokeRect(18, 16, 28, 22);
    context.fillStyle = "#d7c4a4";
    context.fillRect(0, 56, 64, 8);
  } else if (kind === "roof") {
    context.fillStyle = "#c24b3a";
    context.fillRect(0, 0, 64, 64);
    context.fillStyle = "#a63d30";
    for (let y = 6; y < 64; y += 12) context.fillRect(0, y, 64, 3);
    context.fillStyle = "#d86a52";
    context.fillRect(0, 0, 64, 6);
  } else if (kind === "door") {
    context.fillStyle = "#6b3f2c";
    context.fillRect(0, 0, 64, 64);
    context.fillStyle = "#8a5640";
    context.fillRect(10, 8, 44, 50);
    context.fillStyle = "#e6c56a";
    context.beginPath();
    context.arc(46, 34, 3, 0, Math.PI * 2);
    context.fill();
  } else if (kind === "fence") {
    context.fillStyle = "#d8bc86";
    context.fillRect(0, 0, 64, 64);
    context.fillStyle = "#b48b52";
    context.fillRect(6, 8, 8, 48);
    context.fillRect(50, 8, 8, 48);
    context.fillRect(6, 16, 52, 6);
    context.fillRect(6, 36, 52, 6);
  } else {
    context.fillStyle = "#e7d7a4";
    context.fillRect(0, 0, 64, 64);
    context.fillStyle = "#f7f1da";
    context.fillRect(8, 10, 48, 32);
    context.fillStyle = "#8a6a3a";
    context.fillRect(28, 42, 8, 18);
  }
  return canvas;
}

function paintDemoTile(
  context: CanvasRenderingContext2D,
  visual: TileVisual,
  left: number,
  top: number,
  size: number,
  gx: number,
  gy: number,
): void {
  const rand = mulberry32((gx + 1) * 374761393 + (gy + 1) * 668265263);
  if (visual === "path") {
    context.fillStyle = mix("#d7be96", "#c9ae84", rand());
    context.fillRect(left, top, size, size);
    context.fillStyle = "rgba(120, 86, 48, 0.28)";
    for (let i = 0; i < 5; i++) {
      context.fillRect(left + rand() * 26, top + rand() * 26, 2, 2);
    }
    return;
  }
  if (visual === "water") {
    context.fillStyle = "#2d78aa";
    context.fillRect(left, top, size, size);
    context.fillStyle = "rgba(255,255,255,0.28)";
    context.fillRect(left, top + 8 + (gx % 3), size, 2);
    context.fillRect(left + 4, top + 20, 16, 2);
    return;
  }
  if (visual === "shore") {
    context.fillStyle = "#e6d2a6";
    context.fillRect(left, top, size, size);
    context.fillStyle = "rgba(160, 120, 70, 0.35)";
    for (let i = 0; i < 6; i++) context.fillRect(left + rand() * 28, top + rand() * 28, 2, 2);
    return;
  }
  if (visual === "wall" || visual === "roof" || visual === "door") {
    context.fillStyle = "#b7a48a";
    context.fillRect(left, top, size, size);
    return;
  }

  context.fillStyle = mix("#63a044", "#74b250", rand());
  context.fillRect(left, top, size, size);
  context.fillStyle = "rgba(40, 90, 30, 0.25)";
  for (let i = 0; i < 4; i++) context.fillRect(left + rand() * 28, top + rand() * 28, 2, 3);

  if (visual === "tallGrass") {
    context.fillStyle = "#245c28";
    context.fillRect(left, top, size, size);
    for (let i = 0; i < 8; i++) {
      context.fillStyle = i % 2 === 0 ? "#8fd15a" : "#3e8a34";
      const bladeX = left + 2 + (i % 4) * 7 + (rand() * 2);
      context.fillRect(bladeX, top + 4 + rand() * 8, 2, 14);
    }
  } else if (visual === "flower") {
    const colors = ["#f2d15a", "#e07ab0", "#f7f4ea"];
    for (let i = 0; i < 3; i++) {
      context.fillStyle = colors[i % colors.length];
      context.beginPath();
      context.arc(left + 8 + i * 7, top + 12 + (i % 2) * 6, 3, 0, Math.PI * 2);
      context.fill();
    }
  }
}

function baseColor(visual: TileVisual): string {
  switch (visual) {
    case "water":
      return "#2d78aa";
    case "path":
      return "#d7be96";
    case "shore":
      return "#e6d2a6";
    case "tallGrass":
      return "#2f6a30";
    case "ledge":
      return "#8d9a62";
    default:
      return "#67a348";
  }
}

function mix(a: string, b: string, t: number): string {
  const from = hex(a);
  const to = hex(b);
  const channel = (index: number) => Math.round(from[index] + (to[index] - from[index]) * t);
  return `rgb(${channel(0)}, ${channel(1)}, ${channel(2)})`;
}

function hex(color: string): [number, number, number] {
  const value = Number.parseInt(color.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let next = state;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}
