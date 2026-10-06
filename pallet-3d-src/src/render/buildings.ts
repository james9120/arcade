import * as THREE from "three";
import type { TownMap } from "../game/types";
import { eaveRowCount, findOpenings, groupBlocks, roofRowCount, type Block, type Opening } from "./footprints";

export interface WetSurface {
  material: THREE.MeshPhongMaterial;
  kind: "roof" | "wall" | "leaf";
  base: [number, number, number];
}

const OVERHANG = 0.375;
const ROOF_THICKNESS = 0.1;
const PITCH = (40 * Math.PI) / 180;

export function applyWetness(surfaces: WetSurface[], wetness: number): void {
  const wet = Math.min(1, Math.max(0, wetness));
  for (const surface of surfaces) {
    if (surface.kind === "roof") {
      const tint = 1 - wet * 0.12;
      surface.material.color.setRGB(surface.base[0] * tint, surface.base[1] * tint, surface.base[2] * tint);
      surface.material.shininess = wet * 22;
      surface.material.specular.setRGB(wet * 0.06, wet * 0.055, wet * 0.04);
    } else if (surface.kind === "leaf") {
      const dark = 1 - wet * 0.18;
      surface.material.color.setRGB(
        surface.base[0] * dark * (1 - wet * 0.08),
        Math.min(1, surface.base[1] * dark * (1 + wet * 0.05)),
        surface.base[2] * dark * (1 - wet * 0.1),
      );
      surface.material.shininess = wet * 2;
      surface.material.specular.setRGB(wet * 0.01, wet * 0.015, wet * 0.008);
    } else {
      const tint = 1 - wet * 0.1;
      surface.material.color.setRGB(surface.base[0] * tint, surface.base[1] * tint, surface.base[2] * tint);
      surface.material.shininess = wet * 8;
      surface.material.specular.setRGB(wet * 0.03, wet * 0.028, wet * 0.02);
    }
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
  const tile = wallTile(facade.pixels, facade.width, facade.height, openings);
  const wallH = width >= 7 ? 2.6 : 2.0;
  const front = frontFace(punchOpenings(facade.pixels, facade.width, facade.height, openings), facade.width, facade.height, tile, wallH);
  const wallTint = averageColor(tile);
  const roofTint = averageColor(roofSouth.pixels);
  const ridgeZ = roofRows;
  const southRun = depth + OVERHANG - ridgeZ;
  const northRun = ridgeZ + OVERHANG;
  const rise = Math.tan(PITCH) * Math.max(0.5, southRun);
  const southLen = Math.hypot(Math.max(0.2, southRun), rise);
  const northLen = Math.hypot(Math.max(0.2, northRun), rise);
  const slopeWidth = width + OVERHANG * 2;
  const shingles = shingleTile(roofNorth.pixels, roofNorth.width, roofNorth.height);

  const facadeMaterial = mappedMaterial(front.pixels, front.width, front.height, textures, materials, surfaces, "wall", 1, 1, true);
  const wallMaterial = mappedMaterial(tile, 16, 16, textures, materials, surfaces, "wall", width, wallH, false);
  const sideMaterial = mappedMaterial(tile, 16, 16, textures, materials, surfaces, "wall", depth, wallH, false);
  const southRoof = mappedMaterial(shingles, 16, 16, textures, materials, surfaces, "roof", slopeWidth, southLen, false);
  const northRoof = mappedMaterial(shingles, 16, 16, textures, materials, surfaces, "roof", slopeWidth, northLen, false);
  const trim = solidMaterial(scaleColor(roofTint, 0.72), materials, surfaces, "roof");
  const jamb = solidMaterial(scaleColor(wallTint, 0.28), materials, surfaces, "wall");
  const sill = solidMaterial(scaleColor(wallTint, 0.9), materials, surfaces, "wall");
  const eavePx = eaveRowCount(roofSouth.pixels, roofSouth.width, roofSouth.height);
  const eave =
    eavePx >= 2
      ? mappedMaterial(
          cropRows(roofSouth.pixels, roofSouth.width, roofSouth.height, roofSouth.height - eavePx, eavePx),
          roofSouth.width,
          eavePx,
          textures,
          materials,
          surfaces,
          "roof",
          slopeWidth / Math.max(1, width),
          1,
          false,
        )
      : null;

  group.add(roofMesh(geometries, southRoof, northRoof, trim, eave, width, depth, ridgeZ, wallH, rise, eavePx, southLen));
  for (const accent of accentTiles(roofSouth.pixels, roofSouth.width, roofSouth.height, eavePx)) {
    const stamp = mappedMaterial(accent.pixels, 16, accent.height, textures, materials, surfaces, "roof", 1, 1, false);
    const quad = stampQuad(geometries, stamp, accent.index, accent.height / 16, width, depth, ridgeZ, wallH, rise, southLen);
    if (quad) group.add(quad);
  }
  group.add(wallMesh(geometries, facadeMaterial, "south", width, depth, wallH));
  group.add(wallMesh(geometries, wallMaterial, "north", width, depth, wallH));
  group.add(wallMesh(geometries, sideMaterial, "west", width, depth, wallH));
  group.add(wallMesh(geometries, sideMaterial, "east", width, depth, wallH));
  group.add(gableMesh(geometries, sideMaterial, depth, ridgeZ, 0, wallH, rise));
  group.add(gableMesh(geometries, sideMaterial, depth, ridgeZ, width, wallH, rise));

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
  const facadeWorld = facade.height / 16;
  const ow = (opening.w / facade.width) * width;
  const oh = (opening.h / facade.height) * facadeWorld;
  const cx = ((opening.x + opening.w / 2) / facade.width) * width;
  const cy = facadeWorld * (1 - (opening.y + opening.h / 2) / facade.height);
  const inset = opening.kind === "door" ? 0.42 : 0.32;
  const panel = new THREE.Mesh(track(geometries, new THREE.PlaneGeometry(ow, oh)), material);
  panel.position.set(cx, cy, depth - inset);
  panel.castShadow = true;
  panel.receiveShadow = true;
  group.add(panel);

  const backZ = panel.position.z;
  const faceZ = backZ + inset;
  const thick = 0.09;
  addJamb(group, geometries, jamb, cx - ow / 2, cy, (backZ + faceZ) / 2, thick, oh, inset + 0.02);
  addJamb(group, geometries, jamb, cx + ow / 2, cy, (backZ + faceZ) / 2, thick, oh, inset + 0.02);
  addJamb(group, geometries, jamb, cx, cy + oh / 2, (backZ + faceZ) / 2, ow, thick, inset + 0.02);
  if (opening.kind === "window") {
    addJamb(group, geometries, jamb, cx, cy - oh / 2, (backZ + faceZ) / 2, ow, thick, inset + 0.02);
    const lip = new THREE.Mesh(track(geometries, new THREE.BoxGeometry(ow * 1.08, 0.06, 0.12)), sill);
    lip.position.set(cx, cy - oh / 2, faceZ + 0.02);
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
  wallH: number,
): THREE.Mesh {
  const geometry = track(geometries, new THREE.PlaneGeometry(side === "west" || side === "east" ? depth : width, wallH));
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = `${side}-wall`;
  if (side === "south") mesh.position.set(width / 2, wallH / 2, depth);
  if (side === "north") {
    mesh.position.set(width / 2, wallH / 2, 0);
    mesh.rotation.y = Math.PI;
  }
  if (side === "west") {
    mesh.position.set(0, wallH / 2, depth / 2);
    mesh.rotation.y = Math.PI / 2;
  }
  if (side === "east") {
    mesh.position.set(width, wallH / 2, depth / 2);
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
  wallH: number,
  rise: number,
): THREE.Mesh {
  const positions = [
    x, wallH, 0,
    x, wallH, depth,
    x, wallH + rise - 0.02, ridgeZ,
  ];
  const geometry = track(geometries, new THREE.BufferGeometry());
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  const peak = ridgeZ / Math.max(depth, 0.001);
  const span = rise / Math.max(wallH, 0.001);
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 1, 0, peak, span], 2));
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
  eave: THREE.Material | null,
  width: number,
  depth: number,
  ridgeZ: number,
  wallH: number,
  rise: number,
  eavePx: number,
  southLen: number,
): THREE.Group {
  const roof = new THREE.Group();
  const x0 = -OVERHANG;
  const x1 = width + OVERHANG;
  const yEave = wallH;
  const yRidge = wallH + rise;
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
  if (eave && eavePx >= 2) {
    const tEnd = Math.min(0.42, eavePx / 16 / Math.max(0.2, southLen));
    const normal = new THREE.Vector3(0, Math.max(0.2, depth + OVERHANG - ridgeZ), rise).normalize();
    const zEave = depth + OVERHANG;
    const lift = 0.03;
    const quad = slopeGeometry(geometries, [
      offsetPoint(x0, 0, wallH, rise, zEave, ridgeZ, normal, lift),
      offsetPoint(x1, 0, wallH, rise, zEave, ridgeZ, normal, lift),
      offsetPoint(x1, tEnd, wallH, rise, zEave, ridgeZ, normal, lift),
      offsetPoint(x0, tEnd, wallH, rise, zEave, ridgeZ, normal, lift),
    ]);
    roof.add(shaded(quad, eave));
  }
  return roof;
}

