import type { Cell } from "../game/types";

export interface PlacedCell {
  x: number;
  y: number;
  cell: Cell;
}

export interface Block {
  role: "building" | "fence" | "ledge";
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  cells: PlacedCell[];
}

export interface Opening {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: "window" | "door";
}

interface Grid {
  width: number;
  height: number;
  cells: Cell[];
}

/** Connected structure tiles become a house, a fence run, or a cliff. */
export function groupBlocks(town: Grid): Block[] {
  const seen = new Uint8Array(town.width * town.height);
  const blocks: Block[] = [];
  for (let y = 0; y < town.height; y++) {
    for (let x = 0; x < town.width; x++) {
      const index = y * town.width + x;
      if (seen[index] || town.cells[index]?.kind !== "structure") continue;
      const cells: PlacedCell[] = [];
      const stack = [[x, y]];
      seen[index] = 1;
      while (stack.length > 0) {
        const [cx, cy] = stack.pop() as [number, number];
        cells.push({ x: cx, y: cy, cell: town.cells[cy * town.width + cx] });
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= town.width || ny >= town.height) continue;
          const next = ny * town.width + nx;
          if (seen[next] || town.cells[next]?.kind !== "structure") continue;
          seen[next] = 1;
          stack.push([nx, ny]);
        }
      }
      blocks.push(classify(cells));
    }
  }
  return blocks;
}

function classify(cells: PlacedCell[]): Block {
  let minX = cells[0].x;
  let maxX = cells[0].x;
  let minY = cells[0].y;
  let maxY = cells[0].y;
  let roofs = 0;
  for (const placed of cells) {
    minX = Math.min(minX, placed.x);
    maxX = Math.max(maxX, placed.x);
    minY = Math.min(minY, placed.y);
    maxY = Math.max(maxY, placed.y);
    if (placed.cell.visual === "roof") roofs += 1;
  }
  const width = maxX - minX + 1;
  const height = maxY - minY + 1;
  const building = width >= 3 && height >= 3 && cells.length >= 8;
  const role = building ? "building" : roofs * 2 >= cells.length ? "ledge" : "fence";
  return { role, minX, maxX, minY, maxY, cells };
}

/** Northern rows are the roof in these outdoor maps; the south rows are the front wall. */
export function roofRowCount(block: Block): number {
  const height = block.maxY - block.minY + 1;
  if (height < 2) return 1;
  const rows: Array<[number, number, number]> = [];
  for (let y = block.minY; y <= block.maxY; y++) {
    const color: [number, number, number] = [0, 0, 0];
    let count = 0;
    for (const placed of block.cells) {
      if (placed.y !== y || !placed.cell.pixels) continue;
      const sample = averageChannels(placed.cell.pixels);
      color[0] += sample[0];
      color[1] += sample[1];
      color[2] += sample[2];
      count += 1;
    }
    if (count === 0) rows.push([0, 0, 0]);
    else rows.push([color[0] / count, color[1] / count, color[2] / count]);
  }
  let split = Math.max(1, Math.floor(height / 2));
  let best = -1;
  for (let index = 0; index < rows.length - 1; index++) {
    const delta = Math.hypot(
      rows[index][0] - rows[index + 1][0],
      rows[index][1] - rows[index + 1][1],
      rows[index][2] - rows[index + 1][2],
    );
    if (delta > best) {
      best = delta;
      split = index + 1;
    }
  }
  if (split < 1) return 1;
  if (split >= height) return height - 1;
  return split;
}

export function findOpenings(pixels: Uint8ClampedArray, width: number, height: number): Opening[] {
  const glass = components(pixels, width, height, (r, g, b) => b > 145 && b - r > 40 && b - g > 12).filter(
    (rect) => rect.n >= 12 && rect.w >= 4 && rect.h >= 2,
  );
  const merged = mergeClose(glass, 3).map((rect) => pad(rect, width, height, 2, 1, 2, 5, "window"));
  const doors = components(pixels, width, height, (r, g, b) => g > 140 && g - r > 25 && g > b)
    .filter((rect) => rect.w >= 8 && rect.h >= 8 && rect.n >= 24)
    .map((rect) => dropToGround(pad(rect, width, height, 1, 1, 1, 1, "door"), height));
  const panels = components(pixels, width, height, (r, g, b) => r > 220 && g > 220 && b > 200)
    .filter((rect) => rect.w >= 6 && rect.h >= 4 && rect.n >= 16 && rect.w < width * 0.45)
    .map((rect) => dropToGround(pad(rect, width, height, 4, 3, 4, 6, "door"), height));
  const rings = ringWindows(pixels, width, height);
  const openings: Opening[] = [];
  for (const opening of [...doors, ...panels, ...merged, ...rings]) {
    if (opening.w < 4 || opening.h < 4) continue;
    if (opening.w > width * 0.7 || opening.h > height * 0.85) continue;
    if (openings.some((other) => overlapRatio(opening, other) > 0.35)) continue;
    openings.push(opening);
  }
  return openings;
}

function dropToGround(opening: Opening, height: number): Opening {
  if (opening.kind !== "door") return opening;
  if (opening.y + opening.h < height - 6) return opening;
  const bottom = height - 1;
  return { ...opening, h: Math.max(4, bottom - opening.y) };
}

