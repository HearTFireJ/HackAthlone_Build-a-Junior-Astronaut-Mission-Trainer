import { describe, expect, it } from 'vitest'
import raw from '../data/scenarios.json'
import { MISSIONS, MODULE_IDS, PROJECT_IDS, SETUPS, START_IDS, type ModuleId } from './content.ts'
import { EVENTS, EVENT_IDS } from './events.ts'
import {
  RULES,
  airPerDay,
  type GameState,
  type Job,
  type Plan,
  type Response,
  alertFor,
  answerEvent,
  availableTrips,
  calmPreview,
  createGame,
  drawStart,
  missionDone,
  emptyPlan,
  allMissionsDone,
  handOver,
  handoverReady,
  panelsFixed,
  tripDays,
  jobProblem,
  powerAvailable,
  poweredModules,
  rate,
  resolveDay,
  workPoints,
} from './outpost.ts'
import { FLARE, SEVERE_STORM, STORM, scenarioOf } from './testing.ts'
import type { Scenario } from './weather.ts'

const CALM = scenarioOf('sep-2017')
/** The three real stretches of days the game ships with. */
const REAL: Scenario[] = raw.scenarios

/** A plan with these modules on and these jobs; everyone else rests. */
function planOf(state: GameState, power: ModuleId[], jobs: Record<string, Job> = {}): Plan {
  const plan = emptyPlan(state)
  for (const module of power) plan.power[module] = true
  Object.assign(plan.jobs, jobs)
  return plan
}

function crew(state: GameState, id: string) {
  const found = state.crew.find((astronaut) => astronaut.id === id)
  if (!found) throw new Error(`no ${id}`)
  return found
}

/** Plays whole days with the same kind of plan until the game ends. */
function playOut(scenario: Scenario, makePlan: (state: GameState) => Plan, response: Response = 'carry', eventOption = 1): GameState {
  let state = createGame(scenario.id, 7)
  while (state.status === 'playing') {
    if (state.event) state = answerEvent(state, eventOption).state
    state = resolveDay(state, scenario, makePlan(state), response).state
  }
  return state
}

describe('starting a game', () => {
  it('sets up the crew and supplies for the chosen difficulty', () => {
    expect(createGame('quiet-2019').crew).toHaveLength(4)
    expect(createGame('sep-2017').crew).toHaveLength(3)
    expect(createGame('may-2024').air).toBeLessThan(createGame('quiet-2019').air)
  })
})

describe('power', () => {
  it('cannot run every module at once', () => {
    const state = createGame('sep-2017')
    const everything = planOf(state, [...MODULE_IDS])
    expect(poweredModules(state, everything).length).toBeLessThan(MODULE_IDS.length)
  })

  it('saves unused power in the battery, up to its size', () => {
    const state = createGame('sep-2017')
    const { state: next } = resolveDay(state, CALM, planOf(state, ['comms']))
    expect(next.battery).toBe(RULES.batteryCap)
    expect(powerAvailable(next)).toBe(state.solar + RULES.batteryCap)
  })
})

describe('air and food', () => {
  it('Life Support makes air only when it has power', () => {
    const state = createGame('sep-2017')
    expect(resolveDay(state, CALM, planOf(state, ['life'])).state.air).toBe(state.air + RULES.lifeAir - 3)
    expect(resolveDay(state, CALM, planOf(state, [])).state.air).toBe(state.air - 3)
  })

  it('the Greenhouse grows more when someone tends it, most of all someone who loves plants', () => {
    const state = createGame('sep-2017')
    const lights = resolveDay(state, CALM, planOf(state, ['farm'])).report.food.made
    const withCian = resolveDay(state, CALM, planOf(state, ['farm'], { cian: { kind: 'garden' } })).report.food.made
    const withAoife = resolveDay(state, CALM, planOf(state, ['farm'], { aoife: { kind: 'garden' } })).report.food.made
    expect(lights).toBe(RULES.farmFood)
    expect(withCian).toBe(RULES.farmFood + 2)
    expect(withAoife).toBe(RULES.farmFood + 3)
  })

  it('the numbers on the report add up', () => {
    const state = createGame('sep-2017')
    const { report } = resolveDay(state, CALM, planOf(state, ['farm', 'life'], { aoife: { kind: 'garden' } }))
    expect(report.food.left).toBe(state.food + report.food.made - report.food.eaten)
    expect(report.air.left).toBe(state.air + report.air.made - report.air.used)
  })

  it('when food is short the hungriest eat first, and going hungry hurts in the end', () => {
    let state = createGame('sep-2017')
    state = { ...state, food: 1 }
    crew(state, 'niamh').fed = 1
    const first = resolveDay(state, CALM, planOf(state, ['life']))
    expect(first.report.crew.find((member) => member.id === 'niamh')?.ate).toBe(true)
    expect(crew(first.state, 'aoife').fed).toBe(RULES.fullFed - 1)
    let hungry = first.state
    for (let i = 0; i < 3; i += 1) hungry = resolveDay(hungry, CALM, planOf(hungry, ['life'])).state
    expect(crew(hungry, 'aoife').health).toBeLessThan(RULES.maxStat)
  })

  it('two days without air ends the mission early', () => {
    let state = createGame('sep-2017')
    state = { ...state, air: 0 }
    state = resolveDay(state, CALM, planOf(state, [])).state
    expect(state.status).toBe('playing')
    state = resolveDay(state, CALM, planOf(state, [])).state
    expect(state.status).toBe('evacuated')
  })
})

