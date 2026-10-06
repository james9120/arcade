import * as THREE from "three";
import type { TownMap } from "../game/types";
import { findOpenings, groupBlocks, roofRowCount, type Block, type Opening } from "./footprints";

export interface WetSurface {
  material: THREE.MeshPhongMaterial;
  kind: "roof" | "wall" | "leaf";
  base: [number, number, number];
}

const WALL_HEIGHT = 1.22;
const ROOF_RISE = 0.7;
const OVERHANG = 0.34;
const ROOF_THICKNESS = 0.1;

export function applyWetness(surfaces: WetSurface[], wetness: number): void {
  for (const surface of surfaces) {
    const gain = surface.kind === "roof" ? 1 : surface.kind === "leaf" ? 0.4 : 0.62;
    const gloss = wetness * gain;
    const tint = 1 - gloss * (surface.kind === "roof" ? 0.34 : 0.2);
    surface.material.color.setRGB(surface.base[0] * tint, surface.base[1] * tint, surface.base[2] * tint);
    surface.material.shininess = gloss * 78;
    surface.material.specular.setRGB(gloss * 0.42, gloss * 0.48, gloss * 0.55);
  }
}

export function addStructures(
  scene: THREE.Scene,
  town: TownMap,
  geometries: THREE.BufferGeometry[],
  materials: THREE.Material[],
  textures: THREE.Texture[],
): WetSurface[] {
  const surfaces: WetSurface[] = [];
  const fenceDisc = softDisc(textures);
  for (const block of groupBlocks(town)) {
    if (block.role === "building") addBuilding(scene, block, geometries, materials, textures, surfaces);
    else if (block.role === "fence") addFence(scene, block, geometries, materials, surfaces, fenceDisc);
    else addLedge(scene, block, geometries, materials, textures, surfaces);
  }
  return surfaces;
}

function addBuilding(
  scene: THREE.Scene,
  block: Block,
  geometries: THREE.BufferGeometry[],
  materials: THREE.Material[],
  textures: THREE.Texture[],
  surfaces: WetSurface[],
): void {
  const width = block.maxX - block.minX + 1;
  const depth = block.maxY - block.minY + 1;
  const roofRows = roofRowCount(block);
  const facade = composeRows(block, block.minY + roofRows, depth - roofRows);
  const roofNorth = composeRows(block, block.minY, Math.max(1, Math.ceil(roofRows / 2)));
  const roofSouth = composeRows(block, block.minY + Math.floor(roofRows / 2), Math.max(1, roofRows - Math.floor(roofRows / 2)));
  if (!facade || !roofNorth || !roofSouth) return;

  const group = new THREE.Group();
  group.position.set(block.minX - 0.5, 0, block.minY - 0.5);
  scene.add(group);

  const openings = findOpenings(facade.pixels, facade.width, facade.height);
  const wallPixels = wallStrip(facade.pixels, facade.width, facade.height, openings);
  const wallTint = averageColor(wallPixels);
  const roofTint = averageColor(roofSouth.pixels);
  const punched = punchOpenings(facade.pixels, facade.width, facade.height, openings);

  const facadeMaterial = mappedMaterial(punched, facade.width, facade.height, textures, materials, surfaces, "wall", 1, 1, true);
  const wallMaterial = mappedMaterial(wallPixels, 16, wallPixels.length / 4 / 16, textures, materials, surfaces, "wall", width, 1, false);
  const sideMaterial = mappedMaterial(wallPixels, 16, wallPixels.length / 4 / 16, textures, materials, surfaces, "wall", depth, 1, false);
  const southRoof = mappedMaterial(roofSouth.pixels, roofSouth.width, roofSouth.height, textures, materials, surfaces, "roof", 1, 1, false);
  const northRoof = mappedMaterial(roofNorth.pixels, roofNorth.width, roofNorth.height, textures, materials, surfaces, "roof", 1, 1, false);
  const trim = solidMaterial(scaleColor(roofTint, 0.62), materials, surfaces, "roof");
  const jamb = solidMaterial(scaleColor(wallTint, 0.38), materials, surfaces, "wall");
  const sill = solidMaterial(scaleColor(wallTint, 0.82), materials, surfaces, "wall");

  const ridgeZ = (roofRows / Math.max(1, depth)) * depth;
  group.add(roofMesh(geometries, southRoof, northRoof, trim, width, depth, ridgeZ));
  group.add(wallMesh(geometries, facadeMaterial, "south", width, depth));
  group.add(wallMesh(geometries, wallMaterial, "north", width, depth));
  group.add(wallMesh(geometries, sideMaterial, "west", width, depth));
  group.add(wallMesh(geometries, sideMaterial, "east", width, depth));
  group.add(gableMesh(geometries, sideMaterial, depth, ridgeZ, 0));
  group.add(gableMesh(geometries, sideMaterial, depth, ridgeZ, width));

  for (const opening of openings) {
    addOpening(group, opening, facade, width, depth, geometries, materials, textures, surfaces, jamb, sill);
  }
  group.add(contactAo(width, depth, geometries, materials, textures));
}

