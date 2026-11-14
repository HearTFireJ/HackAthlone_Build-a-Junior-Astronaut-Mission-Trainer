import { describe, expect, it } from 'vitest'
import {
  CREW_SIZE,
  type DayPlan,
  type GameState,
  JOBS,
  MISSION_DAYS,
  RULES,
  createGame,
  daysUntilSupplyShip,
  emptyPlan,
  resolveDay,
  starsFor,
} from './mission.ts'
import { SHELTER, jobs, makeScenario } from './testing.ts'

/** Plays the same kind of plan every day until the mission ends. */
function playOut(start: GameState, choose: (state: GameState) => DayPlan): GameState {
  let state = start
  while (state.status === 'playing') state = resolveDay(state, choose(state)).state
  return state
}

describe('mission setup', () => {
  it('has fewer astronauts than jobs that produce something', () => {
    const productiveJobs = JOBS.filter((job) => job !== 'rest')
    // This is the core trade-off: every day at least one job goes undone.
    expect(CREW_SIZE).toBeLessThan(productiveJobs.length)
  })

  it('starts on day 1 with full supplies and a healthy crew', () => {
    const state = createGame(makeScenario())
    expect(state.day).toBe(1)
    expect(state.status).toBe('playing')
    expect(state.resources).toEqual({ power: 8, oxygen: 8, food: 8 })
    expect(state.crew).toHaveLength(CREW_SIZE)
    expect(state.crew.every((astronaut) => astronaut.health === RULES.fullHealth)).toBe(true)
  })

  it('counts down to the supply ship', () => {
    expect(daysUntilSupplyShip(1)).toBe(MISSION_DAYS - 1)
    expect(daysUntilSupplyShip(MISSION_DAYS)).toBe(0)
    expect(daysUntilSupplyShip(MISSION_DAYS + 3)).toBe(0)
  })
})

describe('one calm day', () => {
  it('adds what the crew makes and takes away what the base uses', () => {
    const start = createGame(makeScenario())
    const { state, report } = resolveDay(start, jobs(start, 'solar', 'oxygen', 'farm'))
    // 8 + 3 made - 2 used = 9 for each resource.
    expect(state.resources).toEqual({ power: 9, oxygen: 9, food: 9 })
    expect(report.produced).toEqual({ power: 3, oxygen: 3, food: 3 })
    expect(state.day).toBe(2)
  })

  it('never stores more than the storage limit', () => {
    const start = createGame(makeScenario())
    const { state } = resolveDay(start, jobs(start, 'solar', 'solar', 'solar'))
    expect(state.resources.power).toBe(RULES.storageLimit)
  })

  it('science earns points but costs extra oxygen', () => {
    const start = createGame(makeScenario())
    const { state, report } = resolveDay(start, jobs(start, 'science', 'science', 'rest'))
    expect(state.science).toBe(2)
    expect(report.scienceGained).toBe(2)
    // 8 - 2 daily use - 2 for the two space suits = 4.
    expect(state.resources.oxygen).toBe(4)
  })

  it('does not change the state it was given', () => {
    const start = createGame(makeScenario())
    const before = JSON.stringify(start)
    resolveDay(start, jobs(start, 'solar', 'science', 'rest'))
    expect(JSON.stringify(start)).toBe(before)
  })
})

describe('power runs the machines', () => {
  it('switches the oxygen machine and greenhouse off when there is no power', () => {
    const start: GameState = { ...createGame(makeScenario()), resources: { power: 0, oxygen: 8, food: 8 } }
    const { state, report } = resolveDay(start, jobs(start, 'oxygen', 'farm', 'rest'))
    expect(report.machinesOff).toBe(true)
    expect(report.produced).toEqual({ power: 0, oxygen: 0, food: 0 })
    expect(state.resources.oxygen).toBe(6)
    expect(state.resources.food).toBe(6)
  })
})

describe('the storm shelter', () => {
  it('keeps everyone safe in a severe storm', () => {
    const start = createGame(makeScenario([2]))
    const { state, report } = resolveDay(start, SHELTER)
    expect(report.storm).toBe(2)
    expect(state.crew.every((astronaut) => astronaut.health === RULES.fullHealth)).toBe(true)
  })

  it('costs a whole day of work while supplies keep going down', () => {
    const start = createGame(makeScenario())
    const { state, report } = resolveDay(start, SHELTER)
    expect(report.produced).toEqual({ power: 0, oxygen: 0, food: 0 })
    expect(state.science).toBe(0)
    expect(state.resources).toEqual({ power: 6, oxygen: 6, food: 6 })
  })
})