function offsetPoint(
  x: number,
  t: number,
  wallH: number,
  rise: number,
  zEave: number,
  ridgeZ: number,
  normal: THREE.Vector3,
  lift: number,
): [number, number, number] {
  return [
    x + normal.x * lift,
    wallH + rise * t + normal.y * lift,
    zEave + (ridgeZ - zEave) * t + normal.z * lift,
  ];
}

function stampQuad(
  geometries: THREE.BufferGeometry[],
  material: THREE.Material,
  column: number,
  stampLen: number,
  width: number,
  depth: number,
  ridgeZ: number,
  wallH: number,
  rise: number,
  southLen: number,
): THREE.Mesh | null {
  if (column < 0 || column >= width) return null;
  const tSpan = Math.min(0.5, stampLen / Math.max(0.2, southLen));
  const t0 = Math.max(0.2, 1 - tSpan - 0.05);
  const zEave = depth + OVERHANG;
  const normal = new THREE.Vector3(0, Math.max(0.2, zEave - ridgeZ), rise).normalize();
  const x0 = column;
  const x1 = column + 1;
  const quad = slopeGeometry(geometries, [
    offsetPoint(x0, t0, wallH, rise, zEave, ridgeZ, normal, 0.045),
    offsetPoint(x1, t0, wallH, rise, zEave, ridgeZ, normal, 0.045),
    offsetPoint(x1, t0 + tSpan, wallH, rise, zEave, ridgeZ, normal, 0.045),
    offsetPoint(x0, t0 + tSpan, wallH, rise, zEave, ridgeZ, normal, 0.045),
  ]);
  return shaded(quad, material);
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
  const pad = 0.55;
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
        if (outside > 0 && outside < fade) alpha = (1 - outside / fade) * 220;
        else if (outside === 0 && inside < fade * 0.5) alpha = (1 - inside / (fade * 0.5)) * 150;
        const index = (y * canvas.width + x) * 4;
        image.data[index] = 8;
        image.data[index + 1] = 10;
        image.data[index + 2] = 8;
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
  mesh.renderOrder = 4;
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

function wallTile(pixels: Uint8ClampedArray, width: number, height: number, openings: Opening[]): Uint8ClampedArray {
  const covered = (x: number, y: number) =>
    openings.some((opening) => x >= opening.x && x < opening.x + opening.w && y >= opening.y && y < opening.y + opening.h);
  let bestX = 0;
  let bestY = 0;
  let bestScore = Number.POSITIVE_INFINITY;
  const span = 16;
  for (let y = 0; y + span <= height; y += 4) {
    for (let x = 0; x + span <= width; x += 4) {
      let count = 0;
      let blocked = 0;
      const sum = [0, 0, 0];
      const sumSq = [0, 0, 0];
      for (let dy = 0; dy < span; dy++) {
        for (let dx = 0; dx < span; dx++) {
          if (covered(x + dx, y + dy)) {
            blocked += 1;
            continue;
          }
          const index = ((y + dy) * width + x + dx) * 4;
          for (let channel = 0; channel < 3; channel++) {
            const value = pixels[index + channel];
            sum[channel] += value;
            sumSq[channel] += value * value;
          }
          count += 1;
        }
      }
      if (count < span * 8) continue;
      let variance = 0;
      for (let channel = 0; channel < 3; channel++) {
        const mean = sum[channel] / count;
        variance += sumSq[channel] / count - mean * mean;
      }
      const score = variance + blocked * 12;
      if (score < bestScore) {
        bestScore = score;
        bestX = x;
        bestY = y;
      }
    }
  }
  return cropRows(pixels, width, height, bestY, span, bestX, span);
}

function frontFace(
  facade: Uint8ClampedArray,
  facadeW: number,
  facadeH: number,
  tile: Uint8ClampedArray,
  wallH: number,
): ImageBuffer {
  const texH = Math.max(facadeH, Math.round(wallH * 16));
  const pixels = new Uint8ClampedArray(facadeW * texH * 4);
  for (let y = 0; y < texH; y++) {
    for (let x = 0; x < facadeW; x++) {
      const from = ((y % 16) * 16 + (x % 16)) * 4;
      const to = (y * facadeW + x) * 4;
      pixels[to] = tile[from];
      pixels[to + 1] = tile[from + 1];
      pixels[to + 2] = tile[from + 2];
      pixels[to + 3] = 255;
    }
  }
  blitImage(pixels, facadeW, facade, facadeW, facadeH, 0, texH - facadeH);
  return { pixels, width: facadeW, height: texH };
}

function shingleTile(pixels: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
  const cols = Math.max(1, Math.floor(width / 16));
  const tileH = Math.min(16, height);
  const colors: Array<[number, number, number]> = [];
  for (let column = 0; column < cols; column++) {
    colors.push(regionMean(pixels, width, column * 16, 0, 16, tileH));
  }
  const median = medianColor(colors);
  let best = 0;
  let bestDelta = Number.POSITIVE_INFINITY;
  for (let column = 0; column < cols; column++) {
    const delta = colorDelta(colors[column], median);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = column;
    }
  }
  const tile = cropRows(pixels, width, height, 0, tileH, best * 16, 16);
  if (tileH === 16) return tile;
  const square = new Uint8ClampedArray(16 * 16 * 4);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const from = ((y % tileH) * 16 + x) * 4;
      const to = (y * 16 + x) * 4;
      square[to] = tile[from];
      square[to + 1] = tile[from + 1];
      square[to + 2] = tile[from + 2];
      square[to + 3] = 255;
    }
  }
  return square;
}