function addOpening(
  group: THREE.Group,
  opening: Opening,
  facade: ImageBuffer,
  width: number,
  depth: number,
  geometries: THREE.BufferGeometry[],
  materials: THREE.Material[],
  textures: THREE.Texture[],
  surfaces: WetSurface[],
  jamb: THREE.Material,
  sill: THREE.Material,
): void {
  const crop = cropImage(facade.pixels, facade.width, facade.height, opening);
  const material = mappedMaterial(crop.pixels, crop.width, crop.height, textures, materials, surfaces, "wall", 1, 1, false);
  const ow = (opening.w / facade.width) * width;
  const oh = (opening.h / facade.height) * WALL_HEIGHT;
  const cx = ((opening.x + opening.w / 2) / facade.width) * width;
  const cy = WALL_HEIGHT - ((opening.y + opening.h / 2) / facade.height) * WALL_HEIGHT;
  const inset = opening.kind === "door" ? 0.16 : 0.1;
  const panel = new THREE.Mesh(track(geometries, new THREE.PlaneGeometry(ow, oh)), material);
  panel.position.set(cx, cy, depth - inset);
  panel.castShadow = true;
  panel.receiveShadow = true;
  group.add(panel);

  const backZ = panel.position.z;
  const faceZ = backZ + inset;
  addJamb(group, geometries, jamb, cx - ow / 2, cy, (backZ + faceZ) / 2, 0.05, oh, inset + 0.01);
  addJamb(group, geometries, jamb, cx + ow / 2, cy, (backZ + faceZ) / 2, 0.05, oh, inset + 0.01);
  addJamb(group, geometries, jamb, cx, cy + oh / 2, (backZ + faceZ) / 2, ow, 0.05, inset + 0.01);
  if (opening.kind === "window") {
    addJamb(group, geometries, jamb, cx, cy - oh / 2, (backZ + faceZ) / 2, ow, 0.05, inset + 0.01);
    const lip = new THREE.Mesh(track(geometries, new THREE.BoxGeometry(ow * 1.04, 0.035, 0.08)), sill);
    lip.position.set(cx, cy - oh / 2, faceZ + 0.03);
    lip.castShadow = true;
    lip.receiveShadow = true;
    group.add(lip);
  }
}

