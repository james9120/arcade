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
    moveTypeId: member.moveTypeId,
    moveTypeName: member.moveTypeName,
    typeIds: member.typeIds,
    typeNames: member.typeNames,
    front: member.front,
    back: member.back,
  };
}

export function spawnWild(slot: WildSlot, rng: () => number = Math.random): Combatant {
  const span = slot.maxLevel - slot.minLevel + 1;
  const level = slot.minLevel + Math.min(span - 1, Math.floor(rng() * span));
  return toCombatant({ ...slot, level });
}

/**
 * Generation 3 damage, without critical hits. `variance` is applied after the
 * base (this prototype folds same-type bonus and type matchup into it).
 * Always at least 1.
 */
export function computeDamage(
  attacker: Pick<Combatant, "attack" | "level">,
  defender: Pick<Combatant, "defense">,
  power: number,
  variance: number,
): number {
  const levelTerm = Math.floor((2 * attacker.level) / 5) + 2;
  const swung = Math.floor((levelTerm * power * attacker.attack) / Math.max(1, defender.defense));
  const base = Math.floor(swung / 50) + 2;
  return Math.max(1, Math.floor(base * variance));
}