function accentTiles(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  eavePx: number,
): Array<{ index: number; pixels: Uint8ClampedArray; height: number }> {
  const usable = Math.max(1, height - Math.max(0, eavePx));
  const cols = Math.max(1, Math.floor(width / 16));
  const colors: Array<[number, number, number]> = [];
  for (let column = 0; column < cols; column++) {
    colors.push(regionMean(pixels, width, column * 16, 0, 16, usable));
  }
  const median = medianColor(colors);
  const found: Array<{ index: number; pixels: Uint8ClampedArray; height: number }> = [];
  const stampH = Math.min(16, usable);
  for (let column = 0; column < cols; column++) {
    if (colorDelta(colors[column], median) <= 90) continue;
    found.push({
      index: column,
      height: stampH,
      pixels: cropRows(pixels, width, height, 0, stampH, column * 16, 16),
    });
  }
  return found;
}

function cropRows(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  top: number,
  rows: number,
  left = 0,
  cropWidth = width,
): Uint8ClampedArray {
  const safeTop = Math.max(0, Math.min(height - 1, top));
  const safeRows = Math.max(1, Math.min(rows, height - safeTop));
  const safeLeft = Math.max(0, Math.min(width - 1, left));
  const safeWidth = Math.max(1, Math.min(cropWidth, width - safeLeft));
  const cropped = new Uint8ClampedArray(safeWidth * safeRows * 4);
  for (let y = 0; y < safeRows; y++) {
    for (let x = 0; x < safeWidth; x++) {
      const from = ((safeTop + y) * width + safeLeft + x) * 4;
      const to = (y * safeWidth + x) * 4;
      cropped[to] = pixels[from];
      cropped[to + 1] = pixels[from + 1];
      cropped[to + 2] = pixels[from + 2];
      cropped[to + 3] = pixels[from + 3] || 255;
    }
  }
  return cropped;
}