function addJamb(
  group: THREE.Group,
  geometries: THREE.BufferGeometry[],
  material: THREE.Material,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
): void {
  const mesh = new THREE.Mesh(track(geometries, new THREE.BoxGeometry(w, h, d)), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
}

function wallMesh(
  geometries: THREE.BufferGeometry[],
  material: THREE.Material,
  side: "south" | "north" | "west" | "east",
  width: number,
  depth: number,
): THREE.Mesh {
  const geometry = track(geometries, new THREE.PlaneGeometry(side === "west" || side === "east" ? depth : width, WALL_HEIGHT));
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = `${side}-wall`;
  if (side === "south") mesh.position.set(width / 2, WALL_HEIGHT / 2, depth);
  if (side === "north") {
    mesh.position.set(width / 2, WALL_HEIGHT / 2, 0);
    mesh.rotation.y = Math.PI;
  }
  if (side === "west") {
    mesh.position.set(0, WALL_HEIGHT / 2, depth / 2);
    mesh.rotation.y = Math.PI / 2;
  }
  if (side === "east") {
    mesh.position.set(width, WALL_HEIGHT / 2, depth / 2);
    mesh.rotation.y = -Math.PI / 2;
  }
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function gableMesh(
  geometries: THREE.BufferGeometry[],
  material: THREE.Material,
  depth: number,
  ridgeZ: number,
  x: number,
): THREE.Mesh {
  const positions = [
    x, WALL_HEIGHT, 0,
    x, WALL_HEIGHT, depth,
    x, WALL_HEIGHT + ROOF_RISE - 0.02, ridgeZ,
  ];
  const geometry = track(geometries, new THREE.BufferGeometry());
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  const peak = ridgeZ / Math.max(depth, 0.001);
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 1, 0, peak, 1], 2));
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function roofMesh(
  geometries: THREE.BufferGeometry[],
  southMaterial: THREE.Material,
  northMaterial: THREE.Material,
  trim: THREE.Material,
  width: number,
  depth: number,
  ridgeZ: number,
): THREE.Group {
  const roof = new THREE.Group();
  const x0 = -OVERHANG;
  const x1 = width + OVERHANG;
  const yEave = WALL_HEIGHT;
  const yRidge = WALL_HEIGHT + ROOF_RISE;
  const south = slopeGeometry(
    geometries,
    [
      [x0, yEave, depth + OVERHANG],
      [x1, yEave, depth + OVERHANG],
      [x1, yRidge, ridgeZ],
      [x0, yRidge, ridgeZ],
    ],
    [0, 0, 1, 0, 1, 1, 0, 1],
  );
  const north = slopeGeometry(
    geometries,
    [
      [x1, yEave, -OVERHANG],
      [x0, yEave, -OVERHANG],
      [x0, yRidge, ridgeZ],
      [x1, yRidge, ridgeZ],
    ],
    [0, 1, 1, 1, 1, 0, 0, 0],
  );
  roof.add(shaded(south, southMaterial));
  roof.add(shaded(north, northMaterial));
  roof.add(shaded(slopeGeometry(geometries, [
    [x0, yEave - ROOF_THICKNESS, depth + OVERHANG],
    [x0, yRidge - ROOF_THICKNESS, ridgeZ],
    [x1, yRidge - ROOF_THICKNESS, ridgeZ],
    [x1, yEave - ROOF_THICKNESS, depth + OVERHANG],
  ]), trim));
  roof.add(shaded(slopeGeometry(geometries, [
    [x0, yEave - ROOF_THICKNESS, -OVERHANG],
    [x1, yEave - ROOF_THICKNESS, -OVERHANG],
    [x1, yRidge - ROOF_THICKNESS, ridgeZ],
    [x0, yRidge - ROOF_THICKNESS, ridgeZ],
  ]), trim));
  roof.add(fascia(geometries, trim, x0, x1, yEave, depth + OVERHANG, true));
  roof.add(fascia(geometries, trim, x0, x1, yEave, -OVERHANG, false));
  roof.add(edgeFascia(geometries, trim, x1, yEave, yRidge, depth + OVERHANG, ridgeZ));
  roof.add(edgeFascia(geometries, trim, x0, yEave, yRidge, depth + OVERHANG, ridgeZ));
  roof.add(edgeFascia(geometries, trim, x1, yEave, yRidge, -OVERHANG, ridgeZ));
  roof.add(edgeFascia(geometries, trim, x0, yEave, yRidge, -OVERHANG, ridgeZ));
  return roof;
}

function slopeGeometry(
  geometries: THREE.BufferGeometry[],
  corners: Array<[number, number, number]>,
  uvs: number[] = [0, 0, 1, 0, 1, 1, 0, 1],
): THREE.BufferGeometry {
  const positions: number[] = [];
  for (const corner of corners) positions.push(...corner);
  const geometry = track(geometries, new THREE.BufferGeometry());
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  geometry.computeVertexNormals();
  return geometry;
}

function shaded(geometry: THREE.BufferGeometry, material: THREE.Material): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function fascia(
  geometries: THREE.BufferGeometry[],
  material: THREE.Material,
  x0: number,
  x1: number,
  y: number,
  z: number,
  south: boolean,
): THREE.Mesh {
  const y0 = y - ROOF_THICKNESS;
  const corners: Array<[number, number, number]> = south
    ? [[x0, y0, z], [x1, y0, z], [x1, y, z], [x0, y, z]]
    : [[x1, y0, z], [x0, y0, z], [x0, y, z], [x1, y, z]];
  return shaded(slopeGeometry(geometries, corners), material);
}

