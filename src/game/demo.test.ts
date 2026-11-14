import { describe, expect, it } from 'vitest'
import raw from '../data/scenarios.json'
import { JOBS } from './content.ts'
import { DEMO, demoGame } from './demo.ts'
import { RULES, alertFor, jobProblem, poweredModules } from './outpost.ts'
import type { Scenario } from './weather.ts'

const scenario = (raw.scenarios as Scenario[]).find((item) => item.id === DEMO.scenarioId)!

describe('the demo game', () => {
  it('opens on the morning of 11 May 2024 with a healthy crew and nothing waiting to be answered', () => {
    const { game } = demoGame(scenario)
    expect(scenario.days[game.day - 1].date).toBe('2024-05-11')
    expect(game.status).toBe('playing')
    expect(game.history).toHaveLength(DEMO.day - 1)
    expect(game.event).toBe(null)
    expect(game.crew.map((astronaut) => astronaut.id)).toEqual(DEMO.crew)
    for (const astronaut of game.crew) {
      expect(astronaut.health).toBeGreaterThanOrEqual(4)
      expect(astronaut.mood).toBeGreaterThanOrEqual(4)
      expect(astronaut.away).toBe(null)
    }
  })

  it('starts the day with orders that make the flare alert a real decision', () => {
    const { game, plan } = demoGame(scenario)
    // Every order can be carried out as given.
    for (const [id, job] of Object.entries(plan.jobs)) expect([id, jobProblem(game, plan, id, job)]).toEqual([id, null])
    // Somebody is outside, the radio is on, and the Sun Telescope shows whether a cloud left the Sun.
    expect(Object.values(plan.jobs).some((job) => JOBS[job.kind].outside)).toBe(true)
    expect(poweredModules(game, plan)).toEqual(expect.arrayContaining(['life', 'comms', 'scope']))
    const alert = alertFor(game, scenario, plan)
    expect(alert?.cloudKnown).toBe(true)
    expect(scenario.days[game.day - 1].storm).not.toBe(null)
  })

  it('is the same game every time', () => {
    expect(demoGame(scenario)).toEqual(demoGame(scenario))
  })

  it('can be played to the end by the script', () => {
    const { game } = demoGame(scenario, RULES.maxDays + 1)
    expect(game.status).toBe('done')
    expect(game.history).toHaveLength(RULES.maxDays)
  })
})
