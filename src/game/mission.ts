// Game rules live in src/game/ as plain TypeScript.
// Nothing in this folder may import React: the rules must be testable
// without a browser, and changing the UI must never change the rules.
//
// The whole game is one pure function, resolveDay: given today's state and
// the player's plan, it returns tomorrow's state and a report of what happened.
// There is no randomness. What changes between missions is the real space
// weather the mission is played against.

import { type Scenario, type StormLevel, stormLevel, weatherOn } from './scenario.ts'

/** The supply ship arrives at the end of this day. Lasting until then wins the mission. */
export const MISSION_DAYS = 10

/** How many astronauts live on the base. Fewer people than jobs, on purpose. */
export const CREW_SIZE = 3

/** What one astronaut can do in one day. */
export const JOBS = ['solar', 'oxygen', 'farm', 'science', 'rest'] as const
export type Job = (typeof JOBS)[number]

/** The three things the base can run out of. */
export const RESOURCES = ['power', 'oxygen', 'food'] as const
export type ResourceName = (typeof RESOURCES)[number]
export type Resources = Record<ResourceName, number>

/**
 * All the numbers of the game in one place, so they are easy to tune.
 * These are game simplifications, not measurements.
 */
export const RULES = {
  /** Each resource starts here and can never go above the storage limit. */
  startingAmount: 8,
  storageLimit: 10,
  /** What the base uses up every day, whatever the crew does. */
  dailyUse: 2,
  /** What one astronaut adds by working one day on solar panels, oxygen or farming. */
  jobOutput: 3,
  /** One day of science outside earns this many science points... */
  scienceOutput: 1,
  /** ...and uses this much extra oxygen for the space suit. */
  scienceOxygenCost: 1,
  /** Every astronaut starts with full health. */
  fullHealth: 4,
  /** Health an astronaut gets back from one day of rest. */
  restHealing: 1,
  /** Health everyone loses on a day the base runs out of oxygen, and again for food. */
  shortageDamage: 1,
  /** Health lost in a solar storm: [storm, severe storm]. The shelter blocks all of it. */
  stormDamageOutside: [2, 3],
  stormDamageInside: [1, 2],
  /** Science points needed for 2 and 3 stars. Finishing the mission is 1 star. */
  starThresholds: [4, 8],
} as const

export interface Astronaut {
  id: string
  name: string
  /** 0 means too sick to work: this astronaut can only rest. */
  health: number
}

export type MissionStatus = 'playing' | 'won' | 'evacuated'

export interface GameState {
  scenario: Scenario
  /** The day being planned, from 1 to MISSION_DAYS. */
  day: number
  resources: Resources
  crew: Astronaut[]
  science: number
  status: MissionStatus
  /** One report per finished day, oldest first. */
  history: DayReport[]
}

/** The player's decision for one day. */
export interface DayPlan {
  /** Everyone stays in the storm shelter all day. Nobody works. */
  shelter: boolean
  /** Job for each astronaut id. Ignored when shelter is true. */
  jobs: Record<string, Job>
}

export interface AstronautReport {
  id: string
  name: string
  /** What the astronaut actually did. 'shelter' on a shelter day. */
  did: Job | 'shelter'
  /** True if the astronaut was too sick for the job the player picked. */
  tooSickToWork: boolean
  healthBefore: number
  healthAfter: number
  stormDamage: number
}

/** Everything that happened in one day, for the UI to show and explain. */
export interface DayReport {
  day: number
  /** The real date this day's space weather comes from. */
  date: string
  shelter: boolean
  storm: StormLevel
  /** No power at the start of the day: the oxygen machine and greenhouse lamps were off. */
  machinesOff: boolean
  produced: Resources
  used: Resources
  ranOutOf: ResourceName[]
  scienceGained: number
  crew: AstronautReport[]
  resourcesAfter: Resources
}

/** Placeholder crew names; the author still has to choose the final ones. */
const DEFAULT_CREW_NAMES = ['Aoife', 'Cian', 'Niamh'] as const

export function createGame(scenario: Scenario): GameState {
  if (scenario.days.length !== MISSION_DAYS) {
    throw new Error(`Scenario ${scenario.id} must have exactly ${MISSION_DAYS} days`)
  }
  return {
    scenario,
    day: 1,
    resources: {
      power: RULES.startingAmount,
      oxygen: RULES.startingAmount,
      food: RULES.startingAmount,
    },
    crew: DEFAULT_CREW_NAMES.map((name, index) => ({
      id: `astronaut-${index + 1}`,
      name,
      health: RULES.fullHealth,
    })),
    science: 0,
    status: 'playing',
    history: [],
  }
}

/** A plan where everybody rests. A handy starting point for the UI and tests. */
export function emptyPlan(state: GameState): DayPlan {
  return {
    shelter: false,
    jobs: Object.fromEntries(state.crew.map((astronaut) => [astronaut.id, 'rest' as Job])),
  }
}

