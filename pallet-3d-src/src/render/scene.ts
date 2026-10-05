import * as THREE from "three";
import type { Cell, Direction, TownMap } from "../game/types";
import { buildingTexture, paintTown } from "./demoArt";

const FACING: Record<Direction, number> = {
  n: 0,
  e: Math.PI / 2,
  s: Math.PI,
  w: -Math.PI / 2,
};

export interface SceneView {
  x: number;
  y: number;
  dir: Direction;
  moving: boolean;
}

export interface SceneController {
  sync(view: SceneView, dt: number): void;
  dispose(): void;
}

export function createScene(canvas: HTMLCanvasElement, town: TownMap): SceneController {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#8ecae8");
  scene.fog = new THREE.Fog("#8ecae8", 28, 58);

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 200);
  const offset = new THREE.Vector3(8.5, 12.5, 9.5);
  const look = new THREE.Vector3();
  const desired = new THREE.Vector3();

  scene.add(new THREE.HemisphereLight("#d7f0ff", "#6a8f46", 0.82));
  const sun = new THREE.DirectionalLight("#fff1d2", 1.2);
  sun.position.set(-12, 18, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 2;
  sun.shadow.camera.far = 48;
  sun.shadow.camera.left = -16;
  sun.shadow.camera.right = 16;
  sun.shadow.camera.top = 16;
  sun.shadow.camera.bottom = -16;
  scene.add(sun);
  scene.add(sun.target);
  const fill = new THREE.DirectionalLight("#c5d7ee", 0.38);
  fill.position.set(8, 10, -12);
  scene.add(fill);

  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];

  const groundCanvas = paintTown(town);
  const groundTexture = new THREE.CanvasTexture(groundCanvas);
  groundTexture.colorSpace = THREE.SRGBColorSpace;
  groundTexture.magFilter = THREE.NearestFilter;
  groundTexture.minFilter = THREE.NearestFilter;
  textures.push(groundTexture);

  const skirt = new THREE.Mesh(
    track(geometries, new THREE.PlaneGeometry(90, 90)),
    track(materials, new THREE.MeshLambertMaterial({ color: "#7ea456" })),
  );
  skirt.rotation.x = -Math.PI / 2;
  skirt.position.set((town.width - 1) / 2, -0.04, (town.height - 1) / 2);
  skirt.receiveShadow = true;
  scene.add(skirt);

  const ground = new THREE.Mesh(
    track(geometries, new THREE.PlaneGeometry(town.width, town.height)),
    track(materials, new THREE.MeshLambertMaterial({ map: groundTexture })),
  );
  ground.geometry.rotateX(-Math.PI / 2);
  ground.position.set((town.width - 1) / 2, 0, (town.height - 1) / 2);
  ground.receiveShadow = true;
  scene.add(ground);

  const shared = {
    wall: track(materials, patterned("wall", textures)),
    roof: track(materials, patterned("roof", textures)),
    door: track(materials, patterned("door", textures)),
    fence: track(materials, patterned("fence", textures)),
    sign: track(materials, patterned("sign", textures)),
  };
  const flat = {
    trunk: track(materials, new THREE.MeshLambertMaterial({ color: "#7a4e2d" })),
    canopy: track(materials, new THREE.MeshLambertMaterial({ color: "#2f7a3c" })),
    canopyDeep: track(materials, new THREE.MeshLambertMaterial({ color: "#256333" })),
    ledge: track(materials, new THREE.MeshLambertMaterial({ color: "#8e9a68" })),
  };

  const romMaterials = new Map<string, THREE.Material>();

  for (let y = 0; y < town.height; y++) {
    for (let x = 0; x < town.width; x++) {
      const cell = town.cells[y * town.width + x];
      if (cell.height <= 0 && cell.visual !== "tree") continue;
      addProp(scene, cell, x, y, geometries, materials, textures, shared, flat, romMaterials);
    }
  }

  const player = buildPlayer(geometries, materials);
  scene.add(player);

  let facing = 0;
  let snapped = false;
  let clock = 0;

  const resize = () => {
    const width = canvas.clientWidth || 1;
    const height = canvas.clientHeight || 1;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  };
  resize();
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);

  return {
    sync(view, dt) {
      clock += dt;
      const targetFacing = FACING[view.dir];
      let delta = targetFacing - facing;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      facing += delta * (1 - Math.exp(-dt * 10));
      player.rotation.y = facing;
      const bob = view.moving ? Math.sin(clock * 14) * 0.07 : Math.sin(clock * 2) * 0.02;
      player.position.set(view.x, bob, view.y);

      look.set(view.x, 0.7, view.y);
      desired.copy(look).add(offset);
      if (!snapped) {
        camera.position.copy(desired);
        snapped = true;
      } else {
        camera.position.lerp(desired, 1 - Math.exp(-dt * 4.5));
      }
      camera.lookAt(look);
      sun.position.set(view.x - 12, 18, view.y + 8);
      sun.target.position.set(view.x, 0, view.y);
      renderer.render(scene, camera);
    },
    dispose() {
      observer.disconnect();
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      for (const texture of textures) texture.dispose();
      renderer.dispose();
    },
  };
}

