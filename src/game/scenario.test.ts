import { describe, expect, it } from 'vitest'
import { SCENARIOS } from '../data/scenarios.ts'
import { type DayPlan, type GameState, MISSION_DAYS, createGame, emptyPlan, resolveDay } from './mission.ts'
import { forecastLevel, radioDown, stormLevel, weatherOn } from './scenario.ts'
import { SHELTER, jobs, makeDay, makeScenario } from './testing.ts'

function byId(id: string) {
  const found = SCENARIOS.find((info) => info.scenario.id === id)
  if (!found) throw new Error(`no scenario ${id}`)
  return found.scenario
}

function playOut(start: GameState, choose: (state: GameState) => DayPlan): GameState {
  let state = start
  while (state.status === 'playing') state = resolveDay(state, choose(state)).state
  return state
}

describe('reading real space weather', () => {
  it('a day with no particle event is calm', () => {
    expect(stormLevel(makeDay(0))).toBe(0)
  })

  it('a measured particle event is a storm, and >100 MeV makes it severe', () => {
    expect(stormLevel(makeDay(1))).toBe(1)
    expect(stormLevel(makeDay(2))).toBe(2)
  })

  it('forecast follows yesterday\'s strongest flare', () => {
    const scenario = makeScenario()
    scenario.dayBefore = makeDay(0, 'X1.3')
    scenario.days[0] = makeDay(0, 'M5.5')
    scenario.days[1] = makeDay(0, 'C3.0')
    expect(forecastLevel(scenario, 1)).toBe('high')
    expect(forecastLevel(scenario, 2)).toBe('medium')
    expect(forecastLevel(scenario, 3)).toBe('low')
    expect(forecastLevel(scenario, 4)).toBe('low')
  })

  it('radio is down only on the morning after a storm', () => {
    const scenario = makeScenario([0, 1, 0])
    expect(radioDown(scenario, 1)).toBe(false)
    expect(radioDown(scenario, 2)).toBe(false)
    expect(radioDown(scenario, 3)).toBe(true)
    expect(radioDown(scenario, 4)).toBe(false)
  })
})

describe('the missions that ship with the game', () => {
  it('each have exactly ten real days in a row', () => {
    for (const { scenario } of SCENARIOS) {
      expect(scenario.days).toHaveLength(MISSION_DAYS)
      const dates = [scenario.dayBefore.date, ...scenario.days.map((day) => day.date)]
      for (let index = 1; index < dates.length; index += 1) {
        const gap = Date.parse(dates[index]) - Date.parse(dates[index - 1])
        expect(gap).toBe(24 * 60 * 60 * 1000)
      }
    }
  })

  it('December 2019 has no storms at all', () => {
    const scenario = byId('quiet-2019')
    expect(scenario.days.every((day) => stormLevel(day) === 0)).toBe(true)
  })

  it('September 2017 has the X9.3 flare on 6 September and a severe storm on the 10th', () => {
    const scenario = byId('sep-2017')
    expect(weatherOn(scenario, 4).date).toBe('2017-09-06')
    expect(weatherOn(scenario, 4).strongestFlare).toBe('X9.3')
    expect(weatherOn(scenario, 8).date).toBe('2017-09-10')
    expect(stormLevel(weatherOn(scenario, 8))).toBe(2)
  })

  it('May 2024 has a severe storm on 11 May', () => {
    const scenario = byId('may-2024')
    expect(weatherOn(scenario, 6).date).toBe('2024-05-11')
    expect(stormLevel(weatherOn(scenario, 6))).toBe(2)
  })

  it('show that the forecast can be wrong both ways', () => {
    // A storm on a "low" morning: 4 September 2017.
    const september = byId('sep-2017')
    expect(forecastLevel(september, 2)).toBe('low')
    expect(stormLevel(weatherOn(september, 2))).toBe(1)
    // A "high" morning with no storm: 6 May 2024.
    const may = byId('may-2024')
    expect(forecastLevel(may, 1)).toBe('high')
    expect(stormLevel(weatherOn(may, 1))).toBe(0)
  })
})

describe('balance on the real missions', () => {
  it('lazy plans fail on every mission', () => {
    for (const { scenario } of SCENARIOS) {
      expect(playOut(createGame(scenario), () => SHELTER).status).toBe('evacuated')
      expect(playOut(createGame(scenario), (state) => emptyPlan(state)).status).toBe('evacuated')
      const allScience = (state: GameState) => jobs(state, 'science', 'science', 'science')
      expect(playOut(createGame(scenario), allScience).status).toBe('evacuated')
    }
  })

  it('the calm mission can be finished by simply keeping the base running', () => {
    const end = playOut(createGame(byId('quiet-2019')), (state) => jobs(state, 'solar', 'oxygen', 'farm'))
    expect(end.status).toBe('won')
  })

  it('the stormy missions cannot be finished without ever using the shelter or resting', () => {
    for (const id of ['sep-2017', 'may-2024']) {
      const end = playOut(createGame(byId(id)), (state) => jobs(state, 'solar', 'oxygen', 'farm'))
      expect(end.status).toBe('evacuated')
    }
  })

  it('sheltering when the radio is down gets through both stormy missions', () => {
    for (const id of ['sep-2017', 'may-2024']) {
      const scenario = byId(id)
      const end = playOut(createGame(scenario), (state) => {
        if (radioDown(scenario, state.day)) return SHELTER
        // Otherwise: rest if weak, and keep the lowest supplies topped up.
        const plan = emptyPlan(state)
        const needs = (['oxygen', 'food', 'power'] as const)
          .slice()
          .sort((a, b) => state.resources[a] - state.resources[b])
        const jobFor = { power: 'solar', oxygen: 'oxygen', food: 'farm' } as const
        let next = 0
        for (const astronaut of state.crew) {
          if (astronaut.health <= 1) continue
          plan.jobs[astronaut.id] = jobFor[needs[next % needs.length]]
          next += 1
        }
        return plan
      })
      expect(end.status).toBe('won')
    }
  })
})
