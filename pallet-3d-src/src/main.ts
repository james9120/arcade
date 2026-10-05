import { Battle, type BattleEvent } from "./game/battle";
import { spawnWild, toCombatant } from "./game/stats";
import {
  cellAt,
  type Combatant,
  type DecodedSprite,
  type Direction,
  type PartyMember,
  type TownMap,
  type WildSlot,
} from "./game/types";
import { Walker } from "./game/walker";
import { createScene, type SceneController } from "./render/scene";
import { RomError } from "./rom/error";
import { loadFireRedTown } from "./rom/map";

type Mode = "title" | "world" | "battle";

const view = must<HTMLCanvasElement>("view");
const title = must<HTMLElement>("title");
const hud = must<HTMLElement>("hud");
const dpad = must<HTMLElement>("dpad");
const battleEl = must<HTMLElement>("battle");
const flash = must<HTMLElement>("flash");
const loadButton = must<HTMLButtonElement>("load-rom");
const fileInput = must<HTMLInputElement>("rom-file");
const titleError = must<HTMLParagraphElement>("title-error");
const startersEl = must<HTMLElement>("starters");
const modePill = must<HTMLElement>("mode-pill");
const status = must<HTMLParagraphElement>("status");
const toTitle = must<HTMLButtonElement>("to-title");
const rainButton = must<HTMLButtonElement>("rain");
const fightButton = must<HTMLButtonElement>("fight");
const runButton = must<HTMLButtonElement>("run");
const battleMode = must<HTMLElement>("battle-mode");
const battleLog = must<HTMLParagraphElement>("battle-log");

let mode: Mode = "title";
let town: TownMap | null = null;
let pending: TownMap | null = null;
let walker: Walker | null = null;
let scene: SceneController | null = null;
let battle: Battle | null = null;
let busy = false;
let chain = 0;
let calm = 0;
let raining = false;
const keys = new Set<Direction>();
let pad: Direction | null = null;
let last = performance.now();

loadButton.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", () => {
  const chosen = fileInput.files?.[0];
  fileInput.value = "";
  if (chosen) void readRom(chosen);
});
title.addEventListener("dragover", (event) => event.preventDefault());
title.addEventListener("drop", (event) => {
  event.preventDefault();
  const chosen = event.dataTransfer?.files?.[0];
  if (chosen) void readRom(chosen);
});
toTitle.addEventListener("click", showTitle);
rainButton.addEventListener("click", () => {
  raining = !raining;
  rainButton.textContent = raining ? "Rain on" : "Rain";
  rainButton.setAttribute("aria-pressed", raining ? "true" : "false");
  scene?.setRain(raining);
});
fightButton.addEventListener("click", () => void onFight());
runButton.addEventListener("click", () => void onRun());

dpad.addEventListener("pointerdown", (event) => {
  const button = (event.target as HTMLElement).closest("button");
  if (!button?.dataset.dir) return;
  event.preventDefault();
  pad = button.dataset.dir as Direction;
  button.setPointerCapture(event.pointerId);
  walker?.hold(desiredDirection());
});
dpad.addEventListener("pointerup", () => {
  pad = null;
  walker?.hold(desiredDirection());
});
dpad.addEventListener("pointercancel", () => {
  pad = null;
  walker?.hold(desiredDirection());
});

window.addEventListener("keydown", (event) => {
  if (mode === "battle") {
    if (event.key === "f" || event.key === "F" || event.key === "Enter") {
      event.preventDefault();
      void onFight();
    } else if (event.key === "r" || event.key === "R") {
      event.preventDefault();
      void onRun();
    }
    return;
  }
  const dir = directionFromCode(event.code);
  if (!dir || mode !== "world") return;
  event.preventDefault();
  keys.add(dir);
  walker?.hold(desiredDirection());
});

window.addEventListener("keyup", (event) => {
  const dir = directionFromCode(event.code);
  if (!dir) return;
  keys.delete(dir);
  walker?.hold(desiredDirection());
});

requestAnimationFrame(frame);