describe('jobs', () => {
  it('a job in a module without power cannot be done', () => {
    const state = createGame('sep-2017')
    const plan = planOf(state, [], { aoife: { kind: 'garden' } })
    expect(jobProblem(state, plan, 'aoife', { kind: 'garden' })).toMatch(/needs power/)
    const { report } = resolveDay(state, CALM, plan)
    expect(report.food.made).toBe(0)
  })

  it('people do the job they love better', () => {
    const state = createGame('sep-2017')
    expect(workPoints(crew(state, 'niamh'), 'build')).toBe(3)
    expect(workPoints(crew(state, 'aoife'), 'build')).toBe(2)
  })

  it('someone who is a bit low works slowly, and someone very low cannot work', () => {
    const state = createGame('sep-2017')
    crew(state, 'niamh').mood = 2
    expect(workPoints(crew(state, 'niamh'), 'build')).toBe(1)
    crew(state, 'niamh').mood = 1
    expect(jobProblem(state, planOf(state, []), 'niamh', { kind: 'build' })).toMatch(/unhappy/)
    crew(state, 'niamh').health = 1
    const { report } = resolveDay(state, CALM, planOf(state, ['life'], { niamh: { kind: 'build' } }))
    expect(report.crew.find((member) => member.id === 'niamh')?.did).toBe('Sick bay')
  })

  it('rest lifts mood, the sick bay lifts health, and calling home needs the radio', () => {
    const state = createGame('sep-2017')
    for (const astronaut of state.crew) Object.assign(astronaut, { health: 2, mood: 2 })
    // The other two work somewhere else, so friendships do not change the numbers.
    const rested = resolveDay(state, CALM, planOf(state, ['life', 'lab'], { aoife: { kind: 'rest' }, cian: { kind: 'lab' }, niamh: { kind: 'build' } })).state
    expect(crew(rested, 'aoife')).toMatchObject({ health: 3, mood: 4 })
    const treated = resolveDay(state, CALM, planOf(state, ['life', 'lab'], { cian: { kind: 'sickbay' }, aoife: { kind: 'lab' }, niamh: { kind: 'build' } })).state
    expect(crew(treated, 'cian')).toMatchObject({ health: 4, mood: 3 })
    const called = resolveDay(state, CALM, planOf(state, ['life', 'lab', 'comms'], { niamh: { kind: 'call' }, aoife: { kind: 'lab' }, cian: { kind: 'lab' } })).state
    expect(crew(called, 'niamh').mood).toBe(5)
    expect(jobProblem(state, planOf(state, []), 'niamh', { kind: 'call' })).toMatch(/Radio Dish/)
  })

  it('working three days in a row costs mood', () => {
    let state = createGame('sep-2017')
    const plan = (current: GameState) => planOf(current, ['life', 'lab'], { aoife: { kind: 'lab' } })
    for (let i = 0; i < 2; i += 1) state = resolveDay(state, CALM, plan(state)).state
    const before = crew(state, 'aoife').mood
    state = resolveDay(state, CALM, plan(state)).state
    expect(crew(state, 'aoife').mood).toBe(before - 1)
  })

  it('a tired astronaut gets no lift from the job they love, until they take a day off', () => {
    let state = createGame('sep-2017')
    crew(state, 'aoife').mood = 3
    const garden = (current: GameState) => planOf(current, ['life', 'farm'], { aoife: { kind: 'garden' } })
    const moods: number[] = []
    for (let i = 0; i < 4; i += 1) {
      state = resolveDay(state, CALM, garden(state)).state
      moods.push(crew(state, 'aoife').mood)
    }
    // Two happy days, then two tired ones.
    expect(moods).toEqual([4, 5, 4, 3])
    state = resolveDay(state, CALM, planOf(state, ['life', 'farm'])).state
    expect(crew(state, 'aoife').streak).toBe(0)
    state = resolveDay(state, CALM, garden(state)).state
    expect(crew(state, 'aoife').mood).toBe(5)
  })

  it('friends cheer each other up and rivals annoy each other', () => {
    const state = createGame('sep-2017')
    for (const astronaut of state.crew) astronaut.mood = 3
    const friends = resolveDay(state, CALM, planOf(state, ['life', 'lab'], { aoife: { kind: 'lab' }, cian: { kind: 'lab' }, niamh: { kind: 'build' } })).state
    expect(crew(friends, 'cian').mood).toBe(4)
    const rivals = resolveDay(state, CALM, planOf(state, ['life', 'lab'], { cian: { kind: 'lab' }, niamh: { kind: 'lab' }, aoife: { kind: 'build' } })).state
    expect(crew(rivals, 'cian').mood).toBe(2)
  })
})