function ringWindows(pixels: Uint8ClampedArray, width: number, height: number): Opening[] {
  const found: Opening[] = [];
  for (let top = 0; top < height; top += 16) {
    for (let left = 0; left < width; left += 16) {
      let count = 0;
      let minX = width;
      let minY = height;
      let maxX = 0;
      let maxY = 0;
      const tileW = Math.min(16, width - left);
      const tileH = Math.min(16, height - top);
      for (let y = 0; y < tileH; y++) {
        for (let x = 0; x < tileW; x++) {
          const index = ((top + y) * width + left + x) * 4;
          const r = pixels[index];
          const g = pixels[index + 1];
          const b = pixels[index + 2];
          if (r < 200 || g < 190 || b < 180 || Math.abs(r - b) > 40) continue;
          count += 1;
          const px = left + x;
          const py = top + y;
          minX = Math.min(minX, px);
          minY = Math.min(minY, py);
          maxX = Math.max(maxX, px);
          maxY = Math.max(maxY, py);
        }
      }
      const w = maxX - minX + 1;
      const h = maxY - minY + 1;
      if (count < 8 || count > 60 || w < 4 || h < 4 || w > 14 || h > 14) continue;
      found.push(pad({ x: minX, y: minY, w, h }, width, height, 3, 3, 3, 3, "window"));
    }
  }
  return found;
}

interface RawRect {
  x: number;
  y: number;
  w: number;
  h: number;
  n: number;
}

function components(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  hit: (r: number, g: number, b: number) => boolean,
): RawRect[] {
  const mask = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;
      if (pixels[index + 3] < 128) continue;
      if (hit(pixels[index], pixels[index + 1], pixels[index + 2])) mask[y * width + x] = 1;
    }
  }
  const seen = new Uint8Array(width * height);
  const rects: RawRect[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!mask[y * width + x] || seen[y * width + x]) continue;
      const stack = [[x, y]];
      seen[y * width + x] = 1;
      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;
      let count = 0;
      while (stack.length > 0) {
        const [cx, cy] = stack.pop() as [number, number];
        count += 1;
        minX = Math.min(minX, cx);
        maxX = Math.max(maxX, cx);
        minY = Math.min(minY, cy);
        maxY = Math.max(maxY, cy);
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const next = ny * width + nx;
          if (!mask[next] || seen[next]) continue;
          seen[next] = 1;
          stack.push([nx, ny]);
        }
      }
      rects.push({ x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1, n: count });
    }
  }
  return rects;
}

function mergeClose(rects: RawRect[], maxGap: number): RawRect[] {
  const pending = rects.map((rect) => ({ ...rect }));
  const used = pending.map(() => false);
  const merged: RawRect[] = [];
  for (let i = 0; i < pending.length; i++) {
    if (used[i]) continue;
    let box = pending[i];
    used[i] = true;
    let grew = true;
    while (grew) {
      grew = false;
      for (let j = 0; j < pending.length; j++) {
        if (used[j]) continue;
        const other = pending[j];
        const gapX = Math.max(box.x, other.x) - Math.min(box.x + box.w, other.x + other.w);
        const gapY = Math.max(box.y, other.y) - Math.min(box.y + box.h, other.y + other.h);
        const overlapX = Math.min(box.x + box.w, other.x + other.w) - Math.max(box.x, other.x);
        const overlapY = Math.min(box.y + box.h, other.y + other.h) - Math.max(box.y, other.y);
        const close = (gapX <= maxGap && overlapY > 0) || (gapY <= maxGap && overlapX > 0);
        if (!close) continue;
        const x0 = Math.min(box.x, other.x);
        const y0 = Math.min(box.y, other.y);
        box = {
          x: x0,
          y: y0,
          w: Math.max(box.x + box.w, other.x + other.w) - x0,
          h: Math.max(box.y + box.h, other.y + other.h) - y0,
          n: box.n + other.n,
        };
        used[j] = true;
        grew = true;
      }
    }
    merged.push(box);
  }
  return merged;
}

function pad(
  rect: { x: number; y: number; w: number; h: number },
  width: number,
  height: number,
  left: number,
  top: number,
  right: number,
  bottom: number,
  kind: Opening["kind"],
): Opening {
  const x = Math.max(1, rect.x - left);
  const y = Math.max(1, rect.y - top);
  const x1 = Math.min(width - 1, rect.x + rect.w + right);
  const y1 = Math.min(height - 1, rect.y + rect.h + bottom);
  return { x, y, w: Math.max(1, x1 - x), h: Math.max(1, y1 - y), kind };
}

function overlapRatio(a: Opening, b: Opening): number {
  const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const overlapY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  if (overlapX <= 0 || overlapY <= 0) return 0;
  const overlap = overlapX * overlapY;
  return overlap / Math.min(a.w * a.h, b.w * b.h);
}

function averageChannels(pixels: Uint8ClampedArray): [number, number, number] {
  let red = 0;
  let green = 0;
  let blue = 0;
  let count = 0;
  for (let index = 0; index < pixels.length; index += 4) {
    if (pixels[index + 3] < 128) continue;
    red += pixels[index];
    green += pixels[index + 1];
    blue += pixels[index + 2];
    count += 1;
  }
  if (count === 0) return [0, 0, 0];
  return [red / count, green / count, blue / count];
}