async function readRom(file: File): Promise<void> {
  loadButton.disabled = true;
  loadButton.textContent = "Reading ROM…";
  titleError.hidden = true;
  startersEl.hidden = true;
  startersEl.replaceChildren();
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    pending = loadFireRedTown(bytes);
    showStarters(pending);
  } catch (error) {
    pending = null;
    titleError.textContent =
      error instanceof RomError ? error.message : "That file couldn't be read as a FireRed ROM.";
    titleError.hidden = false;
  } finally {
    loadButton.disabled = false;
    loadButton.textContent = "Load your FireRed ROM";
  }
}

function showStarters(loaded: TownMap): void {
  startersEl.replaceChildren();
  const label = document.createElement("p");
  label.className = "fine";
  label.textContent = "Choose a partner. Their name, stats, and sprite come from this ROM.";
  startersEl.append(label);
  const row = document.createElement("div");
  row.className = "starter-row";
  for (const starter of loaded.starters) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "starter";
    const picture = spriteElement(starter.front ?? starter.back, `${starter.name}`);
    const name = document.createElement("strong");
    name.textContent = starter.name;
    const meta = document.createElement("span");
    meta.textContent = `Lv. ${starter.level} · ${starter.typeNames.filter(Boolean).join(" / ") || "—"}`;
    button.append(picture, name, meta);
    button.addEventListener("click", () => startTown(loaded, starter));
    row.append(button);
  }
  startersEl.append(row);
  startersEl.hidden = false;
}

function startTown(loaded: TownMap, starter: PartyMember): void {
  teardown();
  town = { ...loaded, player: starter };
  walker = new Walker(town, town.spawnX, town.spawnY);
  scene = createScene(view, town);
  scene.setRain(raining);
  mode = "world";
  chain = 0;
  calm = 0;
  title.hidden = true;
  hud.hidden = false;
  dpad.hidden = false;
  battleEl.hidden = true;
  modePill.textContent = town.modeDetail;
  status.textContent = `${starter.name} is with you. Walk north through Route 1's tall grass.`;
  scene.sync({ x: town.spawnX, y: town.spawnY, dir: "n", moving: false }, 0);
}

function showTitle(): void {
  teardown();
  pending = null;
  mode = "title";
  title.hidden = false;
  hud.hidden = true;
  dpad.hidden = true;
  battleEl.hidden = true;
  startersEl.hidden = true;
  startersEl.replaceChildren();
}

function teardown(): void {
  scene?.dispose();
  scene = null;
  walker = null;
  town = null;
  battle = null;
  busy = false;
}

function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (mode === "world" && walker && scene) {
    const sample = walker.update(dt);
    scene.sync(sample, dt);
    if (sample.entered) onEntered();
    else if (sample.bumped) status.textContent = "Something solid is in the way.";
  } else if (mode === "battle" && walker && scene) {
    scene.sync({ x: walker.x, y: walker.y, dir: walker.dir, moving: false }, dt);
  }
  requestAnimationFrame(frame);
}

function onEntered(): void {
  if (!walker || !town) return;
  const cell = cellAt(town, walker.x, walker.y);
  if (!cell) return;
  if (calm > 0) {
    calm -= 1;
    return;
  }
  if (!cell.encounter) {
    chain = 0;
    return;
  }
  chain += 1;
  const table = cell.wild === "north" ? town.wildNorth : town.wildLocal;
  if (table.length === 0) {
    status.textContent = "This grass has no encounter list in the loaded data.";
    return;
  }
  const roll = chain >= 4 ? 0 : Math.random();
  if (roll < 0.22) {
    chain = 0;
    void startBattle(table);
  } else {
    status.textContent = "The tall grass shifts around your feet.";
  }
}

async function startBattle(table: WildSlot[]): Promise<void> {
  if (!town || !walker || busy) return;
  walker.frozen = true;
  walker.hold(null);
  mode = "battle";
  hud.hidden = true;
  dpad.hidden = true;
  flash.classList.remove("on");
  void flash.offsetWidth;
  flash.classList.add("on");
  const player = toCombatant(town.player);
  const wild = spawnWild(table[Math.floor(Math.random() * table.length)]);
  battle = new Battle(player, wild, Math.random, town.chart);
  paintCombatant("player", player, "back");
  paintCombatant("wild", wild, "front");
  battleMode.textContent = town.modeDetail;
  battleLog.textContent = `A wild ${wild.name} steps out of the grass.`;
  battleEl.hidden = false;
  setCommands(false);
}