describe('solar storms', () => {
  it('hurt people outside more than people inside', () => {
    const start = createGame(makeScenario([1]))
    const { state } = resolveDay(start, jobs(start, 'science', 'farm', 'solar'))
    const [outside, inside] = state.crew
    expect(outside.health).toBe(RULES.fullHealth - RULES.stormDamageOutside[0])
    expect(inside.health).toBe(RULES.fullHealth - RULES.stormDamageInside[0])
    expect(outside.health).toBeLessThan(inside.health)
  })

  it('hurt more when the storm is severe', () => {
    const start = createGame(makeScenario([2]))
    const { state } = resolveDay(start, jobs(start, 'science', 'farm', 'solar'))
    expect(state.crew[0].health).toBe(RULES.fullHealth - RULES.stormDamageOutside[1])
    expect(state.crew[1].health).toBe(RULES.fullHealth - RULES.stormDamageInside[1])
  })

  it('do nothing on a calm day', () => {
    const start = createGame(makeScenario())
    const { state, report } = resolveDay(start, jobs(start, 'science', 'farm', 'solar'))
    expect(report.storm).toBe(0)
    expect(state.crew.every((astronaut) => astronaut.health === RULES.fullHealth)).toBe(true)
  })
})

describe('running out', () => {
  it('makes everyone weaker when the oxygen runs out', () => {
    const start: GameState = { ...createGame(makeScenario()), resources: { power: 8, oxygen: 1, food: 8 } }
    const { state, report } = resolveDay(start, jobs(start, 'solar', 'farm', 'farm'))
    expect(report.ranOutOf).toEqual(['oxygen'])
    expect(state.resources.oxygen).toBe(0)
    expect(state.crew.every((astronaut) => astronaut.health === RULES.fullHealth - 1)).toBe(true)
  })

  it('does not let anyone recover on a day without air or food', () => {
    const base = createGame(makeScenario())
    const start: GameState = {
      ...base,
      resources: { power: 8, oxygen: 8, food: 0 },
      crew: base.crew.map((astronaut) => ({ ...astronaut, health: 2 })),
    }
    const { state } = resolveDay(start, emptyPlan(start))
    // Hungry: lose 1, and resting does not give it back.
    expect(state.crew.every((astronaut) => astronaut.health === 1)).toBe(true)
  })
})

describe('health', () => {
  it('comes back with rest', () => {
    const base = createGame(makeScenario())
    const start: GameState = { ...base, crew: base.crew.map((astronaut) => ({ ...astronaut, health: 1 })) }
    const { state } = resolveDay(start, jobs(start, 'rest', 'solar', 'solar'))
    expect(state.crew[0].health).toBe(2)
    expect(state.crew[1].health).toBe(1)
  })

  it('never goes above full', () => {
    const start = createGame(makeScenario())
    const { state } = resolveDay(start, emptyPlan(start))
    expect(state.crew.every((astronaut) => astronaut.health === RULES.fullHealth)).toBe(true)
  })

  it('a sick astronaut rests whatever job was picked', () => {
    const base = createGame(makeScenario())
    const start: GameState = {
      ...base,
      crew: base.crew.map((astronaut, index) => ({ ...astronaut, health: index === 0 ? 0 : 3 })),
    }
    const { state, report } = resolveDay(start, jobs(start, 'science', 'solar', 'oxygen'))
    expect(report.crew[0].tooSickToWork).toBe(true)
    expect(report.crew[0].did).toBe('rest')
    expect(state.science).toBe(0)
    expect(state.crew[0].health).toBe(1)
  })
})

describe('how a mission ends', () => {
  it('is won when the crew lasts until the supply ship', () => {
    const end = playOut(createGame(makeScenario()), (state) => jobs(state, 'solar', 'oxygen', 'farm'))
    expect(end.status).toBe('won')
    expect(end.day).toBe(MISSION_DAYS)
    expect(end.history).toHaveLength(MISSION_DAYS)
    expect(starsFor(end)).toBe(1)
  })

  it('gives more stars for more science', () => {
    const won = playOut(createGame(makeScenario()), (state) => jobs(state, 'solar', 'oxygen', 'farm'))
    const [twoStars, threeStars] = RULES.starThresholds
    expect(starsFor({ ...won, science: twoStars - 1 })).toBe(1)
    expect(starsFor({ ...won, science: twoStars })).toBe(2)
    expect(starsFor({ ...won, science: threeStars })).toBe(3)
  })

  it('ends with an evacuation when everyone is too sick, and gives no stars', () => {
    const base = createGame(makeScenario([2]))
    const start: GameState = { ...base, crew: base.crew.map((astronaut) => ({ ...astronaut, health: 1 })) }
    const { state } = resolveDay(start, jobs(start, 'science', 'science', 'science'))
    expect(state.status).toBe('evacuated')
    expect(starsFor(state)).toBe(0)
  })

  it('refuses to play after the mission is over', () => {
    const end = playOut(createGame(makeScenario()), (state) => jobs(state, 'solar', 'oxygen', 'farm'))
    expect(() => resolveDay(end, SHELTER)).toThrow()
  })
})