function addProp(
  scene: THREE.Scene,
  cell: Cell,
  x: number,
  y: number,
  geometries: THREE.BufferGeometry[],
  materials: THREE.Material[],
  textures: THREE.Texture[],
  shared: Record<"wall" | "roof" | "door" | "fence" | "sign", THREE.Material>,
  flat: Record<"trunk" | "canopy" | "canopyDeep" | "ledge", THREE.Material>,
  romMaterials: Map<string, THREE.Material>,
): void {
  if (cell.visual === "tree" && !cell.pixels) {
    const trunk = new THREE.Mesh(track(geometries, new THREE.BoxGeometry(0.28, 0.7, 0.28)), flat.trunk);
    trunk.position.set(x, 0.35, y);
    trunk.castShadow = true;
    scene.add(trunk);
    const canopyMaterial = (x + y) % 2 === 0 ? flat.canopy : flat.canopyDeep;
    const canopy = new THREE.Mesh(track(geometries, new THREE.BoxGeometry(0.95, 0.85, 0.95)), canopyMaterial);
    canopy.position.set(x, 1.15, y);
    canopy.rotation.y = ((x * 13 + y * 7) % 10) * 0.08;
    canopy.castShadow = true;
    scene.add(canopy);
    return;
  }

  if (cell.height <= 0) return;

  const material = materialFor(cell, shared, flat, materials, textures, romMaterials);
  const mesh = new THREE.Mesh(track(geometries, new THREE.BoxGeometry(0.94, cell.height, 0.94)), material);
  mesh.position.set(x, cell.height / 2, y);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
}

function materialFor(
  cell: Cell,
  shared: Record<"wall" | "roof" | "door" | "fence" | "sign", THREE.Material>,
  flat: Record<"trunk" | "canopy" | "canopyDeep" | "ledge", THREE.Material>,
  materials: THREE.Material[],
  textures: THREE.Texture[],
  romMaterials: Map<string, THREE.Material>,
): THREE.Material {
  if (cell.pixels && cell.textureKey) {
    const cached = romMaterials.get(cell.textureKey);
    if (cached) return cached;
    const texture = textureFromPixels(cell.pixels, textures);
    const material = track(materials, new THREE.MeshLambertMaterial({ map: texture }));
    romMaterials.set(cell.textureKey, material);
    return material;
  }
  if (cell.visual === "roof") return shared.roof;
  if (cell.visual === "door") return shared.door;
  if (cell.visual === "fence") return shared.fence;
  if (cell.visual === "sign") return shared.sign;
  if (cell.visual === "ledge") return flat.ledge;
  if (cell.visual === "tree") return flat.canopy;
  return shared.wall;
}

function textureFromPixels(pixels: Uint8ClampedArray, textures: THREE.Texture[]): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = 16;
  canvas.height = 16;
  const context = canvas.getContext("2d");
  if (context) {
    context.putImageData(new ImageData(new Uint8ClampedArray(pixels), 16, 16), 0, 0);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  textures.push(texture);
  return texture;
}

function patterned(
  kind: "wall" | "roof" | "door" | "fence" | "sign",
  textures: THREE.Texture[],
): THREE.MeshLambertMaterial {
  const texture = new THREE.CanvasTexture(buildingTexture(kind));
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  textures.push(texture);
  return new THREE.MeshLambertMaterial({ map: texture });
}

function buildPlayer(geometries: THREE.BufferGeometry[], materials: THREE.Material[]): THREE.Group {
  const group = new THREE.Group();
  const jacket = track(materials, new THREE.MeshLambertMaterial({ color: "#2f6f8f" }));
  const pants = track(materials, new THREE.MeshLambertMaterial({ color: "#3c3848" }));
  const skin = track(materials, new THREE.MeshLambertMaterial({ color: "#f0c2a0" }));
  const hat = track(materials, new THREE.MeshLambertMaterial({ color: "#e6b15a" }));
  const shoes = track(materials, new THREE.MeshLambertMaterial({ color: "#2b2420" }));

  const add = (w: number, h: number, d: number, material: THREE.Material, x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(track(geometries, new THREE.BoxGeometry(w, h, d)), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    group.add(mesh);
  };

  add(0.16, 0.28, 0.16, pants, -0.1, 0.22, 0);
  add(0.16, 0.28, 0.16, pants, 0.1, 0.22, 0);
  add(0.18, 0.08, 0.2, shoes, -0.1, 0.05, 0.02);
  add(0.18, 0.08, 0.2, shoes, 0.1, 0.05, 0.02);
  add(0.46, 0.42, 0.28, jacket, 0, 0.52, 0);
  add(0.32, 0.28, 0.28, skin, 0, 0.86, 0);
  add(0.36, 0.1, 0.36, hat, 0, 1.02, 0);
  add(0.24, 0.16, 0.26, hat, 0, 1.14, -0.02);
  return group;
}

function track<T>(list: T[], item: T): T {
  list.push(item);
  return item;
}