describe('rover trips', () => {
  it('need the Rover Bay, and there is only one rover', () => {
    const state = createGame('sep-2017')
    expect(jobProblem(state, planOf(state, []), 'cian', { kind: 'trip', trip: 'scout' })).toMatch(/Rover Bay/)
    const both = planOf(state, ['garage'], { aoife: { kind: 'trip', trip: 'scout' }, cian: { kind: 'trip', trip: 'scout' } })
    expect(jobProblem(state, both, 'aoife', both.jobs.aoife)).toBeNull()
    expect(jobProblem(state, both, 'cian', both.jobs.cian)).toMatch(/one rover/)
  })

  it('the three ice trips go in order, and finishing them makes Life Support better', () => {
    let state = createGame('sep-2017')
    expect(availableTrips(state)).toEqual(['scout'])
    state = resolveDay(state, CALM, planOf(state, ['garage', 'life'], { aoife: { kind: 'trip', trip: 'scout' } })).state
    expect(state.missions.ice).toBe(1)
    state = resolveDay(state, CALM, planOf(state, ['garage', 'life'], { aoife: { kind: 'trip', trip: 'drill' } })).state
    expect(crew(state, 'aoife').away).toEqual({ trip: 'drill', daysLeft: 1 })
    expect(availableTrips(state)).toEqual([])
    state = resolveDay(state, CALM, planOf(state, ['life'])).state
    expect(state.missions.ice).toBe(2)
    state = resolveDay(state, CALM, planOf(state, ['garage', 'life'], { aoife: { kind: 'trip', trip: 'haul' } })).state
    const done = resolveDay(state, CALM, planOf(state, ['life']))
    expect(done.report.finished).toEqual(['ice'])
    const after = resolveDay(done.state, CALM, planOf(done.state, ['life']))
    expect(after.report.air.made).toBe(RULES.lifeAirWithIce)
  })

  it('someone who loves fixing things brings back one more solar panel', () => {
    expect(panelsFixed(4, 3)).toBe(3)
    expect(panelsFixed(4, 2)).toBe(2)
    expect(panelsFixed(4, 1)).toBe(1)
    expect(panelsFixed(1, 3)).toBe(1)
  })

  it('someone who loves driving does a two-day trip in one day', () => {
    expect(tripDays('cian', 'scout')).toBe(1)
    expect(tripDays('cian', 'drill')).toBe(1)
    expect(tripDays('aoife', 'drill')).toBe(2)
    let state = createGame('sep-2017')
    state = resolveDay(state, CALM, planOf(state, ['garage', 'life'], { cian: { kind: 'trip', trip: 'scout' } })).state
    state = resolveDay(state, CALM, planOf(state, ['garage', 'life'], { cian: { kind: 'trip', trip: 'drill' } })).state
    expect(crew(state, 'cian').away).toBeNull()
    expect(state.missions.ice).toBe(2)
    const done = resolveDay(state, CALM, planOf(state, ['garage', 'life'], { cian: { kind: 'trip', trip: 'haul' } }))
    expect(done.report.finished).toEqual(['ice'])
    // So on the very last day the quick driver can still set off, and nobody else can.
    const lastDay = { ...createGame('sep-2017'), day: RULES.maxDays, missions: { ice: 1, shield: 0, dish: 0, sun: 0 } }
    expect(jobProblem(lastDay, planOf(lastDay, ['garage']), 'cian', { kind: 'trip', trip: 'drill' })).toBeNull()
    expect(jobProblem(lastDay, planOf(lastDay, ['garage']), 'niamh', { kind: 'trip', trip: 'drill' })).toMatch(/Not enough days/)
  })
})