describe('no free, safe choice', () => {
  // The challenge asks that no option is free. These lazy plans must all fail,
  // even when the Sun is completely calm.
  const calm = () => createGame(makeScenario())

  it('hiding in the shelter every day fails', () => {
    expect(playOut(calm(), () => SHELTER).status).toBe('evacuated')
  })

  it('resting every day fails', () => {
    expect(playOut(calm(), (state) => emptyPlan(state)).status).toBe('evacuated')
  })

  it('doing only science fails', () => {
    expect(playOut(calm(), (state) => jobs(state, 'science', 'science', 'science')).status).toBe('evacuated')
  })

  it('never using the shelter fails when storms keep coming', () => {
    const stormy = createGame(makeScenario([1, 1, 1, 2, 1, 1]))
    expect(playOut(stormy, (state) => jobs(state, 'solar', 'oxygen', 'farm')).status).toBe('evacuated')
  })
})

describe('fixes from code review', () => {
  it('a weak astronaut resting in the base is still hurt by a severe storm', () => {
    const base = createGame(makeScenario([2]))
    const start: GameState = { ...base, crew: base.crew.map((astronaut) => ({ ...astronaut, health: 1 })) }
    const { state, report } = resolveDay(start, emptyPlan(start))
    // 1 health, -2 from the storm, +1 from rest: still 0. Rest must not cancel the storm.
    expect(state.crew.every((astronaut) => astronaut.health === 0)).toBe(true)
    expect(report.crew.every((astronaut) => astronaut.healed === 0)).toBe(true)
    expect(state.status).toBe('evacuated')
  })

  it('a sick astronaut does not recover in the base during a storm', () => {
    const base = createGame(makeScenario([1]))
    const start: GameState = {
      ...base,
      crew: base.crew.map((astronaut, index) => ({ ...astronaut, health: index === 0 ? 0 : 4 })),
    }
    const { state } = resolveDay(start, jobs(start, 'rest', 'solar', 'oxygen'))
    // 0 health, -1 from the storm, +1 from rest: 0.
    expect(state.crew[0].health).toBe(0)
  })

  it('rest and storm damage add up for a healthy astronaut', () => {
    const start = createGame(makeScenario([1]))
    const { state, report } = resolveDay(start, jobs(start, 'rest', 'solar', 'oxygen'))
    // 4 health, -1 from the storm, +1 from rest: back to 4.
    expect(state.crew[0].health).toBe(RULES.fullHealth)
    expect(report.crew[0].stormDamage).toBe(1)
    expect(report.crew[0].healed).toBe(1)
  })

  it('nobody can explore outside when the oxygen tank is empty', () => {
    const start: GameState = { ...createGame(makeScenario()), resources: { power: 8, oxygen: 0, food: 8 } }
    const { state, report } = resolveDay(start, jobs(start, 'science', 'science', 'oxygen'))
    expect(state.science).toBe(0)
    expect(report.scienceGained).toBe(0)
    expect(report.crew[0].noSuitOxygen).toBe(true)
    expect(report.crew[0].did).toBe('rest')
  })

  it('only as many astronauts go outside as there are full space suits', () => {
    const start: GameState = { ...createGame(makeScenario()), resources: { power: 8, oxygen: 2, food: 8 } }
    const { state, report } = resolveDay(start, jobs(start, 'science', 'science', 'science'))
    expect(state.science).toBe(2)
    expect(report.crew.map((astronaut) => astronaut.noSuitOxygen)).toEqual([false, false, true])
  })

  it('a sick astronaut recovers in the shelter, just as when resting in the base', () => {
    const base = createGame(makeScenario([2]))
    const start: GameState = {
      ...base,
      crew: base.crew.map((astronaut, index) => ({ ...astronaut, health: index === 0 ? 0 : 3 })),
    }
    const { state, report } = resolveDay(start, SHELTER)
    expect(state.crew.map((astronaut) => astronaut.health)).toEqual([1, 4, 4])
    expect(report.crew[0].healed).toBe(1)
  })

  it('the shelter does not heal on a day without enough air or food', () => {
    const base = createGame(makeScenario())
    const start: GameState = {
      ...base,
      resources: { power: 8, oxygen: 1, food: 8 },
      crew: base.crew.map((astronaut) => ({ ...astronaut, health: 2 })),
    }
    const { state } = resolveDay(start, SHELTER)
    expect(state.crew.every((astronaut) => astronaut.health === 1)).toBe(true)
  })
})
