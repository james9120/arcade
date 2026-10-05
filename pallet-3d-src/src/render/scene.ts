import * as THREE from "three";
import type { Cell, Direction, TownMap } from "../game/types";

const FACING: Record<Direction, number> = {
  n: 0,
  e: Math.PI / 2,
  s: Math.PI,
  w: -Math.PI / 2,
};

const WALK_FRAMES: Record<Direction, number[]> = {
  s: [0, 3, 0, 4],
  n: [1, 5, 1, 6],
  w: [2, 7, 2, 8],
  e: [2, 7, 2, 8],
};

export interface SceneView {
  x: number;
  y: number;
  dir: Direction;
  moving: boolean;
}

export interface SceneController {
  sync(view: SceneView, dt: number): void;
  setRain(on: boolean): void;
  dispose(): void;
}

export function createScene(canvas: HTMLCanvasElement, town: TownMap): SceneController {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const clear = new THREE.Color("#9fd0ea");
  const rainy = new THREE.Color("#6e8496");
  const scene = new THREE.Scene();
  scene.background = clear;
  scene.fog = new THREE.Fog(clear, 16, 46);

  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 180);
  const offset = new THREE.Vector3(6.4, 8.2, 7.6);
  const look = new THREE.Vector3();
  const desired = new THREE.Vector3();

  scene.add(new THREE.HemisphereLight("#e7f6ff", "#6d8a48", 0.72));
  const sun = new THREE.DirectionalLight("#fff0cc", 1.35);
  sun.position.set(-10, 16, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 2;
  sun.shadow.camera.far = 40;
  sun.shadow.camera.left = -14;
  sun.shadow.camera.right = 14;
  sun.shadow.camera.top = 14;
  sun.shadow.camera.bottom = -14;
  scene.add(sun);
  scene.add(sun.target);
  const fill = new THREE.DirectionalLight("#c9d8ee", 0.28);
  fill.position.set(8, 6, -6);
  scene.add(fill);

  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];

  const groundTexture = textureFromCanvas(paintGround(town), textures);
  const skirt = new THREE.Mesh(
    track(geometries, new THREE.PlaneGeometry(town.width + 30, town.height + 30)),
    track(materials, new THREE.MeshLambertMaterial({ color: "#6f8f4c" })),
  );
  skirt.rotation.x = -Math.PI / 2;
  skirt.position.set((town.width - 1) / 2, -0.06, (town.height - 1) / 2);
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

  const romMaterials = new Map<string, THREE.Material>();
  const sideMaterials = new Map<string, THREE.Material>();
  const trunk = track(geometries, new THREE.CylinderGeometry(0.09, 0.12, 0.85, 6));
  const canopy = track(geometries, new THREE.PlaneGeometry(1.15, 1.15));
  const trunkMaterial = track(materials, new THREE.MeshLambertMaterial({ color: "#5c4632" }));

  for (let y = 0; y < town.height; y++) {
    for (let x = 0; x < town.width; x++) {
      const cell = town.cells[y * town.width + x];
      if (cell.kind === "tree") {
        addTree(scene, cell, x, y, materials, textures, romMaterials, trunk, trunkMaterial, canopy);
      } else if (cell.kind === "sign") {
        addBillboard(scene, cell, x, y, materials, textures, romMaterials);
      } else if (cell.kind === "structure" || cell.kind === "ledge") {
        addVolume(scene, cell, x, y, geometries, materials, textures, romMaterials, sideMaterials);
      }
    }
  }

  const heroFrames = (town.hero?.frames ?? []).map((pixels) =>
    textureFromPixels(pixels, town.hero?.width ?? 16, town.hero?.height ?? 32, textures),
  );
  const player = buildHero(heroFrames[0] ?? null, materials);
  const shadow = new THREE.Mesh(
    track(geometries, new THREE.CircleGeometry(0.32, 16)),
    track(materials, new THREE.MeshBasicMaterial({ color: "#1b2418", transparent: true, opacity: 0.28, depthWrite: false })),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.03;
  scene.add(shadow);
  scene.add(player);

  const rain = buildRain(town, geometries, materials);
  scene.add(rain.points);
  let raining = false;

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
      facing += delta * (1 - Math.exp(-dt * 12));
      const bob = view.moving ? Math.abs(Math.sin(clock * 10)) * 0.06 : 0;
      player.position.set(view.x, bob, view.y);
      shadow.position.set(view.x, 0.03, view.y);
      shadow.scale.set(view.moving ? 0.85 : 1, 1, view.moving ? 0.7 : 0.82);
      const frame = pickHeroFrame(heroFrames, view.dir, view.moving, clock);
      if (frame) {
        const material = player.material as THREE.SpriteMaterial;
        if (material.map !== frame) material.map = frame;
      }
      player.scale.x = Math.abs(player.scale.x) * (view.dir === "e" ? -1 : 1);

      look.set(view.x, 0.4, view.y);
      desired.copy(look).add(offset);
      if (!snapped) {
        camera.position.copy(desired);
        snapped = true;
      } else {
        camera.position.lerp(desired, 1 - Math.exp(-dt * 4.2));
      }
      camera.lookAt(look);
      sun.position.set(view.x - 10, 16, view.y + 7);
      sun.target.position.set(view.x, 0, view.y);
      if (raining) rain.step(dt, view.x, view.y);
      renderer.render(scene, camera);
    },
    setRain(on) {
      raining = on;
      rain.points.visible = on;
      sun.intensity = on ? 0.45 : 1.35;
      const color = on ? rainy : clear;
      scene.background = color;
      if (scene.fog) scene.fog.color.copy(color);
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

function paintGround(town: TownMap): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = town.width * 16;
  canvas.height = town.height * 16;
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
      const left = x * 16;
      const top = y * 16;
      if (cell.kind === "tree") {
        context.fillStyle = "#6f9444";
        context.fillRect(left, top, 16, 16);
        context.fillStyle = "#5c4632";
        context.fillRect(left + 6, top + 6, 4, 4);
      } else if (cell.pixels && chipContext) {
        chipContext.putImageData(new ImageData(new Uint8ClampedArray(cell.pixels), 16, 16), 0, 0);
        context.drawImage(chip, left, top);
      } else {
        context.fillStyle = "#7ea456";
        context.fillRect(left, top, 16, 16);
      }
    }
  }
  return canvas;
}