describe('flares, alerts and storms', () => {
  const stormy = scenarioOf('sep-2017', [{ watchFlare: FLARE, storm: STORM }])
  const severe = scenarioOf('sep-2017', [{ watchFlare: FLARE, storm: SEVERE_STORM }])
  const falseAlarm = scenarioOf('sep-2017', [{ watchFlare: FLARE }])

  it('the alert only arrives when the Radio Dish is on', () => {
    const state = createGame('sep-2017')
    expect(alertFor(state, stormy, planOf(state, []))).toBeNull()
    expect(alertFor(state, stormy, planOf(state, ['comms']))?.cloudKnown).toBe(false)
    expect(alertFor(state, stormy, planOf(state, ['comms', 'scope']))?.cloudKnown).toBe(true)
  })

  it('a storm hurts people outside most and people indoors a little; calling them in saves the difference', () => {
    const state = createGame('sep-2017')
    const plan = planOf(state, ['comms'], { niamh: { kind: 'build' } })
    const carried = resolveDay(state, stormy, plan, 'carry').state
    expect(crew(carried, 'niamh').health).toBe(RULES.maxStat - RULES.stormOutside[0])
    expect(crew(carried, 'aoife').health).toBe(RULES.maxStat) // rest heals the one heart the storm took
    const called = resolveDay(state, stormy, plan, 'inside')
    expect(called.report.crew.find((member) => member.id === 'niamh')?.hurt).toBe(RULES.stormInside[0])
    expect(called.report.call).toBe('saved')
    expect(called.report.heartsSaved).toBe(RULES.stormOutside[0] - RULES.stormInside[0])
  })

  it('under the Moon-soil shield nobody indoors is hurt, even by a severe storm', () => {
    const state = createGame('sep-2017')
    state.missions.shield = MISSIONS.shield.goal
    const plan = planOf(state, ['comms'], { niamh: { kind: 'build' }, aoife: { kind: 'call' } })
    const carried = resolveDay(state, severe, plan, 'carry').report
    expect(carried.crew.find((member) => member.id === 'aoife')?.hurt).toBe(0)
    expect(carried.crew.find((member) => member.id === 'niamh')?.hurt).toBe(RULES.stormOutside[1])
    expect(resolveDay(state, severe, plan, 'inside').report.crew.every((member) => member.hurt === 0)).toBe(true)
  })

  it('the shield is a choice, not a mission: it earns no star and is not needed to hand over', () => {
    const state = createGame('sep-2017')
    expect(rate(state).maxStars).toBe(4)
    state.missions = { ice: MISSIONS.ice.goal, shield: 0, dish: MISSIONS.dish.goal, sun: MISSIONS.sun.goal }
    expect(allMissionsDone(state)).toBe(true)
    expect(rate({ ...state, missions: { ...state.missions, shield: MISSIONS.shield.goal } }).stars).toBe(rate(state).stars)
  })

  it('a severe storm hurts more', () => {
    const state = createGame('sep-2017')
    const plan = planOf(state, ['comms'], { niamh: { kind: 'build' } })
    expect(crew(resolveDay(state, severe, plan, 'carry').state, 'niamh').health).toBe(RULES.maxStat - RULES.stormOutside[1])
  })

  it('with the radio off there is no warning and no choice', () => {
    const state = createGame('sep-2017')
    const { state: next, report } = resolveDay(state, stormy, planOf(state, [], { niamh: { kind: 'build' } }), 'inside')
    expect(report.call).toBe('surprise')
    expect(crew(next, 'niamh').health).toBeLessThan(RULES.maxStat)
  })

  it('taking cover costs work: coming in halves it, and cancels a rover trip', () => {
    const state = createGame('sep-2017')
    const plan = planOf(state, ['comms', 'garage'], { niamh: { kind: 'build' }, cian: { kind: 'trip', trip: 'scout' } })
    const carried = resolveDay(state, falseAlarm, plan, 'carry').state
    const inside = resolveDay(state, falseAlarm, plan, 'inside')
    expect(carried.missions.dish).toBe(3)
    expect(inside.state.missions.dish).toBe(1)
    expect(carried.missions.ice).toBe(1)
    expect(inside.state.missions.ice).toBe(0)
    expect(inside.report.call).toBe('false-alarm')
  })

  it('taking cover always costs work, even for someone who is working slowly', () => {
    const state = createGame('sep-2017')
    crew(state, 'aoife').health = 2
    const plan = planOf(state, ['comms'], { aoife: { kind: 'build' } })
    expect(workPoints(crew(state, 'aoife'), 'build')).toBe(1)
    expect(resolveDay(state, stormy, plan, 'carry').state.missions.dish).toBe(1)
    expect(resolveDay(state, stormy, plan, 'inside').state.missions.dish).toBe(0)
  })

  it('people working indoors are not called in: their work goes on', () => {
    const state = createGame('sep-2017')
    const plan = planOf(state, ['comms', 'lab'], { aoife: { kind: 'lab' } })
    expect(resolveDay(state, stormy, plan, 'inside').state.missions.shield).toBe(resolveDay(state, stormy, plan, 'carry').state.missions.shield)
  })

  it('calling a repairer in costs the repair: a broken module stays broken, and fewer panels are mended', () => {
    const state = createGame('sep-2017')
    state.broken = ['farm']
    const plan = planOf(state, ['comms'], { niamh: { kind: 'repair' } })
    expect(resolveDay(state, stormy, plan, 'carry').state.broken).toEqual([])
    expect(resolveDay(state, stormy, plan, 'inside').state.broken).toEqual(['farm'])
    expect(resolveDay(state, stormy, plan, 'inside').report.crew.find((member) => member.id === 'niamh')?.fixedModule).toBeNull()

    // One worn panel: staying mends it, being called in does not. (The storm itself wears one more.)
    const worn = createGame('sep-2017')
    worn.solarLoss = 1
    const fixing = planOf(worn, ['comms'], { niamh: { kind: 'repair' } })
    const stayed = resolveDay(worn, stormy, fixing, 'carry')
    const called = resolveDay(worn, stormy, fixing, 'inside')
    expect(stayed.report.crew.find((member) => member.id === 'niamh')?.fixedPanels).toBe(1)
    expect(called.report.crew.find((member) => member.id === 'niamh')?.fixedPanels).toBe(0)
    expect(called.state.solarLoss).toBe(stayed.state.solarLoss + 1)
  })

  it('someone who gets too ill on a rover trip drives home with nothing', () => {
    // A severe storm on day 2, with the radio off, catches Aoife on the road.
    const rough = scenarioOf('sep-2017', [{}, { watchFlare: FLARE, storm: SEVERE_STORM }])
    let state = createGame('sep-2017')
    state = resolveDay(state, rough, planOf(state, ['garage', 'life'], { aoife: { kind: 'trip', trip: 'scout' } })).state
    state = resolveDay(state, rough, planOf(state, ['garage', 'life'], { aoife: { kind: 'trip', trip: 'drill' } })).state
    expect(crew(state, 'aoife').health).toBe(RULES.maxStat - RULES.stormOutside[1])
    expect(crew(state, 'aoife').away?.daysLeft).toBe(1)
    const next = resolveDay(state, rough, planOf(state, ['life']))
    expect(crew(next.state, 'aoife').away).toBeNull()
    expect(next.state.missions.ice).toBe(1)
    expect(next.report.crew.find((member) => member.id === 'aoife')?.notes.join(' ')).toMatch(/drove home early/)
  })

  it('the Moon-soil shield makes the inside of the base safer', () => {
    const state = createGame('sep-2017')
    const plain = resolveDay(state, stormy, planOf(state, [], { aoife: { kind: 'lab' } })).report
    state.missions.shield = MISSIONS.shield.goal
    const shielded = resolveDay(state, stormy, planOf(state, [], { aoife: { kind: 'lab' } })).report
    const lost = (report: typeof plain) => report.crew.reduce((sum, member) => sum + Math.max(0, member.healthBefore - member.healthAfter), 0)
    expect(lost(shielded)).toBeLessThan(lost(plain) + 1)
    expect(shielded.notes.join(' ')).not.toMatch(/hurt the plants/)
  })

  it('the planning preview never gives away a storm', () => {
    const state = createGame('sep-2017')
    const plan = planOf(state, ['farm'], { aoife: { kind: 'garden' } })
    expect(calmPreview(state, stormy, plan).storm).toBeNull()
    expect(calmPreview(state, stormy, plan).food.left).toBe(calmPreview(state, CALM, plan).food.left)
  })
})

