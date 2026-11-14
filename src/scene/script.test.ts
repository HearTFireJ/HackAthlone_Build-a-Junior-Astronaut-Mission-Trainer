import { describe, expect, it } from 'vitest'
import raw from '../data/scenarios.json'
import { type GameState, type Plan, alertFor, createGame, emptyPlan, resolveDay } from '../game/outpost.ts'
import { FLARE, STORM, scenarioOf } from '../game/testing.ts'
import { walk, spotFor } from './layout.ts'
import { MORNING, type Cue, hudOf, later, morningScript, restScript } from './script.ts'

/** Everyone gets something to do, with the radio on so that alerts arrive. */
function busyPlan(state: GameState): Plan {
  const plan = emptyPlan(state)
  plan.power.life = true
  plan.power.farm = true
  plan.power.comms = true
  plan.jobs.aoife = { kind: 'garden' }
  plan.jobs.niamh = { kind: 'build' }
  return plan
}

const kinds = (cues: Cue[]) => cues.map((cue) => cue.kind)
const lastHud = (cues: Cue[], key: 'air' | 'food') => {
  const patches = cues.filter((cue) => cue.kind === 'hud' && cue.patch[key] !== undefined)
  const last = patches[patches.length - 1]
  return last && last.kind === 'hud' ? last.patch[key] : undefined
}

describe('the film of a day', () => {
  it('sends everyone at the base somewhere in the morning', () => {
    const state = createGame('sep-2017', 1)
    const scenario = scenarioOf('sep-2017')
    const plan = busyPlan(state)
    const calm = resolveDay(state, scenario, plan, 'carry')
    const morning = morningScript(state, calm.report, false)
    const sent = morning.filter((cue) => cue.kind === 'go').map((cue) => (cue.kind === 'go' ? `${cue.who}:${cue.act}` : ''))
    expect(sent).toContain('aoife:garden')
    expect(sent).toContain('niamh:build')
    expect(sent).toContain('cian:rest')
    expect(kinds(morning)).not.toContain('alert')
  })

  it('stops for the alert at the end of the morning, and not before', () => {
    const state = createGame('sep-2017', 1)
    const scenario = scenarioOf('sep-2017', [{ watchFlare: FLARE }])
    const plan = busyPlan(state)
    expect(alertFor(state, scenario, plan)).not.toBeNull()
    const calm = resolveDay(state, scenario, plan, 'carry')
    const morning = morningScript(state, calm.report, true)
    const last = morning[morning.length - 1]
    expect(last.kind).toBe('alert')
    expect(last.t).toBe(MORNING)
    expect(morning.every((cue) => cue.t <= MORNING)).toBe(true)
  })

  it('ends with the numbers the rules worked out', () => {
    const state = createGame('sep-2017', 1)
    const scenario = scenarioOf('sep-2017', [{ watchFlare: FLARE, storm: STORM }])
    const plan = busyPlan(state)
    for (const response of ['carry', 'inside', 'shelter'] as const) {
      const result = resolveDay(state, scenario, plan, response)
      const film = restScript(state, result.state, result.report, null, 'a day')
      expect(film[film.length - 1].kind).toBe('end')
      expect(lastHud(film, 'air')).toBe(result.state.air)
      expect(lastHud(film, 'food')).toBe(result.state.food)
      const crewPatches = film.filter((cue) => cue.kind === 'hud' && cue.patch.crew)
      const final = crewPatches[crewPatches.length - 1]
      const after = hudOf(result.state).crew
      expect(final.kind === 'hud' && final.patch.crew).toEqual(after)
      // Times never run backwards once sorted, and nothing happens after the end.
      const end = film[film.length - 1].t
      expect(film.every((cue) => cue.t >= 0 && cue.t <= end)).toBe(true)
    }
  })

  it('shows the storm hitting exactly the people the rules say were hurt', () => {
    const state = createGame('sep-2017', 1)
    const scenario = scenarioOf('sep-2017', [{ watchFlare: FLARE, storm: STORM }])
    const plan = busyPlan(state)
    const carried = resolveDay(state, scenario, plan, 'carry')
    const film = restScript(state, carried.state, carried.report, null, 'a day')
    expect(kinds(film)).toContain('storm')
    const hit = film.filter((cue) => cue.kind === 'hit').map((cue) => (cue.kind === 'hit' ? cue.who : ''))
    const hurt = carried.report.crew.filter((member) => member.hurt > 0).map((member) => member.id)
    expect(hit.sort()).toEqual(hurt.sort())
    expect(hurt).toContain('niamh')

    const sheltered = resolveDay(state, scenario, plan, 'shelter')
    const safe = restScript(state, sheltered.state, sheltered.report, null, 'a day')
    expect(kinds(safe)).not.toContain('hit')
    expect(safe.filter((cue) => cue.kind === 'go' && cue.act === 'shelter')).toHaveLength(state.crew.length)
  })

  it('brings a recalled rover home', () => {
    const state = createGame('sep-2017', 1)
    const scenario = scenarioOf('sep-2017', [{ watchFlare: FLARE }])
    const plan = busyPlan(state)
    plan.power.farm = false
    plan.power.garage = true
    plan.jobs.cian = { kind: 'trip', trip: 'scout' }
    const result = resolveDay(state, scenario, plan, 'inside')
    const film = restScript(state, result.state, result.report, null, 'a day')
    expect(film.some((cue) => cue.kind === 'rover-in' && cue.who === 'cian')).toBe(true)
  })

  it('can film every day of every real mission without breaking', () => {
    for (const scenario of raw.scenarios) {
      let state = createGame(scenario.id, 7)
      for (let day = 1; day <= 10 && state.status === 'playing'; day++) {
        const plan = busyPlan(state)
        const alert = alertFor(state, scenario, plan)
        const calm = resolveDay(state, scenario, plan, 'carry')
        const morning = morningScript(state, calm.report, alert !== null)
        const result = alert ? resolveDay(state, scenario, plan, day % 2 ? 'shelter' : 'inside') : calm
        const film = [...morning, ...later(restScript(state, result.state, result.report, null, 'a day'), MORNING)]
        expect(film.filter((cue) => cue.kind === 'end')).toHaveLength(1)
        state = result.state
        state.event = null
      }
    }
  })
})

describe('walking around the base', () => {
  it('finds a way between any two places, through the doors', () => {
    const acts = ['idle', 'garden', 'lab', 'build', 'rest', 'shelter', 'board'] as const
    for (const from of acts) {
      for (const to of acts) {
        const steps = walk(spotFor(from, 0).node, spotFor(to, 0))
        const end = steps[steps.length - 1]
        expect(end.x).toBe(spotFor(to, 0).x)
        expect(end.y).toBe(spotFor(to, 0).y)
      }
    }
    // From the building site to the shelter: out through the airlock, never in a straight line.
    expect(walk(spotFor('build', 0).node, spotFor('shelter', 0)).length).toBeGreaterThan(4)
  })
})