function addTree(
  scene: THREE.Scene,
  cell: Cell,
  x: number,
  y: number,
  materials: THREE.Material[],
  textures: THREE.Texture[],
  cache: Map<string, THREE.Material>,
  trunk: THREE.BufferGeometry,
  trunkMaterial: THREE.Material,
  canopyGeometry: THREE.BufferGeometry,
): void {
  const stem = new THREE.Mesh(trunk, trunkMaterial);
  stem.position.set(x, 0.42, y);
  stem.castShadow = true;
  scene.add(stem);
  if (!cell.pixels || !cell.textureKey) return;
  const leaves = new THREE.Mesh(canopyGeometry, topMaterial(cell, materials, textures, cache, 0.2));
  leaves.rotation.x = -Math.PI / 2;
  leaves.position.set(x, 0.95, y);
  leaves.castShadow = true;
  leaves.receiveShadow = true;
  scene.add(leaves);
}

function addBillboard(
  scene: THREE.Scene,
  cell: Cell,
  x: number,
  y: number,
  materials: THREE.Material[],
  textures: THREE.Texture[],
  cache: Map<string, THREE.Material>,
): void {
  if (!cell.pixels || !cell.textureKey) return;
  const material = spriteMaterial(cell.textureKey, cell.pixels, 16, 16, materials, textures, cache);
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(0.55, 0.7, 1);
  sprite.position.set(x, 0.02, y);
  sprite.center.set(0.5, 0);
  scene.add(sprite);
}

function addVolume(
  scene: THREE.Scene,
  cell: Cell,
  x: number,
  y: number,
  geometries: THREE.BufferGeometry[],
  materials: THREE.Material[],
  textures: THREE.Texture[],
  tops: Map<string, THREE.Material>,
  sides: Map<string, THREE.Material>,
): void {
  const height = Math.max(0.12, cell.height);
  const top = topMaterial(cell, materials, textures, tops);
  const side = sideMaterial(cell, materials, sides);
  const mesh = new THREE.Mesh(
    track(geometries, new THREE.BoxGeometry(1, height, 1)),
    [side, side, top, side, side, side],
  );
  mesh.position.set(x, height / 2, y);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
}

function buildHero(texture: THREE.Texture | null, materials: THREE.Material[]): THREE.Sprite {
  const material = new THREE.SpriteMaterial({ map: texture ?? undefined, transparent: true, alphaTest: 0.35 });
  materials.push(material);
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(0.78, 1.56, 1);
  sprite.center.set(0.5, 0);
  return sprite;
}