async function onFight(): Promise<void> {
  if (!battle || busy || battle.over) return;
  busy = true;
  setCommands(true);
  await present(battle.fight());
  busy = false;
  if (battle.over) await finishBattle();
  else setCommands(false);
}

async function onRun(): Promise<void> {
  if (!battle || busy || battle.over) return;
  busy = true;
  setCommands(true);
  await present(battle.run());
  busy = false;
  if (battle?.over) await finishBattle();
  else setCommands(false);
}

async function present(events: BattleEvent[]): Promise<void> {
  for (const event of events) {
    battleLog.textContent = event.text;
    if (battle) {
      paintHp("player", battle.player);
      paintHp("wild", battle.wild);
    }
    await wait(event.kind === "end" ? 880 : 480);
  }
}

async function finishBattle(): Promise<void> {
  await wait(420);
  battleEl.hidden = true;
  battle = null;
  calm = 3;
  chain = 0;
  if (walker) walker.frozen = false;
  mode = "world";
  hud.hidden = false;
  dpad.hidden = false;
  status.textContent = "Back on the path. The grass is quiet for a moment.";
  walker?.hold(desiredDirection());
}

function paintCombatant(side: "player" | "wild", mon: Combatant, facing: "front" | "back"): void {
  const portrait = must<HTMLElement>(`${side}-portrait`);
  portrait.replaceChildren(spriteElement(facing === "back" ? mon.back ?? mon.front : mon.front ?? mon.back, mon.name));
  must<HTMLElement>(`${side}-name`).textContent = mon.name;
  const types = mon.typeNames.filter(Boolean).join(" / ");
  must<HTMLElement>(`${side}-level`).textContent = types
    ? `Lv. ${mon.level} · ${types} · ${mon.moveName}`
    : `Lv. ${mon.level} · ${mon.moveName}`;
  paintHp(side, mon);
}

function paintHp(side: "player" | "wild", mon: Combatant): void {
  const ratio = mon.maxHp === 0 ? 0 : mon.hp / mon.maxHp;
  const fill = must<HTMLElement>(`${side}-hp`);
  fill.style.width = `${Math.max(0, ratio) * 100}%`;
  fill.classList.toggle("low", ratio <= 0.25);
  fill.classList.toggle("mid", ratio > 0.25 && ratio <= 0.5);
  must<HTMLElement>(`${side}-hp-label`).textContent = `${mon.hp} / ${mon.maxHp}`;
}

function spriteElement(sprite: DecodedSprite | null, label: string): HTMLElement {
  const image = document.createElement("img");
  image.alt = label;
  if (!sprite) return image;
  const canvas = document.createElement("canvas");
  canvas.width = sprite.width;
  canvas.height = sprite.height;
  const context = canvas.getContext("2d");
  if (context) {
    context.putImageData(new ImageData(new Uint8ClampedArray(sprite.pixels), sprite.width, sprite.height), 0, 0);
    image.src = canvas.toDataURL();
  }
  return image;
}

function setCommands(disabled: boolean): void {
  fightButton.disabled = disabled;
  runButton.disabled = disabled;
}

function desiredDirection(): Direction | null {
  if (pad) return pad;
  for (const dir of ["n", "e", "s", "w"] as const) {
    if (keys.has(dir)) return dir;
  }
  return null;
}

function directionFromCode(code: string): Direction | null {
  switch (code) {
    case "ArrowUp":
    case "KeyW":
      return "n";
    case "ArrowDown":
    case "KeyS":
      return "s";
    case "ArrowLeft":
    case "KeyA":
      return "w";
    case "ArrowRight":
    case "KeyD":
      return "e";
    default:
      return null;
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function must<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing #${id}`);
  return node as T;
}