describe('event cards', () => {
  it('the same seed draws the same events', () => {
    const run = (seed: number) => {
      let state = createGame('sep-2017', seed)
      const seen: string[] = []
      for (let i = 0; i < 5; i += 1) {
        if (state.event) {
          seen.push(state.event.id)
          state = answerEvent(state, 1).state
        }
        state = resolveDay(state, CALM, planOf(state, ['life', 'farm'])).state
      }
      return seen
    }
    expect(run(42)).toEqual(run(42))
  })

  it('every card has two answers, and neither answer breaks the game', () => {
    for (const id of EVENT_IDS) {
      for (const option of [0, 1]) {
        const state = { ...createGame('sep-2017'), event: { id, who: 'aoife' } }
        const { state: next, result } = answerEvent(state, option)
        expect(result.length).toBeGreaterThan(0)
        expect(next.event).toBeNull()
        expect(EVENTS[id].options).toHaveLength(2)
      }
    }
  })

  it('a new astronaut lands the morning after the commander says yes', () => {
    const state = { ...createGame('sep-2017'), event: { id: 'newcrew' as const, who: null } }
    const accepted = answerEvent(state, 0).state
    const next = resolveDay(accepted, CALM, planOf(accepted, ['life'])).state
    expect(next.crew).toHaveLength(4)
  })

  it('cards about a rover trip only turn up while someone is away, and are about that person', () => {
    const home = createGame('sep-2017')
    expect(EVENTS.stuck.when(home)).toBe(false)
    expect(EVENTS.find.when(home)).toBe(false)

    // Over many seeds, a card drawn while Aoife is driving is either about the base or about Aoife's trip.
    let tripCards = 0
    for (let seed = 1; seed <= 60; seed += 1) {
      let state = createGame('sep-2017', seed)
      if (state.event) state = answerEvent(state, 1).state
      state = resolveDay(state, CALM, planOf(state, ['garage', 'life'], { aoife: { kind: 'trip', trip: 'scout' } })).state
      if (state.event) state = answerEvent(state, 1).state
      state = resolveDay(state, CALM, planOf(state, ['garage', 'life'], { aoife: { kind: 'trip', trip: 'drill' } })).state
      if (state.event && EVENTS[state.event.id].aboutTraveller) {
        tripCards += 1
        expect(state.event.who).toBe('aoife')
      }
    }
    expect(tripCards).toBeGreaterThan(5)
  })

  it('a stuck rover costs the driver health or costs a day', () => {
    let state = createGame('sep-2017')
    state = resolveDay(state, CALM, planOf(state, ['garage', 'life'], { aoife: { kind: 'trip', trip: 'scout' } })).state
    state = resolveDay(state, CALM, planOf(state, ['garage', 'life'], { aoife: { kind: 'trip', trip: 'drill' } })).state
    const stuck = { ...state, event: { id: 'stuck' as const, who: 'aoife' } }
    const dug = answerEvent(stuck, 0).state
    expect(crew(dug, 'aoife').health).toBe(crew(state, 'aoife').health - 1)
    expect(crew(dug, 'aoife').away?.daysLeft).toBe(1)
    const longWay = answerEvent(stuck, 1).state
    expect(crew(longWay, 'aoife').health).toBe(crew(state, 'aoife').health)
    expect(crew(longWay, 'aoife').away?.daysLeft).toBe(2)
  })

  it('a find on the road costs a day, and only helps the research once it is carried home', () => {
    const alarm = scenarioOf('sep-2017', [{}, {}, { watchFlare: FLARE }])
    let state = createGame('sep-2017')
    state = resolveDay(state, alarm, planOf(state, ['garage', 'life'], { aoife: { kind: 'trip', trip: 'scout' } })).state
    state = resolveDay(state, alarm, planOf(state, ['garage', 'life'], { aoife: { kind: 'trip', trip: 'drill' } })).state
    const found = answerEvent({ ...state, event: { id: 'find' as const, who: 'aoife' } }, 0).state
    expect(found.missions.shield).toBe(0)
    expect(crew(found, 'aoife').away).toEqual({ trip: 'drill', daysLeft: 2, found: true })

    // Called back by an alert: the trip is lost, and the find with it.
    const recalled = resolveDay(found, alarm, planOf(found, ['comms', 'life']), 'inside').state
    expect(crew(recalled, 'aoife').away).toBeNull()
    expect(recalled.missions.shield).toBe(0)

    // Left to finish: two more days, then the find reaches the Lab.
    let home = resolveDay(found, alarm, planOf(found, ['life'])).state
    expect(home.missions.shield).toBe(0)
    home = resolveDay(home, alarm, planOf(home, ['life'])).state
    expect(home.missions.shield).toBe(2)
    expect(home.missions.ice).toBe(2)

    // The card does not turn up once the shield research is finished.
    expect(EVENTS.find.when({ ...found, missions: { ...found.missions, shield: MISSIONS.shield.goal } })).toBe(false)
  })

  it('the supply pod is a real choice: a little food now, or all of it after a rover trip', () => {
    const state = { ...createGame('sep-2017'), event: { id: 'pod' as const, who: null } }
    const marked = answerEvent(state, 0).state
    expect(marked.pod).toBe(true)
    expect(marked.food).toBe(state.food)
    const drone = answerEvent(state, 1).state
    expect(drone.pod).toBe(false)
    expect(drone.food).toBe(state.food + 2)
  })
})

