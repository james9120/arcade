import { computeDamage } from "./stats";
import { typeMultiplier } from "../rom/monsters";
import type { Combatant } from "./types";

export type BattleOutcome = "win" | "lose" | "run";

export interface BattleHit {
  kind: "hit";
  defender: "player" | "wild";
  text: string;
}

export interface BattleEnd {
  kind: "end";
  outcome: BattleOutcome;
  text: string;
}

export type BattleEvent = BattleHit | BattleEnd;

export class Battle {
  outcome: BattleOutcome | null = null;

  constructor(
    readonly player: Combatant,
    readonly wild: Combatant,
    private readonly rng: () => number = Math.random,
    private readonly chart: readonly number[] = [],
  ) {}

  get over(): boolean {
    return this.outcome !== null;
  }

  fight(): BattleEvent[] {
    if (this.over) return [];
    const order: Array<"player" | "wild"> =
      this.player.speed >= this.wild.speed ? ["player", "wild"] : ["wild", "player"];
    const events: BattleEvent[] = [];
    for (const side of order) {
      if (this.player.hp <= 0 || this.wild.hp <= 0) break;
      events.push(this.strike(side));
      if (this.player.hp <= 0) {
        this.outcome = "lose";
        events.push({
          kind: "end",
          outcome: "lose",
          text: `${this.player.name} needs a breather. You step back onto the path.`,
        });
        break;
      }
      if (this.wild.hp <= 0) {
        this.outcome = "win";
        events.push({
          kind: "end",
          outcome: "win",
          text: `${this.wild.name} has had enough and ducks back into the grass.`,
        });
        break;
      }
    }
    return events;
  }

  run(): BattleEvent[] {
    if (this.over) return [];
    if (this.rng() < 0.75) {
      this.outcome = "run";
      return [{ kind: "end", outcome: "run", text: "You slip back out of the grass." }];
    }
    const hit = this.strike("wild");
    const events: BattleEvent[] = [
      { kind: "hit", defender: "player", text: `Too slow. ${hit.text}` },
    ];
    if (this.player.hp <= 0) {
      this.outcome = "lose";
      events.push({
        kind: "end",
        outcome: "lose",
        text: `${this.player.name} needs a breather. You step back onto the path.`,
      });
    }
    return events;
  }

  private strike(attackerSide: "player" | "wild"): BattleHit {
    const attacker = attackerSide === "player" ? this.player : this.wild;
    const defenderSide = attackerSide === "player" ? "wild" : "player";
    const defender = defenderSide === "player" ? this.player : this.wild;
    const variance = 0.9 + this.rng() * 0.2;
    const stab = attacker.typeIds.includes(attacker.moveTypeId) ? 1.5 : 1;
    const matchup = typeMultiplier(this.chart, attacker.moveTypeId, defender.typeIds);
    const damage = computeDamage(attacker, defender, attacker.movePower, variance * stab * matchup);
    defender.hp = Math.max(0, defender.hp - damage);
    return {
      kind: "hit",
      defender: defenderSide,
      text: `${attacker.name} uses ${attacker.moveName} for ${damage} damage.`,
    };
  }
}
