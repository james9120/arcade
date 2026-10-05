import { canEnter, type Direction, type TownMap } from "./types";

export const STEP_SECONDS = 0.16;

const DELTA: Record<Direction, [number, number]> = {
  n: [0, -1],
  s: [0, 1],
  w: [-1, 0],
  e: [1, 0],
};

export interface WalkSample {
  x: number;
  y: number;
  dir: Direction;
  moving: boolean;
  entered: boolean;
  bumped: boolean;
}

export class Walker {
  x: number;
  y: number;
  dir: Direction = "n";
  held: Direction | null = null;
  frozen = false;

  private step: { fromX: number; fromY: number; toX: number; toY: number; t: number } | null = null;
  private bumpLock = 0;

  constructor(
    private readonly town: TownMap,
    x: number,
    y: number,
  ) {
    this.x = x;
    this.y = y;
  }

  hold(dir: Direction | null): void {
    this.held = dir;
  }

  update(dt: number): WalkSample {
    let entered = false;
    let bumped = false;
    this.bumpLock = Math.max(0, this.bumpLock - dt);

    if (this.step) {
      this.step.t += dt;
      if (this.step.t >= STEP_SECONDS) {
        this.x = this.step.toX;
        this.y = this.step.toY;
        this.step = null;
        entered = true;
      }
    }

    if (!this.step && this.held && !this.frozen) {
      if (!this.begin(this.held) && this.bumpLock === 0) {
        bumped = true;
        this.bumpLock = 0.22;
        this.dir = this.held;
      }
    }

    return {
      x: this.visualX(),
      y: this.visualY(),
      dir: this.dir,
      moving: this.step !== null,
      entered,
      bumped,
    };
  }

  private begin(dir: Direction): boolean {
    const [dx, dy] = DELTA[dir];
    const toX = this.x + dx;
    const toY = this.y + dy;
    this.dir = dir;
    if (!canEnter(this.town, toX, toY, dir)) return false;
    this.step = { fromX: this.x, fromY: this.y, toX, toY, t: 0 };
    return true;
  }

  private visualX(): number {
    if (!this.step) return this.x;
    return lerp(this.step.fromX, this.step.toX, ease(this.step.t / STEP_SECONDS));
  }

  private visualY(): number {
    if (!this.step) return this.y;
    return lerp(this.step.fromY, this.step.toY, ease(this.step.t / STEP_SECONDS));
  }
}

function ease(t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  return clamped * clamped * (3 - 2 * clamped);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