/** Days left before the supply ship lands. Day 1 is the first day of the mission. */
export function daysUntilSupplyShip(day: number): number {
  return Math.max(0, MISSION_DAYS - day)
}

/** 0 stars if the crew had to leave, otherwise 1 to 3 depending on science done. */
export function starsFor(state: GameState): 0 | 1 | 2 | 3 {
  if (state.status !== 'won') return 0
  const [twoStars, threeStars] = RULES.starThresholds
  if (state.science >= threeStars) return 3
  if (state.science >= twoStars) return 2
  return 1
}

/**
 * Plays one day. Does not change `state`; returns the next state and a report.
 *
 * Order of the day:
 *  1. Crew work (or sit in the shelter).
 *  2. A solar storm arrives, if the real data has one on this day.
 *  3. The base uses up its daily power, oxygen and food.
 *  4. Resting astronauts recover.
 *  5. Check whether the mission goes on, is won, or the crew must leave.
 */
export function resolveDay(state: GameState, plan: DayPlan): { state: GameState; report: DayReport } {
  if (state.status !== 'playing') throw new Error('The mission is already over')

  const weather = weatherOn(state.scenario, state.day)
  const storm = stormLevel(weather)
  const resources: Resources = { ...state.resources }
  const produced: Resources = { power: 0, oxygen: 0, food: 0 }
  const used: Resources = { power: 0, oxygen: 0, food: 0 }
  let scienceGained = 0

  // The oxygen machine and the greenhouse lamps run on electricity.
  const machinesOff = !plan.shelter && state.resources.power <= 0

  // 1. Work.
  const crewReports: AstronautReport[] = state.crew.map((astronaut) => {
    const wanted: Job = plan.jobs[astronaut.id] ?? 'rest'
    const tooSickToWork = !plan.shelter && astronaut.health <= 0 && wanted !== 'rest'
    const did: Job | 'shelter' = plan.shelter ? 'shelter' : tooSickToWork ? 'rest' : wanted

    if (did === 'solar') produced.power += RULES.jobOutput
    if (did === 'oxygen' && !machinesOff) produced.oxygen += RULES.jobOutput
    if (did === 'farm' && !machinesOff) produced.food += RULES.jobOutput
    if (did === 'science') {
      scienceGained += RULES.scienceOutput
      used.oxygen += RULES.scienceOxygenCost
    }

    return {
      id: astronaut.id,
      name: astronaut.name,
      did,
      tooSickToWork,
      healthBefore: astronaut.health,
      healthAfter: astronaut.health,
      stormDamage: 0,
    }
  })

  // 2. Solar storm. The shelter blocks it; the base walls block only part of it.
  if (storm > 0) {
    for (const report of crewReports) {
      if (report.did === 'shelter') continue
      const table = report.did === 'science' ? RULES.stormDamageOutside : RULES.stormDamageInside
      report.stormDamage = table[storm - 1]
    }
  }

  // 3. Daily use. Production is added first, then the day's needs are taken out.
  //    Whatever is left above the storage limit is lost.
  const ranOutOf: ResourceName[] = []
  for (const name of RESOURCES) {
    used[name] += RULES.dailyUse
    const left = resources[name] + produced[name] - used[name]
    if (left < 0) ranOutOf.push(name)
    resources[name] = Math.min(RULES.storageLimit, Math.max(0, left))
  }
  // Running out of power does not hurt people directly: it switches machines off tomorrow.
  const shortages = ranOutOf.filter((name) => name !== 'power').length

  // 4. Health changes: storm, shortages, then rest.
  //    Nobody recovers on a day without enough air or food. Without this rule,
  //    "everyone rests every day" would be a free, safe way to finish the mission.
  const crew: Astronaut[] = state.crew.map((astronaut, index) => {
    const report = crewReports[index]
    let health = astronaut.health - report.stormDamage - shortages * RULES.shortageDamage
    health = Math.max(0, health)
    if (report.did === 'rest' && shortages === 0) {
      health = Math.min(RULES.fullHealth, health + RULES.restHealing)
    }
    report.healthAfter = health
    return { ...astronaut, health }
  })

  // 5. Mission status.
  const everyoneSick = crew.every((astronaut) => astronaut.health <= 0)
  const lastDay = state.day >= MISSION_DAYS
  const status: MissionStatus = everyoneSick ? 'evacuated' : lastDay ? 'won' : 'playing'

  const report: DayReport = {
    day: state.day,
    date: weather.date,
    shelter: plan.shelter,
    storm,
    machinesOff,
    produced,
    used,
    ranOutOf,
    scienceGained,
    crew: crewReports,
    resourcesAfter: resources,
  }

  return {
    report,
    state: {
      ...state,
      day: status === 'playing' ? state.day + 1 : state.day,
      resources,
      crew,
      science: state.science + scienceGained,
      status,
      history: [...state.history, report],
    },
  }
}
