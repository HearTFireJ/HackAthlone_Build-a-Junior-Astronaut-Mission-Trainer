// Turns real space weather records into what the game needs to know each day:
// the morning forecast and whether a solar storm reaches the base.
//
// Everything here is plain TypeScript with no browser or React code.

/** One real day of space weather, as written by scripts/fetch-donki.mjs. */
export interface SpaceWeatherDay {
  /** Real calendar date, e.g. "2017-09-06". */
  date: string
  /** Strongest solar flare that day, e.g. "X9.3", or null if there was none. */
  strongestFlare: string | null
  strongestFlareLink: string | null
  flareCount: number
  /** Solar particle events that started on this day, measured by spacecraft near Earth (and so near the Moon). */
  particleEvents: { time: string; instruments: string[]; link: string }[]
  /** Highest Kp index (how disturbed Earth's magnetic field was), or null. */
  maxKp: number | null
}

export interface Scenario {
  id: string
  /** The real day before mission day 1. The first forecast looks at its flares. */
  dayBefore: SpaceWeatherDay
  /** Exactly one entry per mission day. */
  days: SpaceWeatherDay[]
}

export type ForecastLevel = 'low' | 'medium' | 'high'

/** 0 = no storm, 1 = storm, 2 = severe storm. */
export type StormLevel = 0 | 1 | 2

/**
 * How strong the solar storm at the base is on this real day.
 *
 * Real data: DONKI lists each solar energetic particle event with the time a
 * spacecraft near Earth first measured it. Those particles are the radiation
 * danger for astronauts on the Moon, which has no air or magnetic field to
 * stop them.
 * Game simplification: each event makes exactly one storm day, the day it
 * started. Real particle events can go on for several days, so a "calm" day
 * in the game only means that no new event started. "Severe" means protons
 * above 100 MeV were measured.
 */
export function stormLevel(day: SpaceWeatherDay): StormLevel {
  if (day.particleEvents.length === 0) return 0
  const veryEnergetic = day.particleEvents.some((event) =>
    event.instruments.some((name) => name.includes('>100 MeV')),
  )
  return veryEnergetic ? 2 : 1
}

/**
 * The morning forecast for one mission day (1-based).
 *
 * Real data: yesterday's strongest solar flare.
 * Game simplification: X-class flare yesterday means "high", M-class means
 * "medium", anything weaker means "low". Real forecasters use much more than
 * this, and like them, this forecast is sometimes wrong.
 */
export function forecastLevel(scenario: Scenario, missionDay: number): ForecastLevel {
  const yesterday = yesterdayOf(scenario, missionDay)
  const flare = yesterday.strongestFlare
  if (flare?.startsWith('X')) return 'high'
  if (flare?.startsWith('M')) return 'medium'
  return 'low'
}

/**
 * Whether the radio link to Earth is down this morning, so no forecast arrives.
 *
 * Game simplification: the link is down on the morning after a storm day.
 */
export function radioDown(scenario: Scenario, missionDay: number): boolean {
  if (missionDay <= 1) return false
  return stormLevel(yesterdayOf(scenario, missionDay)) > 0
}

export function weatherOn(scenario: Scenario, missionDay: number): SpaceWeatherDay {
  const day = scenario.days[missionDay - 1]
  if (!day) throw new Error(`Scenario ${scenario.id} has no data for mission day ${missionDay}`)
  return day
}

export function yesterdayOf(scenario: Scenario, missionDay: number): SpaceWeatherDay {
  return missionDay <= 1 ? scenario.dayBefore : weatherOn(scenario, missionDay - 1)
}