function pickHeroFrame(
  frames: THREE.Texture[],
  dir: Direction,
  moving: boolean,
  clock: number,
): THREE.Texture | null {
  if (frames.length === 0) return null;
  const cycle = WALK_FRAMES[dir];
  const index = moving ? cycle[Math.floor(clock * 8) % cycle.length] : cycle[0];
  return frames[Math.min(index, frames.length - 1)] ?? null;
}

function buildRain(
  town: TownMap,
  geometries: THREE.BufferGeometry[],
  materials: THREE.Material[],
): { points: THREE.Points; step(dt: number, x: number, z: number): void } {
  const count = 480;
  const positions = new Float32Array(count * 3);
  for (let index = 0; index < count; index++) {
    positions[index * 3] = Math.random() * town.width;
    positions[index * 3 + 1] = Math.random() * 12;
    positions[index * 3 + 2] = Math.random() * town.height;
  }
  const geometry = track(geometries, new THREE.BufferGeometry());
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const points = new THREE.Points(
    geometry,
    track(
      materials,
      new THREE.PointsMaterial({ color: "#e7f2fb", size: 0.07, transparent: true, opacity: 0.7, depthWrite: false }),
    ),
  );
  points.visible = false;
  points.frustumCulled = false;
  return {
    points,
    step(dt, x, z) {
      for (let index = 0; index < count; index++) {
        positions[index * 3 + 1] -= dt * 16;
        if (positions[index * 3 + 1] < 0) {
          positions[index * 3] = x + (Math.random() - 0.5) * 22;
          positions[index * 3 + 1] = 8 + Math.random() * 6;
          positions[index * 3 + 2] = z + (Math.random() - 0.5) * 22;
        }
      }
      geometry.attributes.position.needsUpdate = true;
    },
  };
}

function spriteMaterial(
  key: string,
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  materials: THREE.Material[],
  textures: THREE.Texture[],
  cache: Map<string, THREE.Material>,
): THREE.SpriteMaterial {
  const cached = cache.get(key);
  if (cached instanceof THREE.SpriteMaterial) return cached;
  const material = new THREE.SpriteMaterial({
    map: textureFromPixels(pixels, width, height, textures),
    transparent: true,
    alphaTest: 0.2,
  });
  materials.push(material);
  cache.set(key, material);
  return material;
}

function topMaterial(
  cell: Cell,
  materials: THREE.Material[],
  textures: THREE.Texture[],
  cache: Map<string, THREE.Material>,
  alphaTest = 0,
): THREE.Material {
  const key = `${cell.textureKey ?? cell.visual}:${alphaTest}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const texture = cell.pixels ? textureFromPixels(cell.pixels, 16, 16, textures) : null;
  const material = track(
    materials,
    new THREE.MeshLambertMaterial(
      texture
        ? { map: texture, alphaTest, transparent: alphaTest > 0, depthWrite: alphaTest === 0 }
        : { color: "#c8b59a" },
    ),
  );
  cache.set(key, material);
  return material;
}

function sideMaterial(cell: Cell, materials: THREE.Material[], cache: Map<string, THREE.Material>): THREE.Material {
  const color = shade(averageColor(cell.pixels), 0.68);
  const cached = cache.get(color);
  if (cached) return cached;
  const material = track(materials, new THREE.MeshLambertMaterial({ color }));
  cache.set(color, material);
  return material;
}

function textureFromCanvas(canvas: HTMLCanvasElement, textures: THREE.Texture[]): THREE.Texture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  textures.push(texture);
  return texture;
}

function textureFromPixels(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  textures: THREE.Texture[],
): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (context) context.putImageData(new ImageData(new Uint8ClampedArray(pixels), width, height), 0, 0);
  return textureFromCanvas(canvas, textures);
}

function averageColor(pixels: Uint8ClampedArray | undefined): string {
  if (!pixels) return "#8d7b68";
  let red = 0;
  let green = 0;
  let blue = 0;
  let count = 0;
  for (let index = 0; index < pixels.length; index += 4) {
    if (pixels[index + 3] < 128) continue;
    red += pixels[index];
    green += pixels[index + 1];
    blue += pixels[index + 2];
    count++;
  }
  if (count === 0) return "#8d7b68";
  return `rgb(${Math.round(red / count)}, ${Math.round(green / count)}, ${Math.round(blue / count)})`;
}

function shade(color: string, scale: number): string {
  const match = color.match(/\d+/g);
  if (!match) return color;
  const [red, green, blue] = match.map((channel) => Math.round(Number(channel) * scale));
  return `rgb(${red}, ${green}, ${blue})`;
}

function track<T>(list: T[], item: T): T {
  list.push(item);
  return item;
}