describe('things the screen promises', () => {
  it('a weak pump shows in the air Life Support will make', () => {
    const state = createGame('sep-2017')
    expect(airPerDay(state)).toBe(RULES.lifeAir)
    const weak = { ...state, weakLifeDays: 3 }
    expect(airPerDay(weak)).toBe(RULES.lifeAir - 2)
    expect(resolveDay(weak, CALM, planOf(weak, ['life'])).report.air.made).toBe(airPerDay(weak))
  })

  it('the cheer for finishing the radio telescope is on the day report', () => {
    const state = createGame('sep-2017')
    state.missions.dish = MISSIONS.dish.goal - 1
    crew(state, 'aoife').mood = 2
    const { state: next, report } = resolveDay(state, CALM, planOf(state, ['life'], { niamh: { kind: 'build' }, aoife: { kind: 'sickbay' } }))
    expect(report.finished).toEqual(['dish'])
    for (const member of report.crew) expect(member.moodAfter).toBe(crew(next, member.id).mood)
  })
})

describe('how a mission ends', () => {
  it('a rover trip that cannot be finished in time cannot start, and nobody may be away at the handover', () => {
    const lastDay = { ...createGame('sep-2017'), day: RULES.maxDays, missions: { ice: 1, shield: 0, dish: 0, sun: 0 } }
    expect(jobProblem(lastDay, planOf(lastDay, ['garage']), 'aoife', { kind: 'trip', trip: 'drill' })).toMatch(/Not enough days/)
    const ready = { ...createGame('sep-2017'), status: 'done' as const }
    expect(handoverReady(ready)).toBe(true)
    const stillOut = structuredClone(ready)
    crew(stillOut, 'aoife').away = { trip: 'drill', daysLeft: 1 }
    expect(handoverReady(stillOut)).toBe(false)
  })

  it('finishing every mission does not end the tour: the commander chooses when to hand over', () => {
    const almost = { ...createGame('sep-2017'), day: 4, missions: { ice: MISSIONS.ice.goal, shield: MISSIONS.shield.goal, dish: MISSIONS.dish.goal, sun: MISSIONS.sun.goal - 1 } }
    expect(handOver(almost)).toBe(almost)
    const next = resolveDay(almost, CALM, planOf(almost, ['life', 'farm', 'scope']), 'carry').state
    expect(allMissionsDone(next)).toBe(true)
    expect(next.status).toBe('playing')
    expect(next.day).toBe(5)
    const over = handOver(next)
    expect(over.status).toBe('done')
    expect(over.history).toHaveLength(1)
    expect(rate(over).missions).toHaveLength(3)
  })

  it('runs for ten days, then counts stars', () => {
    const state = playOut(CALM, (current) => planOf(current, ['life', 'farm'], { aoife: { kind: 'garden' } }))
    expect(state.status).toBe('done')
    expect(state.history).toHaveLength(RULES.maxDays)
    expect(state.day).toBe(RULES.maxDays)
    expect(rate(state).maxStars).toBe(4)
  })

  it('doing nothing at all fails', () => {
    const state = playOut(CALM, (current) => emptyPlan(current))
    expect(state.status).toBe('evacuated')
  })

  it('keeping everyone cosy and doing no missions earns one star at most: there is no free safe option', () => {
    for (const entry of REAL) {
      const state = playOut(entry, (current) => planOf(current, ['life', 'farm', 'comms'], { aoife: { kind: 'garden' } }), 'inside')
      expect(rate(state).stars).toBeLessThanOrEqual(1)
    }
  })
})