function edgeFascia(
  geometries: THREE.BufferGeometry[],
  material: THREE.Material,
  x: number,
  yEave: number,
  yRidge: number,
  zEave: number,
  zRidge: number,
): THREE.Mesh {
  const corners: Array<[number, number, number]> = [
    [x, yEave - ROOF_THICKNESS, zEave],
    [x, yEave, zEave],
    [x, yRidge, zRidge],
    [x, yRidge - ROOF_THICKNESS, zRidge],
  ];
  return shaded(slopeGeometry(geometries, corners), material);
}

function addFence(
  scene: THREE.Scene,
  block: Block,
  geometries: THREE.BufferGeometry[],
  materials: THREE.Material[],
  surfaces: WetSurface[],
  disc: THREE.Texture,
): void {
  const sample = block.cells.find((placed) => placed.cell.pixels)?.cell.pixels;
  const color: [number, number, number] = sample ? averageColor(sample) : [0.62, 0.66, 0.7];
  const postMaterial = solidMaterial(color, materials, surfaces, "wall");
  const railMaterial = solidMaterial(scaleColor(color, 0.78), materials, surfaces, "wall");
  const horizontal = block.maxX - block.minX >= block.maxY - block.minY;
  const post = track(geometries, new THREE.BoxGeometry(0.16, 0.48, 0.16));
  const length = horizontal ? block.maxX - block.minX + 1 : block.maxY - block.minY + 1;
  const rail = new THREE.Mesh(
    track(geometries, new THREE.BoxGeometry(horizontal ? length : 0.1, 0.08, horizontal ? 0.1 : length)),
    railMaterial,
  );
  const midX = (block.minX + block.maxX) / 2;
  const midY = (block.minY + block.maxY) / 2;
  rail.position.set(midX, 0.3, midY);
  rail.castShadow = true;
  rail.receiveShadow = true;
  scene.add(rail);
  for (const placed of block.cells) {
    for (const along of [0.28, 0.72]) {
      const mesh = new THREE.Mesh(post, postMaterial);
      mesh.position.set(horizontal ? placed.x - 0.5 + along : placed.x, 0.24, horizontal ? placed.y : placed.y - 0.5 + along);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
    }
  }
  const shadow = new THREE.Mesh(
    track(geometries, new THREE.PlaneGeometry(horizontal ? length + 0.4 : 0.7, horizontal ? 0.7 : length + 0.4)),
    track(materials, new THREE.MeshBasicMaterial({ map: disc, transparent: true, depthWrite: false, color: "#1c2418" })),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(midX, 0.025, midY);
  shadow.layers.set(2);
  scene.add(shadow);
}

function addLedge(
  scene: THREE.Scene,
  block: Block,
  geometries: THREE.BufferGeometry[],
  materials: THREE.Material[],
  textures: THREE.Texture[],
  surfaces: WetSurface[],
): void {
  for (const placed of block.cells) {
    const pixels = placed.cell.pixels;
    const top = pixels
      ? mappedMaterial(pixels, 16, 16, textures, materials, surfaces, "wall", 1, 1, false)
      : solidMaterial([0.45, 0.32, 0.24], materials, surfaces, "wall");
    const side = solidMaterial(scaleColor(pixels ? averageColor(pixels) : [0.45, 0.32, 0.24], 0.55), materials, surfaces, "wall");
    const mesh = new THREE.Mesh(track(geometries, new THREE.BoxGeometry(1.02, 0.42, 1.02)), [side, side, top, side, top, side]);
    mesh.position.set(placed.x, 0.21, placed.y);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
  }
}

function contactAo(
  width: number,
  depth: number,
  geometries: THREE.BufferGeometry[],
  materials: THREE.Material[],
  textures: THREE.Texture[],
): THREE.Mesh {
  const pad = 0.62;
  const scale = 28;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(8, Math.ceil((width + pad * 2) * scale));
  canvas.height = Math.max(8, Math.ceil((depth + pad * 2) * scale));
  const context = canvas.getContext("2d");
  const material = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, color: "#ffffff" });
  materials.push(material);
  if (context) {
    const image = context.createImageData(canvas.width, canvas.height);
    const left = (pad / (width + pad * 2)) * canvas.width;
    const top = (pad / (depth + pad * 2)) * canvas.height;
    const right = canvas.width - left;
    const bottom = canvas.height - top;
    const fade = pad * scale;
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const dx = x < left ? left - x : x > right ? x - right : 0;
        const dy = y < top ? top - y : y > bottom ? y - bottom : 0;
        const outside = Math.hypot(dx, dy);
        const innerX = x >= left && x <= right ? Math.min(x - left, right - x) : fade;
        const innerY = y >= top && y <= bottom ? Math.min(y - top, bottom - y) : fade;
        const inside = Math.min(innerX, innerY);
        let alpha = 0;
        if (outside > 0 && outside < fade) alpha = (1 - outside / fade) * 150;
        else if (outside === 0 && inside < fade * 0.35) alpha = (1 - inside / (fade * 0.35)) * 110;
        const index = (y * canvas.width + x) * 4;
        image.data[index] = 18;
        image.data[index + 1] = 22;
        image.data[index + 2] = 16;
        image.data[index + 3] = Math.round(alpha);
      }
    }
    context.putImageData(image, 0, 0);
    const texture = textureFromCanvas(canvas, textures);
    material.map = texture;
  }
  const mesh = new THREE.Mesh(
    track(geometries, new THREE.PlaneGeometry(width + pad * 2, depth + pad * 2)),
    material,
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(width / 2, 0.03, depth / 2);
  mesh.layers.set(2);
  mesh.renderOrder = 1;
  return mesh;
}

