// Real space weather, as saved from NASA's DONKI database by scripts/fetch-donki.mjs.
// This file only reads those records. It makes nothing up.

/** A big solar flare that Mission Control raises the alarm about. */
export interface WatchFlare {
  /** Flare size, for example "X9.3". X is the biggest class, M is ten times smaller. */
  class: string
  /** When the flare peaked (UTC). */
  time: string
  /** True when a CME (a huge cloud of gas thrown off the Sun) came with the flare. */
  cme: boolean
  location: string | null
  /** Link to the NASA record. */
  link: string
}

/** A solar particle storm measured by spacecraft near Earth. */
export interface StormRecord {
  /** When the first spacecraft measured it (UTC). */
  time: string
  /** True when protons above 100 MeV were measured: they get through more shielding. */
  severe: boolean
  instruments: string[]
  link: string
}

export interface WeatherDay {
  date: string
  flareCount: number
  strongestFlare: string | null
  watchFlare: WatchFlare | null
  storm: StormRecord | null
  maxKp: number | null
}

export interface Scenario {
  id: string
  /** The real day before mission day 1: the first morning's Sun report talks about it. */
  dayBefore: WeatherDay
  days: WeatherDay[]
}

/** The real weather on a mission day. Days count from 1. */
export function weatherOn(scenario: Scenario, day: number): WeatherDay {
  return scenario.days[day - 1]
}

export function yesterdayOf(scenario: Scenario, day: number): WeatherDay {
  return day <= 1 ? scenario.dayBefore : scenario.days[day - 2]
}

export type SunActivity = 'quiet' | 'active' | 'very active'

/** A one-word summary of a day's flares, for the morning Sun report. */
export function sunActivity(day: WeatherDay): SunActivity {
  const flare = day.strongestFlare
  if (!flare) return 'quiet'
  if (flare.startsWith('X')) return 'very active'
  if (flare.startsWith('M')) return 'active'
  return 'quiet'
}
