// Game rules live in src/game/ as plain TypeScript.
// Nothing in this folder may import React: the rules must be testable
// without a browser, and changing the UI must never change the rules.

/** The supply ship arrives on this day. Surviving until then wins the mission. */
export const MISSION_DAYS = 10

/** How many astronauts live on the base. Fewer people than jobs, on purpose. */
export const CREW_SIZE = 3

/** What one astronaut can do in one day. */
export const JOBS = ['solar', 'oxygen', 'farm', 'science', 'rest'] as const
export type Job = (typeof JOBS)[number]

/** The three things the base can run out of. */
export interface Resources {
  power: number
  oxygen: number
  food: number
}

/** Days left before the supply ship lands. Day 1 is the first day of the mission. */
export function daysUntilSupplyShip(day: number): number {
  return Math.max(0, MISSION_DAYS - day)
}