function blitImage(
  target: Uint8ClampedArray,
  targetWidth: number,
  source: Uint8ClampedArray,
  sourceWidth: number,
  sourceHeight: number,
  left: number,
  top: number,
): void {
  for (let y = 0; y < sourceHeight; y++) {
    for (let x = 0; x < sourceWidth; x++) {
      const from = (y * sourceWidth + x) * 4;
      const to = ((top + y) * targetWidth + left + x) * 4;
      if (to < 0 || to + 3 >= target.length) continue;
      target[to] = source[from];
      target[to + 1] = source[from + 1];
      target[to + 2] = source[from + 2];
      target[to + 3] = source[from + 3];
    }
  }
}

function regionMean(
  pixels: Uint8ClampedArray,
  width: number,
  left: number,
  top: number,
  spanX: number,
  spanY: number,
): [number, number, number] {
  let red = 0;
  let green = 0;
  let blue = 0;
  let count = 0;
  for (let y = top; y < top + spanY; y++) {
    for (let x = left; x < left + spanX && x < width; x++) {
      const index = (y * width + x) * 4;
      if (index + 3 >= pixels.length || pixels[index + 3] < 128) continue;
      red += pixels[index];
      green += pixels[index + 1];
      blue += pixels[index + 2];
      count += 1;
    }
  }
  if (count === 0) return [0, 0, 0];
  return [red / count, green / count, blue / count];
}

function medianColor(colors: Array<[number, number, number]>): [number, number, number] {
  const channel = (index: 0 | 1 | 2) => {
    const sorted = colors.map((color) => color[index]).sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)] ?? 0;
  };
  return [channel(0), channel(1), channel(2)];
}

function colorDelta(a: [number, number, number], b: [number, number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
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
