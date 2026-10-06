export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** GBA BGR555 palette. `count` is the number of 16-color palettes. */
export function decodePalettes(bytes: Uint8Array, offset: number, count: number): Rgb[][] {
  const palettes: Rgb[][] = [];
  for (let palette = 0; palette < count; palette++) {
    const colors: Rgb[] = [];
    for (let color = 0; color < 16; color++) {
      const at = offset + (palette * 16 + color) * 2;
      const value = at + 1 < bytes.length ? bytes[at] | (bytes[at + 1] << 8) : 0;
      colors.push({
        r: Math.round(((value >> 0) & 31) * 255 / 31),
        g: Math.round(((value >> 5) & 31) * 255 / 31),
        b: Math.round(((value >> 10) & 31) * 255 / 31),
      });
    }
    palettes.push(colors);
  }
  return palettes;
}

export interface MetatileSource {
  /** Primary graphics first, then secondary, each tile 32 bytes of 4bpp. */
  tiles: Uint8Array;
  palettes: Rgb[][];
  /** Eight u16 tile entries, little-endian, for one metatile. */
  entries: Uint8Array;
}

/**
 * Composite one 16×16 metatile. Color 0 is transparent.
 * Entry bits: 0–9 tile, 10 horizontal flip, 11 vertical flip, 12–15 palette.
 * Entries 0–3 are the bottom layer (TL, TR, BL, BR); 4–7 are the top layer.
 */
/**
 * Blit a GBA 4bpp sprite sheet. Tiles are 8×8, left to right, top to bottom.
 * Palette index 0 is transparent.
 */
export function renderSprite(
  tiles: Uint8Array,
  palette: Rgb[],
  width: number,
  height: number,
): Uint8ClampedArray {
  const image = new Uint8ClampedArray(width * height * 4);
  const tilesX = Math.floor(width / 8);
  const tilesY = Math.floor(height / 8);
  for (let tileY = 0; tileY < tilesY; tileY++) {
    for (let tileX = 0; tileX < tilesX; tileX++) {
      const tileIndex = tileY * tilesX + tileX;
      const tileOffset = tileIndex * 32;
      if (tileOffset + 32 > tiles.length) continue;
      for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
          const pixelIndex = y * 8 + x;
          const packed = tiles[tileOffset + (pixelIndex >> 1)];
          const nibble = (pixelIndex & 1) === 0 ? packed & 0xf : packed >> 4;
          if (nibble === 0) continue;
          const color = palette[nibble];
          if (!color) continue;
          const out = ((tileY * 8 + y) * width + (tileX * 8 + x)) * 4;
          image[out] = color.r;
          image[out + 1] = color.g;
          image[out + 2] = color.b;
          image[out + 3] = 255;
        }
      }
    }
  }
  return image;
}

export function renderMetatile(source: MetatileSource): Uint8ClampedArray {
  const image = new Uint8ClampedArray(16 * 16 * 4);
  const quads: Array<[number, number]> = [
    [0, 0],
    [8, 0],
    [0, 8],
    [8, 8],
  ];
  for (let layer = 0; layer < 2; layer++) {
    for (let quad = 0; quad < 4; quad++) {
      const entryIndex = layer * 4 + quad;
      const byteAt = entryIndex * 2;
      const entry = source.entries[byteAt] | (source.entries[byteAt + 1] << 8);
      blitTile(image, source, entry, quads[quad][0], quads[quad][1]);
    }
  }
  return image;
}

function blitTile(
  image: Uint8ClampedArray,
  source: MetatileSource,
  entry: number,
  destX: number,
  destY: number,
): void {
  const tileId = entry & 0x3ff;
  const hFlip = (entry & 0x400) !== 0;
  const vFlip = (entry & 0x800) !== 0;
  const paletteIndex = (entry >> 12) & 0xf;
  const palette = source.palettes[paletteIndex];
  if (!palette) return;

  const tileOffset = tileId * 32;
  if (tileOffset < 0 || tileOffset + 32 > source.tiles.length) return;

  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const sampleX = hFlip ? 7 - x : x;
      const sampleY = vFlip ? 7 - y : y;
      const pixelIndex = sampleY * 8 + sampleX;
      const packed = source.tiles[tileOffset + (pixelIndex >> 1)];
      const nibble = (pixelIndex & 1) === 0 ? packed & 0xf : packed >> 4;
      if (nibble === 0) continue;
      const color = palette[nibble];
      if (!color) continue;
      const out = ((destY + y) * 16 + (destX + x)) * 4;
      image[out] = color.r;
      image[out + 1] = color.g;
      image[out + 2] = color.b;
      image[out + 3] = 255;
    }
  }
}
