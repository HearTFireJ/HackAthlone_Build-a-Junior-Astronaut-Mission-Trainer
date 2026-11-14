// Helpers for tests: build a made-up stretch of space weather, so each test can
// say exactly which days have a flare or a storm.

import type { Scenario, StormRecord, WatchFlare, WeatherDay } from './weather.ts'

export const FLARE: WatchFlare = { class: 'X2.0', time: '2030-01-01T10:00Z', cme: true, location: null, link: 'https://example.org/flare' }
export const FLARE_NO_CLOUD: WatchFlare = { ...FLARE, cme: false }
export const STORM: StormRecord = { time: '2030-01-01T15:00Z', severe: false, instruments: ['GOES: >10 MeV'], link: 'https://example.org/storm' }
export const SEVERE_STORM: StormRecord = { ...STORM, severe: true }

export function day(parts: Partial<WeatherDay> = {}): WeatherDay {
  return { date: '2030-01-01', flareCount: 0, strongestFlare: null, watchFlare: null, storm: null, maxKp: null, ...parts }
}

/** A scenario from a list of days. Missing days are calm. It always has ten days. */
export function scenarioOf(id: string, days: Partial<WeatherDay>[] = []): Scenario {
  const all = Array.from({ length: 10 }, (_, index) => day(days[index] ?? {}))
  return { id, dayBefore: day(), days: all }
}