interface ImageBuffer {
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
}

function composeRows(block: Block, startY: number, rows: number): ImageBuffer | null {
  if (rows <= 0) return null;
  const tilesX = block.maxX - block.minX + 1;
  const width = tilesX * 16;
  const height = rows * 16;
  const pixels = new Uint8ClampedArray(width * height * 4);
  let copied = 0;
  for (const placed of block.cells) {
    if (placed.y < startY || placed.y >= startY + rows || !placed.cell.pixels) continue;
    const tileX = placed.x - block.minX;
    const tileY = placed.y - startY;
    blit(pixels, width, placed.cell.pixels, tileX * 16, tileY * 16);
    copied += 1;
  }
  if (copied === 0) return null;
  return { pixels, width, height };
}

function blit(target: Uint8ClampedArray, targetWidth: number, source: Uint8ClampedArray, left: number, top: number): void {
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const from = (y * 16 + x) * 4;
      const to = ((top + y) * targetWidth + left + x) * 4;
      target[to] = source[from];
      target[to + 1] = source[from + 1];
      target[to + 2] = source[from + 2];
      target[to + 3] = source[from + 3] || 255;
    }
  }
}

function punchOpenings(pixels: Uint8ClampedArray, width: number, height: number, openings: Opening[]): Uint8ClampedArray {
  const copy = new Uint8ClampedArray(pixels);
  for (const opening of openings) {
    for (let y = opening.y; y < opening.y + opening.h && y < height; y++) {
      for (let x = opening.x; x < opening.x + opening.w && x < width; x++) {
        copy[(y * width + x) * 4 + 3] = 0;
      }
    }
  }
  return copy;
}

function cropImage(pixels: Uint8ClampedArray, width: number, height: number, opening: Opening): ImageBuffer {
  const cropW = Math.max(1, opening.w);
  const cropH = Math.max(1, opening.h);
  const cropped = new Uint8ClampedArray(cropW * cropH * 4);
  for (let y = 0; y < cropH; y++) {
    for (let x = 0; x < cropW; x++) {
      const from = ((opening.y + y) * width + opening.x + x) * 4;
      const to = (y * cropW + x) * 4;
      if (opening.y + y >= height || opening.x + x >= width) continue;
      cropped[to] = pixels[from];
      cropped[to + 1] = pixels[from + 1];
      cropped[to + 2] = pixels[from + 2];
      cropped[to + 3] = 255;
    }
  }
  return { pixels: cropped, width: cropW, height: cropH };
}

