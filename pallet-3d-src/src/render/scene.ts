import * as THREE from "three";
import type { Cell, Direction, TownMap } from "../game/types";
import { addStructures, applyWetness, type WetSurface } from "./buildings";
import { readGraphicsMode, type GraphicsMode } from "./quality";
import { createTraceLook, type TraceLook } from "./tracelook";
import {
  approachWetness,
  blendWeather,
  readWeatherOverride,
  type WeatherSample,
} from "./weather";

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
  sync(view: SceneView, dt: number): WeatherSample;
  setQuality(mode: GraphicsMode): void;
  quality(): GraphicsMode;
  dispose(): void;
}

export function createScene(
  canvas: HTMLCanvasElement,
  town: TownMap,
  initialQuality: GraphicsMode = readGraphicsMode("", true),
): SceneController {
  let quality = initialQuality;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  const pixelRatio = () => Math.min(window.devicePixelRatio || 1, quality === "high" ? 1.5 : 1.75);
  renderer.setPixelRatio(pixelRatio());
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = quality === "high" ? THREE.VSMShadowMap : THREE.PCFShadowMap;

  const skyClear = new THREE.Color("#9fd0ea");
  const skyRain = new THREE.Color("#8a8680");
  const skyNow = skyClear.clone();
  const hemiSkyClear = new THREE.Color("#e7f6ff");
  const hemiSkyRain = new THREE.Color("#c4bfb4");
  const hemiGroundClear = new THREE.Color("#6d8a48");
  const hemiGroundRain = new THREE.Color("#3e4a28");
  const scene = new THREE.Scene();
  scene.background = skyNow;
  const fog = new THREE.Fog(skyNow, 18, 48);
  scene.fog = fog;

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 180);
  camera.layers.enable(1);
  camera.layers.enable(2);
  const offset = new THREE.Vector3(5.4, 6.5, 11.4);
  const look = new THREE.Vector3();
  const desired = new THREE.Vector3();

  const hemi = new THREE.HemisphereLight("#e7f6ff", "#6d8a48", 0.72);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight("#fff0cc", 1.35);
  sun.position.set(-10, 16, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.bias = -0.00025;
  sun.shadow.normalBias = 0.03;
  sun.shadow.radius = quality === "high" ? 5 : 1;
  sun.shadow.blurSamples = quality === "high" ? 10 : 8;
  sun.shadow.camera.near = 2;
  sun.shadow.camera.far = 64;
  sun.shadow.camera.left = -22;
  sun.shadow.camera.right = 22;
  sun.shadow.camera.top = 22;
  sun.shadow.camera.bottom = -22;
  scene.add(sun);
  scene.add(sun.target);
  const fill = new THREE.DirectionalLight("#e6d8c4", 0.28);
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
  skirt.layers.set(2);
  scene.add(skirt);

  const groundMaterial = new THREE.MeshPhongMaterial({
    map: groundTexture,
    shininess: 0,
    specular: new THREE.Color("#000000"),
  });
  materials.push(groundMaterial);
  const ground = new THREE.Mesh(track(geometries, new THREE.PlaneGeometry(town.width, town.height)), groundMaterial);
  ground.geometry.rotateX(-Math.PI / 2);
  ground.position.set((town.width - 1) / 2, 0, (town.height - 1) / 2);
  ground.receiveShadow = true;
  ground.layers.set(2);
  scene.add(ground);

  const romMaterials = new Map<string, THREE.Material>();
  const sideMaterials = new Map<string, THREE.Material>();
  const trunk = track(geometries, new THREE.CylinderGeometry(0.12, 0.16, 1.1, 6));
  const crown = track(geometries, new THREE.SphereGeometry(0.62, 8, 6));
  const trunkMaterial = track(materials, new THREE.MeshLambertMaterial({ color: "#5c4632" }));
  const wetSurfaces: WetSurface[] = addStructures(scene, town, geometries, materials, textures);

  for (let y = 0; y < town.height; y++) {
    for (let x = 0; x < town.width; x++) {
      const cell = town.cells[y * town.width + x];
      if (cell.kind === "tree") {
        addTree(scene, cell, x, y, materials, textures, romMaterials, trunk, trunkMaterial, crown, wetSurfaces);
      } else if (cell.kind === "sign") {
        addBillboard(scene, cell, x, y, materials, textures, romMaterials);
      } else if (cell.kind === "ledge") {
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
  shadow.layers.set(2);
  scene.add(shadow);
  scene.add(player);

  const mirrorMaterial = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
    color: "#9eb0be",
  });
  materials.push(mirrorMaterial);
  const mirror = new THREE.Mesh(track(geometries, new THREE.PlaneGeometry(1, 2)), mirrorMaterial);
  mirror.rotation.x = -Math.PI / 2;
  mirror.layers.set(2);
  mirror.visible = false;
  mirror.renderOrder = 3;
  scene.add(mirror);

  const weatherFx = buildWeatherFx(town, scene, geometries, materials, textures);
  const forced = readWeatherOverride(window.location.search);
  const reflect = buildReflection(renderer, town, geometries, materials);
  scene.add(reflect.overlay);
  let trace: TraceLook | null = null;

  let facing = 0;
  let snapped = false;
  let clock = 0;
  let wetness = 0;
  let reflectFrame = 0;

  const resize = () => {
    const width = canvas.clientWidth || 1;
    const height = canvas.clientHeight || 1;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(pixelRatio());
    renderer.setSize(width, height, false);
  };
  const applyQuality = (mode: GraphicsMode) => {
    quality = mode;
    const soft = mode === "high";
    renderer.shadowMap.type = soft ? THREE.VSMShadowMap : THREE.PCFShadowMap;
    sun.shadow.radius = soft ? 5 : 1;
    sun.shadow.blurSamples = soft ? 10 : 8;
    renderer.shadowMap.needsUpdate = true;
    resize();
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
      const flip = view.dir === "e" ? -1 : 1;
      player.scale.x = Math.abs(player.scale.x) * flip;
      mirror.position.set(view.x, 0.045, view.y + 0.15);
      mirror.scale.set(flip, 1, 1);
      if (frame && mirrorMaterial.map !== frame) {
        mirrorMaterial.map = frame;
        mirrorMaterial.needsUpdate = true;
      }

      look.set(view.x, 0.85, view.y);
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

      const forecast = blendWeather(clock, view.y, town.northRows, forced);
      wetness = approachWetness(wetness, forecast.rain, dt);
      const overcast = Math.max(forecast.cloud, forecast.rain);
      skyNow.copy(skyClear).lerp(skyRain, overcast);
      hemi.color.copy(hemiSkyClear).lerp(hemiSkyRain, overcast);
      hemi.groundColor.copy(hemiGroundClear).lerp(hemiGroundRain, overcast);
      fog.near = 20 - overcast * 4;
      fog.far = 56 - overcast * 14;
      sun.intensity = 1.35 - overcast * 0.5;
      hemi.intensity = 0.72 - overcast * 0.12;
      fill.intensity = 0.28 - overcast * 0.06;
      groundMaterial.color.setRGB(
        Math.min(1, (1 - wetness * 0.45) * 1.02),
        1 - wetness * 0.4,
        1 - wetness * 0.52,
      );
      groundMaterial.shininess = 8 + wetness * 90;
      groundMaterial.specular.setRGB(wetness * 0.18, wetness * 0.17, wetness * 0.15);
      applyWetness(wetSurfaces, wetness);
      const skirtMaterial = skirt.material as THREE.MeshLambertMaterial;
      skirtMaterial.color.setRGB(0.32 - wetness * 0.08, 0.4 - wetness * 0.05, 0.16 - wetness * 0.05);
      const high = quality === "high";
      mirror.visible = !high && wetness > 0.05;
      mirrorMaterial.opacity = wetness * 0.5;
      (shadow.material as THREE.MeshBasicMaterial).opacity = 0.28 * (1 - wetness * 0.45);
      weatherFx.step(dt, view.x, view.y, forecast.rain, wetness, clock);
      reflectFrame += 1;
      const planar = !high && reflect.enabled(canvas);
      if (planar && wetness > 0.08 && reflectFrame % 3 === 0) {
        reflect.capture(scene, camera);
      }
      reflect.strength(planar ? wetness : 0);
      if (high) {
        trace ??= createTraceLook();
        try {
          trace.render(renderer, scene, camera, wetness, skyNow);
        } catch (error) {
          console.error(error);
          renderer.setRenderTarget(null);
          renderer.render(scene, camera);
        }
      } else {
        renderer.setRenderTarget(null);
        renderer.render(scene, camera);
      }
      return forecast;
    },
    setQuality(mode) {
      applyQuality(mode);
    },
    quality() {
      return quality;
    },
    dispose() {
      observer.disconnect();
      reflect.dispose();
      trace?.dispose();
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
      const standIn = cell.kind === "structure" ? neighborGround(town, x, y) : undefined;
      if (cell.kind === "tree") {
        context.fillStyle = "#6f9444";
        context.fillRect(left, top, 16, 16);
        context.fillStyle = "#5c4632";
        context.fillRect(left + 6, top + 6, 4, 4);
      } else if (standIn && chipContext) {
        chipContext.putImageData(new ImageData(new Uint8ClampedArray(standIn), 16, 16), 0, 0);
        context.drawImage(chip, left, top);
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

function neighborGround(town: TownMap, x: number, y: number): Uint8ClampedArray | undefined {
  for (let radius = 1; radius <= 6; radius++) {
    const first: Array<[number, number]> = [
      [0, radius],
      [1, radius],
      [-1, radius],
    ];
    for (const [dx, dy] of first) {
      const pixels = groundPixels(town, x + dx, y + dy);
      if (pixels) return pixels;
    }
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
        const pixels = groundPixels(town, x + dx, y + dy);
        if (pixels) return pixels;
      }
    }
  }
  return undefined;
}

function groundPixels(town: TownMap, x: number, y: number): Uint8ClampedArray | undefined {
  if (x < 0 || y < 0 || x >= town.width || y >= town.height) return undefined;
  const cell = town.cells[y * town.width + x];
  if (!cell || cell.kind === "structure" || cell.kind === "tree" || cell.kind === "fence" || !cell.pixels) return undefined;
  return cell.pixels;
}

function leafMaterial(
  cell: Cell,
  materials: THREE.Material[],
  textures: THREE.Texture[],
  cache: Map<string, THREE.Material>,
  surfaces: WetSurface[],
): THREE.MeshPhongMaterial {
  const key = `leaf:${cell.textureKey ?? cell.visual}`;
  const cached = cache.get(key);
  if (cached instanceof THREE.MeshPhongMaterial) return cached;
  const material = new THREE.MeshPhongMaterial({
    map: cell.pixels ? textureFromPixels(cell.pixels, 16, 16, textures) : null,
    color: "#ffffff",
    shininess: 0,
    specular: new THREE.Color("#000000"),
  });
  materials.push(material);
  surfaces.push({ material, kind: "leaf", base: [1, 1, 1] });
  cache.set(key, material);
  return material;
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
  crown: THREE.BufferGeometry,
  surfaces: WetSurface[],
): void {
  const stem = new THREE.Mesh(trunk, trunkMaterial);
  stem.position.set(x, 0.55, y);
  stem.castShadow = true;
  stem.receiveShadow = true;
  stem.layers.set(1);
  scene.add(stem);
  if (!cell.pixels || !cell.textureKey) return;
  const leaves = new THREE.Mesh(crown, leafMaterial(cell, materials, textures, cache, surfaces));
  const turn = hash01(x, y) * Math.PI * 2;
  leaves.rotation.y = turn;
  leaves.scale.set(1.05 + (hash01(x + 3, y) - 0.5) * 0.18, 0.92, 1.05 + (hash01(x, y + 5) - 0.5) * 0.18);
  leaves.position.set(x, 1.72, y);
  leaves.castShadow = true;
  leaves.receiveShadow = true;
  leaves.layers.set(1);
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
  sprite.scale.set(1, 2, 1);
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

function buildWeatherFx(
  town: TownMap,
  scene: THREE.Scene,
  geometries: THREE.BufferGeometry[],
  materials: THREE.Material[],
  textures: THREE.Texture[],
): { step(dt: number, x: number, z: number, rain: number, wetness: number, clock: number): void } {
  const rain = buildRain(geometries, materials, textures);
  scene.add(rain.points);
  const puddles = buildPuddles(town, geometries, materials);
  scene.add(puddles.group);
  const splashes = buildSplashes(geometries, materials);
  scene.add(splashes.points);
  scene.add(splashes.rings);
  return {
    step(dt, x, z, amount, wetness, clock) {
      rain.step(dt, x, z, amount, (hitX, hitZ) => {
        splashes.burst(hitX, hitZ);
      });
      puddles.step(wetness, clock);
      splashes.step(dt);
    },
  };
}

function buildRain(
  geometries: THREE.BufferGeometry[],
  materials: THREE.Material[],
  textures: THREE.Texture[],
): {
  points: THREE.Points;
  step(dt: number, x: number, z: number, amount: number, onHit: (x: number, z: number) => void): void;
} {
  const count = 360;
  const positions = new Float32Array(count * 3);
  for (let index = 0; index < count; index++) resetDrop(positions, index, 0, 0, true);
  const geometry = track(geometries, new THREE.BufferGeometry());
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const points = new THREE.Points(
    geometry,
    track(
      materials,
      new THREE.PointsMaterial({
        map: rainStreak(textures),
        color: "#c5c8c4",
        size: 0.72,
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
        sizeAttenuation: true,
      }),
    ),
  );
  points.layers.set(2);
  points.frustumCulled = false;
  points.visible = false;
  let dry = true;
  return {
    points,
    step(dt, x, z, amount, onHit) {
      const active = Math.floor(amount * count);
      geometry.setDrawRange(0, active);
      points.visible = active > 6;
      const material = points.material as THREE.PointsMaterial;
      material.opacity = 0.22 + amount * 0.28;
      if (active === 0) {
        dry = true;
        return;
      }
      if (dry) {
        for (let index = 0; index < count; index++) resetDrop(positions, index, x, z, false);
        dry = false;
      }
      let hits = 0;
      const fall = 32 + amount * 40;
      const drift = 6 + amount * 4;
      for (let index = 0; index < active; index++) {
        positions[index * 3] += dt * drift;
        positions[index * 3 + 1] -= dt * fall;
        if (positions[index * 3 + 1] > 0) continue;
        const hitX = positions[index * 3];
        const hitZ = positions[index * 3 + 2];
        if (hits < 4 && Math.hypot(hitX - x, hitZ - z) < 9) {
          onHit(hitX, hitZ);
          hits += 1;
        }
        resetDrop(positions, index, x, z, false);
      }
      geometry.attributes.position.needsUpdate = true;
    },
  };
}

function resetDrop(positions: Float32Array, index: number, x: number, z: number, anywhere: boolean): void {
  positions[index * 3] = anywhere ? Math.random() * 80 - 20 : x + (Math.random() - 0.5) * 18;
  positions[index * 3 + 1] = 4 + Math.random() * 8;
  positions[index * 3 + 2] = anywhere ? Math.random() * 80 - 10 : z + (Math.random() - 0.5) * 18;
}

function rainStreak(textures: THREE.Texture[]): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = 16;
  canvas.height = 32;
  const context = canvas.getContext("2d");
  if (context) {
    context.strokeStyle = "rgba(150, 152, 148, 0.5)";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(5.5, 1);
    context.lineTo(10.5, 31);
    context.stroke();
  }
  return textureFromCanvas(canvas, textures);
}

function buildPuddles(
  town: TownMap,
  geometries: THREE.BufferGeometry[],
  materials: THREE.Material[],
): { group: THREE.Group; step(wetness: number, clock: number): void } {
  const geometry = track(geometries, new THREE.CircleGeometry(0.5, 14));
  const material = track(materials, puddleMaterial());
  const group = new THREE.Group();
  group.layers.set(2);
  const spots: Array<{ mesh: THREE.Mesh; size: number }> = [];
  const perBand = new Map<number, number>();
  for (let y = 0; y < town.height; y++) {
    for (let x = 0; x < town.width; x++) {
      const band = Math.floor(y / 6);
      if ((perBand.get(band) ?? 0) >= 3) continue;
      const cell = town.cells[y * town.width + x];
      if (!cell || cell.blocked || cell.kind === "water" || cell.kind === "tree" || cell.kind === "structure") continue;
      const roll = hash01(x, y);
      const grassy = cell.kind === "grass";
      if (roll > (grassy ? 0.16 : 0.07)) continue;
      const mesh = new THREE.Mesh(geometry, material);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(x, 0.035, y);
      mesh.layers.set(2);
      mesh.visible = false;
      group.add(mesh);
      spots.push({ mesh, size: grassy ? 1.05 + roll * 3 : 0.8 + roll * 4 });
      perBand.set(band, (perBand.get(band) ?? 0) + 1);
    }
  }
  return {
    group,
    step(wetness, clock) {
      const uniforms = (material as THREE.ShaderMaterial).uniforms;
      uniforms.time.value = clock;
      uniforms.wetness.value = wetness;
      const show = wetness > 0.08;
      for (const spot of spots) {
        const grown = spot.size * smoothGrowth(wetness);
        spot.mesh.visible = show;
        spot.mesh.scale.set(grown, grown, 1);
      }
    },
  };
}

function puddleMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      time: { value: 0 },
      wetness: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float time;
      uniform float wetness;
      varying vec2 vUv;
      void main() {
        float r = length(vUv - 0.5) * 2.0;
        float disc = smoothstep(1.0, 0.62, r);
        float ring = smoothstep(0.07, 0.0, abs(fract(r * 2.6 - time * 0.85) - 0.12));
        float alpha = disc * wetness * (0.48 + ring * 0.16);
        gl_FragColor = vec4(0.045, 0.055, 0.048, alpha);
      }
    `,
  });
}

function buildSplashes(
  geometries: THREE.BufferGeometry[],
  materials: THREE.Material[],
): { points: THREE.Points; rings: THREE.Group; burst(x: number, z: number): void; step(dt: number): void } {
  const count = 48;
  const positions = new Float32Array(count * 3);
  positions.fill(-20);
  const geometry = track(geometries, new THREE.BufferGeometry());
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const points = new THREE.Points(
    geometry,
    track(
      materials,
      new THREE.PointsMaterial({ color: "#c8ccc8", size: 0.12, transparent: true, opacity: 0.7, depthWrite: false }),
    ),
  );
  points.layers.set(2);
  points.frustumCulled = false;
  const lives = new Float32Array(count);
  const velocity = new Float32Array(count);
  let cursor = 0;

  const rings = new THREE.Group();
  const ringGeometry = track(geometries, new THREE.RingGeometry(0.08, 0.16, 18));
  const ringLives: number[] = [];
  for (let index = 0; index < 10; index++) {
    const mesh = new THREE.Mesh(
      ringGeometry,
      track(
        materials,
        new THREE.MeshBasicMaterial({ color: "#b7b8b0", transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }),
      ),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.04;
    mesh.visible = false;
    mesh.layers.set(2);
    rings.add(mesh);
    ringLives.push(0);
  }
  let ringCursor = 0;

  return {
    points,
    rings,
    burst(x, z) {
      const slot = cursor % count;
      cursor += 1;
      positions[slot * 3] = x + (Math.random() - 0.5) * 0.2;
      positions[slot * 3 + 1] = 0.06;
      positions[slot * 3 + 2] = z + (Math.random() - 0.5) * 0.2;
      lives[slot] = 0.38;
      velocity[slot] = 1.6 + Math.random() * 1.4;
      const index = ringCursor % rings.children.length;
      ringCursor += 1;
      const ring = rings.children[index] as THREE.Mesh;
      ring.visible = true;
      ring.position.set(x, 0.045, z);
      ring.scale.set(0.2, 0.2, 0.2);
      ringLives[index] = 0.6;
    },
    step(dt) {
      for (let index = 0; index < count; index++) {
        if (lives[index] <= 0) continue;
        lives[index] -= dt;
        velocity[index] -= dt * 8;
        positions[index * 3 + 1] += velocity[index] * dt;
        if (lives[index] <= 0) positions[index * 3 + 1] = -20;
      }
      geometry.attributes.position.needsUpdate = true;
      rings.children.forEach((child, index) => {
        const mesh = child as THREE.Mesh;
        const material = mesh.material as THREE.MeshBasicMaterial;
        if (ringLives[index] <= 0) {
          mesh.visible = false;
          return;
        }
        ringLives[index] = Math.max(0, ringLives[index] - dt);
        const age = 1 - ringLives[index] / 0.6;
        const span = 0.25 + age * 1.15;
        mesh.scale.set(span, span, span);
        material.opacity = (1 - age) * 0.85;
        mesh.visible = ringLives[index] > 0;
      });
    },
  };
}

function buildReflection(
  renderer: THREE.WebGLRenderer,
  town: TownMap,
  geometries: THREE.BufferGeometry[],
  materials: THREE.Material[],
): {
  overlay: THREE.Mesh;
  enabled(canvas: HTMLCanvasElement): boolean;
  capture(scene: THREE.Scene, camera: THREE.PerspectiveCamera): void;
  strength(wetness: number): void;
  dispose(): void;
} {
  const target = new THREE.WebGLRenderTarget(192, 192);
  target.texture.colorSpace = THREE.SRGBColorSpace;
  const textureMatrix = new THREE.Matrix4();
  const material = track(
    materials,
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        tReflect: { value: target.texture },
        textureMatrix: { value: textureMatrix },
        wetness: { value: 0 },
      },
      vertexShader: `
        uniform mat4 textureMatrix;
        varying vec4 vUv;
        void main() {
          vUv = textureMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tReflect;
        uniform float wetness;
        varying vec4 vUv;
        void main() {
          vec4 refl = texture2DProj(tReflect, vUv);
          gl_FragColor = vec4(refl.rgb * vec3(0.62, 0.64, 0.6), wetness * 0.72);
        }
      `,
    }),
  );
  const overlay = new THREE.Mesh(track(geometries, new THREE.PlaneGeometry(town.width, town.height)), material);
  overlay.rotation.x = -Math.PI / 2;
  overlay.position.set((town.width - 1) / 2, 0.02, (town.height - 1) / 2);
  overlay.layers.set(2);
  overlay.renderOrder = 2;
  overlay.visible = false;
  const mirrorCamera = new THREE.PerspectiveCamera(28, 1, 0.1, 180);
  mirrorCamera.layers.set(0);
  const normal = new THREE.Vector3();
  const rotationMatrix = new THREE.Matrix4();
  const reflectorWorldPosition = new THREE.Vector3();
  const cameraWorldPosition = new THREE.Vector3();
  const view = new THREE.Vector3();
  const targetPoint = new THREE.Vector3();
  const lookAtPosition = new THREE.Vector3();
  const reflectorPlane = new THREE.Plane();
  const clipPlane = new THREE.Vector4();
  const q = new THREE.Vector4();
  const reflectSky = new THREE.Color("#243038");
  return {
    overlay,
    enabled(canvas) {
      return canvas.clientWidth >= 720;
    },
    capture(scene, camera) {
      overlay.updateWorldMatrix(true, false);
      reflectorWorldPosition.setFromMatrixPosition(overlay.matrixWorld);
      cameraWorldPosition.setFromMatrixPosition(camera.matrixWorld);
      rotationMatrix.extractRotation(overlay.matrixWorld);
      normal.set(0, 0, 1).applyMatrix4(rotationMatrix);
      view.subVectors(reflectorWorldPosition, cameraWorldPosition);
      if (view.dot(normal) > 0) return;
      view.reflect(normal).negate().add(reflectorWorldPosition);
      rotationMatrix.extractRotation(camera.matrixWorld);
      lookAtPosition.set(0, 0, -1).applyMatrix4(rotationMatrix).add(cameraWorldPosition);
      targetPoint.subVectors(reflectorWorldPosition, lookAtPosition);
      targetPoint.reflect(normal).negate().add(reflectorWorldPosition);
      mirrorCamera.position.copy(view);
      mirrorCamera.up.set(0, 1, 0).applyMatrix4(rotationMatrix);
      mirrorCamera.up.reflect(normal);
      mirrorCamera.lookAt(targetPoint);
      mirrorCamera.far = camera.far;
      mirrorCamera.updateMatrixWorld();
      mirrorCamera.projectionMatrix.copy(camera.projectionMatrix);
      textureMatrix.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
      textureMatrix.multiply(mirrorCamera.projectionMatrix);
      textureMatrix.multiply(mirrorCamera.matrixWorldInverse);
      textureMatrix.multiply(overlay.matrixWorld);
      reflectorPlane.setFromNormalAndCoplanarPoint(normal, reflectorWorldPosition);
      reflectorPlane.applyMatrix4(mirrorCamera.matrixWorldInverse);
      clipPlane.set(reflectorPlane.normal.x, reflectorPlane.normal.y, reflectorPlane.normal.z, reflectorPlane.constant);
      const projection = mirrorCamera.projectionMatrix;
      q.set(
        (Math.sign(clipPlane.x) + projection.elements[8]) / projection.elements[0],
        (Math.sign(clipPlane.y) + projection.elements[9]) / projection.elements[5],
        -1,
        (1 + projection.elements[10]) / projection.elements[14],
      );
      clipPlane.multiplyScalar(2 / clipPlane.dot(q));
      projection.elements[2] = clipPlane.x;
      projection.elements[6] = clipPlane.y;
      projection.elements[10] = clipPlane.z + 1 - 0.003;
      projection.elements[14] = clipPlane.w;
      const shadows = renderer.shadowMap.enabled;
      const previousFog = scene.fog;
      const previousBackground = scene.background;
      renderer.shadowMap.enabled = false;
      scene.fog = null;
      scene.background = reflectSky;
      overlay.visible = false;
      renderer.setRenderTarget(target);
      renderer.clear();
      renderer.render(scene, mirrorCamera);
      renderer.setRenderTarget(null);
      renderer.shadowMap.enabled = shadows;
      scene.fog = previousFog;
      scene.background = previousBackground;
    },
    strength(wetness) {
      (material as THREE.ShaderMaterial).uniforms.wetness.value = wetness;
      overlay.visible = wetness > 0.02;
    },
    dispose() {
      target.dispose();
    },
  };
}

function hash01(x: number, y: number): number {
  let n = Math.imul(x + 31, 374761393) ^ Math.imul(y + 17, 668265263);
  n = (n ^ (n >>> 13)) >>> 0;
  return n / 4294967296;
}

function smoothGrowth(wetness: number): number {
  const t = Math.min(1, Math.max(0, (wetness - 0.08) / 0.92));
  return t * t * (3 - 2 * t);
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
  texture.generateMipmaps = false;
  texture.anisotropy = 1;
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
