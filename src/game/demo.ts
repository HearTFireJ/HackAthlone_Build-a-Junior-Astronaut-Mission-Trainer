// A prepared game for showing the game to an audience in a few minutes.
//
// Nothing here is hand-made: a scripted commander plays the first days with the same rules
// as a player (resolveDay, answerEvent), from a fixed mission, crew and seed. So the base,
// its history and its field guide are what a real player could have reached.

import { MODULES, type ModuleId, type StartId } from './content.ts'
import {
  RULES,
  type GameState,
  type Job,
  type Plan,
  type Response,
  alertFor,
  answerEvent,
  availableTrips,
  canRun,
  condition,
  createGame,
  emptyPlan,
  jobProblem,
  missionDone,
  powerAvailable,
  resolveDay,
} from './outpost.ts'
import type { Scenario } from './weather.ts'

/** The demo is always the same game: the storm of May 2024, the morning of 11 May. */
export const DEMO = {
  scenarioId: 'may-2024',
  /** The day the audience plays. 11 May 2024 is day 6 of the mission. */
  day: 6,
  seed: 7,
  start: 'started' as StartId,
  crew: ['aoife', 'cian', 'niamh'],
}

/** The scripted commander's orders for one morning: air, food and the Sun first, then the missions. */
export function demoPlan(state: GameState): Plan {
  const plan = emptyPlan(state)
  let left = powerAvailable(state)
  const switchOn = (module: ModuleId) => {
    if (!canRun(state, module) || MODULES[module].power > left) return false
    plan.power[module] = true
    left -= MODULES[module].power
    return true
  }
  for (const module of ['life', 'comms', 'scope', 'farm'] as ModuleId[]) switchOn(module)

  const give = (id: string, job: Job) => {
    if (jobProblem(state, plan, id, job)) return false
    plan.jobs[id] = job
    return true
  }
  const somethingBroken = state.broken.length > 0 || state.solarLoss > 0
  for (const astronaut of state.crew) {
    if (astronaut.away) continue
    const id = astronaut.id
    // Sick people heal, sad or tired people rest: nobody is worked into the ground.
    if (astronaut.health <= 2 && give(id, { kind: 'sickbay' })) continue
    if (condition(astronaut) !== 'well' || astronaut.streak + 1 >= RULES.tiredAfter) continue
    // Every third day is a day off for everyone (days 2, 5 and 8), so nobody gets tired.
    if (state.day % RULES.tiredAfter === 2) continue
    if (id === 'niamh' && !missionDone(state.missions, 'dish') && give(id, { kind: 'build' })) continue
    if (id === 'cian') {
      if (somethingBroken && give(id, { kind: 'repair' })) continue
      // A rover trip, when the Rover Bay can be charged as well as everything else.
      const trip = availableTrips(state)[0]
      if (trip && switchOn('garage') && give(id, { kind: 'trip', trip })) continue
    }
    give(id, { kind: 'garden' })
  }
  return plan
}

/** The scripted commander calls the outside crew in when a cloud of gas is seen leaving the Sun. */
function demoResponse(state: GameState, scenario: Scenario, plan: Plan): Response {
  const alert = alertFor(state, scenario, plan)
  return alert && (!alert.cloudKnown || alert.flare.cme) ? 'inside' : 'carry'
}

/**
 * Plays the demo game up to the morning of the given day and returns it with that day's
 * orders already given. Day 11 or more plays the whole mission to its end.
 */
export function demoGame(scenario: Scenario, day: number = DEMO.day, seed: number = DEMO.seed): { game: GameState; plan: Plan } {
  let game = createGame(scenario.id, seed, DEMO.start, DEMO.crew)
  while (game.status === 'playing') {
    // The first answer on every event card: the scripted commander does not stop to think.
    if (game.event) game = answerEvent(game, 0).state
    if (game.day >= day) break
    const plan = demoPlan(game)
    game = resolveDay(game, scenario, plan, demoResponse(game, scenario, plan)).state
  }
  return { game, plan: demoPlan(game) }
}