function wallStrip(pixels: Uint8ClampedArray, width: number, height: number, openings: Opening[]): Uint8ClampedArray {
  const covered = (x: number, y: number) =>
    openings.some((opening) => x >= opening.x && x < opening.x + opening.w && y >= opening.y && y < opening.y + opening.h);
  let bestX = 0;
  let bestScore = Number.POSITIVE_INFINITY;
  const column = 8;
  for (let x = 0; x + column <= width; x += 4) {
    let count = 0;
    let blocked = 0;
    const sum = [0, 0, 0];
    const sumSq = [0, 0, 0];
    for (let y = 0; y < height; y++) {
      for (let dx = 0; dx < column; dx++) {
        if (covered(x + dx, y)) {
          blocked += 1;
          continue;
        }
        const index = (y * width + x + dx) * 4;
        for (let channel = 0; channel < 3; channel++) {
          const value = pixels[index + channel];
          sum[channel] += value;
          sumSq[channel] += value * value;
        }
        count += 1;
      }
    }
    if (count < height) continue;
    let variance = 0;
    for (let channel = 0; channel < 3; channel++) {
      const mean = sum[channel] / count;
      variance += sumSq[channel] / count - mean * mean;
    }
    const score = variance + blocked * 8;
    if (score < bestScore) {
      bestScore = score;
      bestX = x;
    }
  }
  const strip = new Uint8ClampedArray(16 * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < 16; x++) {
      const sx = Math.min(width - 1, bestX + (x % column));
      const from = (y * width + sx) * 4;
      const to = (y * 16 + x) * 4;
      strip[to] = pixels[from];
      strip[to + 1] = pixels[from + 1];
      strip[to + 2] = pixels[from + 2];
      strip[to + 3] = 255;
    }
  }
  return strip;
}

function mappedMaterial(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  textures: THREE.Texture[],
  materials: THREE.Material[],
  surfaces: WetSurface[],
  kind: WetSurface["kind"],
  repeatX: number,
  repeatY: number,
  alphaTest: boolean,
): THREE.MeshPhongMaterial {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, width);
  canvas.height = Math.max(1, height);
  const context = canvas.getContext("2d");
  if (context) context.putImageData(new ImageData(new Uint8ClampedArray(pixels), canvas.width, canvas.height), 0, 0);
  const texture = textureFromCanvas(canvas, textures);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  const material = new THREE.MeshPhongMaterial({
    map: texture,
    color: "#ffffff",
    shininess: 0,
    specular: new THREE.Color("#000000"),
    side: THREE.DoubleSide,
    alphaTest: alphaTest ? 0.45 : 0,
  });
  materials.push(material);
  surfaces.push({ material, kind, base: [1, 1, 1] });
  return material;
}

function solidMaterial(
  color: [number, number, number],
  materials: THREE.Material[],
  surfaces: WetSurface[],
  kind: WetSurface["kind"],
): THREE.MeshPhongMaterial {
  const material = new THREE.MeshPhongMaterial({
    color: new THREE.Color(color[0], color[1], color[2]),
    shininess: 0,
    specular: new THREE.Color("#000000"),
    side: THREE.DoubleSide,
  });
  materials.push(material);
  surfaces.push({ material, kind, base: color });
  return material;
}

function textureFromCanvas(canvas: HTMLCanvasElement, textures: THREE.Texture[]): THREE.Texture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.premultiplyAlpha = false;
  textures.push(texture);
  return texture;
}

function softDisc(textures: THREE.Texture[]): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext("2d");
  if (context) {
    const gradient = context.createRadialGradient(32, 32, 4, 32, 32, 32);
    gradient.addColorStop(0, "rgba(20,24,16,0.55)");
    gradient.addColorStop(1, "rgba(20,24,16,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 64, 64);
  }
  return textureFromCanvas(canvas, textures);
}

function averageColor(pixels: Uint8ClampedArray): [number, number, number] {
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
  if (count === 0) return [0.55, 0.5, 0.45];
  return [red / count / 255, green / count / 255, blue / count / 255];
}

function scaleColor(color: [number, number, number], scale: number): [number, number, number] {
  return [color[0] * scale, color[1] * scale, color[2] * scale];
}

function track<T>(list: T[], item: T): T {
  list.push(item);
  return item;
}