describe('the real NASA records the game ships with', () => {
  const days = REAL.flatMap((scenario) => scenario.days)

  it('has three stretches of ten days', () => {
    expect(REAL.map((scenario) => scenario.days.length)).toEqual([10, 10, 10])
  })

  // The alert card tells players this, so it has to be true of the data.
  it('every particle storm came after a big flare that threw off a cloud (a CME)', () => {
    const storms = days.filter((entry) => entry.storm)
    expect(storms.length).toBe(6)
    for (const entry of storms) {
      expect(entry.watchFlare?.cme).toBe(true)
      expect(entry.watchFlare!.time < entry.storm!.time).toBe(true)
    }
  })

  it('no flare without a cloud was followed by a storm, and many flares with a cloud were not either', () => {
    const noCloud = days.filter((entry) => entry.watchFlare && !entry.watchFlare.cme)
    expect(noCloud.length).toBeGreaterThan(0)
    expect(noCloud.every((entry) => !entry.storm)).toBe(true)
    const cloud = days.filter((entry) => entry.watchFlare?.cme)
    expect(cloud.filter((entry) => !entry.storm).length).toBeGreaterThanOrEqual(cloud.length / 2)
  })
})

describe('what the last crew left behind', () => {
  it('changes nothing when no start is given', () => {
    const game = createGame('sep-2017')
    expect(game.start).toBe(null)
    expect([game.air, game.food, game.battery, game.solarLoss]).toEqual([SETUPS['sep-2017'].air, SETUPS['sep-2017'].food, 0, 0])
    expect(game.broken).toEqual([])
  })

  it('gives every start one good thing and one bad thing', () => {
    const plain = createGame('sep-2017')
    for (const id of START_IDS) {
      const game = createGame('sep-2017', 1, id)
      const better =
        Number(game.air > plain.air) + Number(game.food > plain.food) + Number(game.battery > plain.battery) +
        PROJECT_IDS.filter((project) => game.missions[project] > 0).length
      const worse =
        Number(game.air < plain.air) + Number(game.food < plain.food) + Number(game.solarLoss > 0) +
        Number(game.crew[0].mood < plain.crew[0].mood)
      // A repair is outside work: a start must never need one before a module can run.
      expect(game.broken).toEqual([])
      expect([id, better, worse]).toEqual([id, 1, 1])
    }
  })

  it('never finishes a mission before the game begins, and never goes over the store limits', () => {
    for (const scenario of Object.keys(SETUPS)) {
      for (const id of START_IDS) {
        const game = createGame(scenario, 1, id)
        for (const project of PROJECT_IDS) expect(missionDone(game.missions, project)).toBe(false)
        expect(game.air).toBeLessThanOrEqual(RULES.airCap)
        expect(game.food).toBeLessThanOrEqual(RULES.foodCap)
        expect(game.air).toBeGreaterThan(0)
        expect(game.food).toBeGreaterThan(0)
      }
    }
  })

  it('draws the same start for the same seed, and every start for some seed', () => {
    expect(drawStart(42)).toBe(drawStart(42))
    const seen = new Set(Array.from({ length: 200 }, (_, seed) => drawStart(seed + 1)))
    expect(seen.size).toBe(START_IDS.length)
  })
})
