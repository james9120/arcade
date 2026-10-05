import type { Combatant, PartyMember, WildSlot } from "./types";

/**
 * Rough battle stats for this prototype: no individual values, effort values,
 * or nature. High enough that a short fight resolves in a handful of turns.
 */
export function statsFromBase(
  baseHp: number,
  baseAttack: number,
  baseDefense: number,
  baseSpeed: number,
  level: number,
): { hp: number; attack: number; defense: number; speed: number } {
  return {
    hp: Math.max(1, Math.floor((baseHp * 2 * level) / 100) + level + 10),
    attack: Math.max(1, Math.floor((baseAttack * 2 * level) / 100) + 5),
    defense: Math.max(1, Math.floor((baseDefense * 2 * level) / 100) + 5),
    speed: Math.max(1, Math.floor((baseSpeed * 2 * level) / 100) + 5),
  };
}

export function toCombatant(member: PartyMember): Combatant {
  const stats = statsFromBase(member.baseHp, member.baseAttack, member.baseDefense, member.baseSpeed, member.level);
  return {
    name: member.name,
    level: member.level,
    maxHp: stats.hp,
    hp: stats.hp,
    attack: stats.attack,
    defense: stats.defense,
    speed: stats.speed,
    moveName: member.moveName,
    movePower: member.movePower,
    accent: member.accent,
    portrait: member.portrait,
  };
}

export function spawnWild(slot: WildSlot, rng: () => number = Math.random): Combatant {
  const span = slot.maxLevel - slot.minLevel + 1;
  const level = slot.minLevel + Math.min(span - 1, Math.floor(rng() * span));
  return toCombatant({ ...slot, level });
}

/**
 * Basic damage. `variance` is a multiplier around 1 (this prototype uses 0.9–1.1).
 * Always at least 1.
 */
export function computeDamage(
  attacker: Pick<Combatant, "attack" | "level">,
  defender: Pick<Combatant, "defense">,
  power: number,
  variance: number,
): number {
  const pressure = attacker.attack + attacker.level;
  const raw = Math.floor((pressure * power) / Math.max(1, defender.defense));
  return Math.max(1, Math.floor(raw * variance));
}
