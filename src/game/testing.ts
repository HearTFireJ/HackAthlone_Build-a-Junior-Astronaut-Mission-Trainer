// Helpers for tests only: build small made-up scenarios so each rule can be
// tested on its own. The game itself only ever uses real data from src/data/.

import { type DayPlan, type GameState, type Job, MISSION_DAYS } from './mission.ts'
import type { Scenario, SpaceWeatherDay, StormLevel } from './scenario.ts'

export function makeDay(storm: StormLevel = 0, strongestFlare: string | null = null): SpaceWeatherDay {
  const instruments = storm === 2 ? ['GOES-P: SEISS >100 MeV'] : ['GOES-P: SEISS >10 MeV']
  return {
    date: '2000-01-01',
    strongestFlare,
    strongestFlareLink: null,
    flareCount: strongestFlare ? 1 : 0,
    particleEvents: storm > 0 ? [{ time: '2000-01-01T12:00Z', instruments, link: '' }] : [],
    maxKp: null,
  }
}

/** A scenario with a storm of the given level on each mission day (0 = calm). */
export function makeScenario(storms: StormLevel[] = []): Scenario {
  const days = Array.from({ length: MISSION_DAYS }, (_, index) => makeDay(storms[index] ?? 0))
  return { id: 'test', dayBefore: makeDay(), days }
}

/** The same job list for the three astronauts, in crew order. */
export function jobs(state: GameState, first: Job, second: Job, third: Job): DayPlan {
  const [a, b, c] = state.crew
  return { shelter: false, jobs: { [a.id]: first, [b.id]: second, [c.id]: third } }
}

export const SHELTER: DayPlan = { shelter: true, jobs: {} }
