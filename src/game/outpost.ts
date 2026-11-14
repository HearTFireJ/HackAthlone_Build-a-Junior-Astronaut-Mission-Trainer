// The rules of the game. No React in here, and no hidden randomness: the same state,
// plan and choices always give the same result, so every rule can be tested.
//
// One day goes like this:
//   1. Morning: maybe an event card. The commander picks one of two answers.
//   2. Plan: which modules get power, and what each astronaut does.
//   3. If the radio is on and the Sun fired a big flare (real NASA record), an alert
//      arrives and the commander chooses: carry on, or call the people outside in.
//   4. resolveDay works out everything that happened and sets up tomorrow.

import {
  CLASHES,
  CREW,
  FRIENDS,
  ICE_TRIPS,
  JOBS,
  MISSIONS,
  MISSION_IDS,
  PROJECT_IDS,
  MODULES,
  MODULE_IDS,
  SETUPS,
  STARTS,
  START_IDS,
  TRIPS,
  crewInfo,
  type JobId,
  type MissionId,
  type ProjectId,
  type ModuleId,
  type StartId,
  type TripId,
} from './content.ts'
import { EVENTS, EVENT_IDS, type EventId } from './events.ts'
import { type Scenario, type StormRecord, type WatchFlare, weatherOn } from './weather.ts'

// Every number in this block is a game setting, not a real measurement.
export const RULES = {
  maxDays: 10,
  /** Health and mood go from 0 to this. */
  maxStat: 5,
  /** "Fed" goes from 0 to this. One missed meal takes one away. */
  fullFed: 3,
  /** Power left over at night is saved, up to this much. */
  batteryCap: 3,
  airCap: 16,
  foodCap: 16,
  lifeAir: 5,
  lifeAirWithIce: 7,
  iceBonusAir: 4,
  farmFood: 2,
  podFood: 6,
  podAir: 3,
  /** Hearts lost in a storm: [normal storm, severe storm]. */
  stormOutside: [3, 4],
  /** Indoors without the Moon-soil shield. With the shield, nobody indoors is hurt at all. */
  stormInside: [1, 2],
  /** Food lost from the Greenhouse on a storm day without the shield. */
  stormCropLoss: 2,
  noAirDamage: 2,
  /** Working this many days in a row costs mood. */
  tiredAfter: 3,
  /** Chance of an event card each morning. */
  eventChance: 0.75,
  /** What "ready for the next crew" means at the end. */
  handover: { air: 6, food: 6, stat: 3 },
} as const

export interface Astronaut {
  id: string
  health: number
  mood: number
  fed: number
  /** Days worked in a row without a break. */
  streak: number
  /** Set while the astronaut is far from the base on a rover trip. "found" means they are carrying a find home. */
  away: { trip: TripId; daysLeft: number; found?: boolean } | null
}

export type Missions = Record<ProjectId, number>

export interface PendingEvent {
  id: EventId
  /** The astronaut the event is about, if any. */
  who: string | null
}

export interface RecordedFlare extends WatchFlare {
  date: string
}

export interface GameState {
  scenarioId: string
  /** What the last crew left behind, drawn when the game started. null: nothing special. */
  start: StartId | null
  day: number
  status: 'playing' | 'done' | 'evacuated'
  /** Power the solar panels make when nothing is wrong with them. */
  solar: number
  /** Power lost to worn or dusty panels, until someone repairs them. */
  solarLoss: number
  /** Power lost today only (set by events). */
  powerPenalty: number
  battery: number
  air: number
  food: number
  /** Modules that stay off until someone does a repair job. */
  broken: ModuleId[]
  /** Modules that cannot run today (set by events). */
  offToday: ModuleId[]
  /** Days left on which Life Support makes less air (set by an event). */
  weakLifeDays: number
  crew: Astronaut[]
  /** An astronaut who lands tomorrow morning. */
  arriving: string | null
  missions: Missions
  /** Whether the radio was on yesterday: that decides if a Sun report arrives this morning. */
  radioYesterday: boolean
  /** Days in a row that the air ran out. */
  airOutDays: number
  /** A supply pod is waiting far away. */
  pod: boolean
  /** Real flares the Sun Telescope has recorded. */
  flares: RecordedFlare[]
  event: PendingEvent | null
  eventsSeen: EventId[]
  /** State of the dice. Events are drawn from it, so a seed replays the same events. */
  seed: number
  history: DayReport[]
}

export interface Job {
  kind: JobId
  trip?: TripId
}

export interface Plan {
  power: Record<ModuleId, boolean>
  jobs: Record<string, Job>
}

/** How the commander answers a flare alert. */
export type Response = 'carry' | 'inside'

export interface CrewReport {
  id: string
  /** What they ended up doing, as words for the screen. */
  did: string
  where: 'inside' | 'outside'
  healthBefore: number
  healthAfter: number
  moodBefore: number
  moodAfter: number
  ate: boolean
  notes: string[]
  // The fields below are for the moving picture of the day. They add nothing to the rules.
  /** The job they really did (a job that was not possible turns into rest). */
  job: JobId | 'trip-away'
  trip: TripId | null
  /** How much work counted today. */
  points: number
  /** Called back from a rover trip by the commander. */
  recalled: boolean
  /** Health lost to today's storm. */
  hurt: number
  /** Came home from a rover trip today with what they went for. */
  cameHome: boolean
  /** Was away this morning, and had to give up the trip and drive home. */
  gaveUp: boolean
  /** What a day of repairs really mended: a broken module, or some worn solar panels. */
  fixedModule: ModuleId | null
  fixedPanels: number
  /** Short reasons for today's change of mood, for the picture to show over their head. */
  why: Why[]
  /** Who they were happy to be beside today, and who got on their nerves. */
  friend: string | null
  rival: string | null
}

export type Why = 'loves' | 'tired' | 'friend' | 'rival' | 'hungry' | 'called' | 'cheer'

export type CallResult = 'saved' | 'hit' | 'false-alarm' | 'calm' | 'surprise' | null

export interface DayReport {
  day: number
  date: string
  storm: StormRecord | null
  flare: WatchFlare | null
  alertShown: boolean
  response: Response
  call: CallResult
  /** Hearts the crew would have lost if they had carried on (only when call is 'saved'). */
  heartsSaved: number
  power: { available: number; used: number; saved: number }
  air: { made: number; used: number; left: number }
  food: { made: number; eaten: number; left: number }
  crew: CrewReport[]
  notes: string[]
  finished: ProjectId[]
  /** Food the plants did not make today because a storm hurt them. */
  cropLoss: number
  /** Mission progress at the start and at the end of the day, to show what the day's work added. */
  missions: { before: Missions; after: Missions }
}

// ---------------------------------------------------------------- small helpers

const clamp = (value: number, max: number) => Math.min(max, Math.max(0, value))

/** One roll of the dice: a number from 0 up to 1, and the next seed. */
function roll(seed: number): [number, number] {
  const next = (seed + 0x6d2b79f5) | 0
  let r = Math.imul(next ^ (next >>> 15), 1 | next)
  r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
  return [((r ^ (r >>> 14)) >>> 0) / 4294967296, next]
}

export function missionDone(missions: Missions, id: ProjectId): boolean {
  return missions[id] >= MISSIONS[id].goal
}

export type Condition = 'well' | 'struggling' | 'unable'

/** Sick or miserable people cannot work. People who are a bit low work slowly. */
export function condition(astronaut: Astronaut): Condition {
  const lowest = Math.min(astronaut.health, astronaut.mood)
  if (lowest <= 1) return 'unable'
  if (lowest === 2) return 'struggling'
  return 'well'
}

/** How much a day of work gets done: 3 for a job you love, 2 normally, 1 when struggling. */
export function workPoints(astronaut: Astronaut, job: JobId): number {
  if (!JOBS[job].work) return 0
  if (condition(astronaut) === 'struggling') return 1
  return crewInfo(astronaut.id).loves.includes(job) ? 3 : 2
}

/**
 * How many days a rover trip takes this astronaut. Someone who loves driving is quick:
 * a two-day trip takes them one day. (A made-up rule of the game.)
 */
export function tripDays(astronautId: string, trip: TripId): number {
  const days = TRIPS[trip].days
  return crewInfo(astronautId).loves.includes('trip') ? Math.max(1, days - 1) : days
}

/**
 * How many worn-out solar panels a day of repair brings back: two, three for someone
 * who loves fixing things, and only one for someone who is not feeling well.
 */
export function panelsFixed(solarLoss: number, points: number): number {
  return Math.min(solarLoss, points >= 3 ? 3 : points >= 2 ? 2 : 1)
}

export function solarToday(state: GameState): number {
  return Math.max(0, state.solar - state.solarLoss - state.powerPenalty)
}

/** Power the commander can hand out today: what the panels make plus the battery. */
export function powerAvailable(state: GameState): number {
  return solarToday(state) + state.battery
}

/** Air that Life Support makes on a day it has power. */
export function airPerDay(state: GameState): number {
  const normal = missionDone(state.missions, 'ice') ? RULES.lifeAirWithIce : RULES.lifeAir
  return state.weakLifeDays > 0 ? normal - 2 : normal
}

export function canRun(state: GameState, module: ModuleId): boolean {
  return !state.broken.includes(module) && !state.offToday.includes(module)
}

/** The modules that really run: switched on, not broken, and within the power budget. */
export function poweredModules(state: GameState, plan: Plan): ModuleId[] {
  let left = powerAvailable(state)
  const on: ModuleId[] = []
  for (const module of MODULE_IDS) {
    if (!plan.power[module] || !canRun(state, module)) continue
    if (MODULES[module].power > left) continue
    left -= MODULES[module].power
    on.push(module)
  }
  return on
}

export function powerUsed(state: GameState, plan: Plan): number {
  return poweredModules(state, plan).reduce((sum, module) => sum + MODULES[module].power, 0)
}

/** Rover trips on offer today. There is one rover, so nothing while someone is away. */
export function availableTrips(state: GameState): TripId[] {
  if (state.crew.some((astronaut) => astronaut.away)) return []
  const trips: TripId[] = []
  if (!missionDone(state.missions, 'ice')) trips.push(ICE_TRIPS[state.missions.ice])
  if (state.pod) trips.push('pod')
  return trips
}

/** Why this astronaut cannot do this job today, or null if they can. */
export function jobProblem(state: GameState, plan: Plan, astronautId: string, job: Job): string | null {
  const astronaut = state.crew.find((member) => member.id === astronautId)
  if (!astronaut) return 'Not on the crew.'
  if (astronaut.away) return 'Away on a rover trip.'
  const info = JOBS[job.kind]
  if (info.work && condition(astronaut) === 'unable') {
    return astronaut.health <= 1 ? 'Too sick to work.' : 'Too unhappy to work.'
  }
  if (info.needs && !poweredModules(state, plan).includes(info.needs)) {
    return `The ${MODULES[info.needs].name} needs power.`
  }
  if (job.kind === 'lab' && missionDone(state.missions, 'shield')) return 'The research is finished.'
  if (job.kind === 'build' && missionDone(state.missions, 'dish')) return 'The telescope is finished.'
  if (job.kind === 'repair' && state.broken.length === 0 && state.solarLoss === 0) return 'Nothing needs fixing.'
  if (job.kind === 'trip') {
    if (condition(astronaut) !== 'well') return 'Not well enough to drive.'
    if (!job.trip || !availableTrips(state).includes(job.trip)) return 'That trip is not possible today.'
    if (tripDays(astronautId, job.trip) > RULES.maxDays - state.day + 1) return 'Not enough days left for this trip.'
    // One rover: if two people are given a trip, the first one on the crew list gets it.
    const order = state.crew.map((member) => member.id)
    const earlier = order.slice(0, order.indexOf(astronautId))
    if (earlier.some((id) => plan.jobs[id]?.kind === 'trip')) return 'There is only one rover.'
  }
  return null
}

/** A safe starting plan: essentials on if there is power, everyone resting. */
export function emptyPlan(state: GameState): Plan {
  const power = Object.fromEntries(MODULE_IDS.map((module) => [module, false])) as Record<ModuleId, boolean>
  const jobs: Record<string, Job> = {}
  for (const astronaut of state.crew) if (!astronaut.away) jobs[astronaut.id] = { kind: 'rest' }
  return { power, jobs }
}

export interface Alert {
  flare: WatchFlare
  /** Whether the commander is told if a cloud (CME) left the Sun with the flare. */
  cloudKnown: boolean
}

/** The alert that arrives today, if the radio is on and the Sun fired a big flare. */
export function alertFor(state: GameState, scenario: Scenario, plan: Plan): Alert | null {
  const flare = weatherOn(scenario, state.day).watchFlare
  const on = poweredModules(state, plan)
  if (!flare || !on.includes('comms')) return null
  return { flare, cloudKnown: on.includes('scope') || missionDone(state.missions, 'sun') }
}

// ---------------------------------------------------------------- starting a game

/**
 * Which starting condition a new game gets. It comes from the game's seed, so the same seed
 * always gives the same start. The seed is stirred first so that this draw does not line up
 * with the first event card, which is drawn from the same seed.
 */
export function drawStart(seed: number): StartId {
  const [pick] = roll(seed ^ 0x5bd1e995)
  return START_IDS[Math.floor(pick * START_IDS.length)]
}

/** How many astronauts this mission takes. */
export function crewSeats(scenarioId: string): number {
  return SETUPS[scenarioId]?.crew.length ?? 0
}

/** A crew is right when every seat is filled, by different people the game knows. */
export function validCrew(scenarioId: string, crew: string[]): boolean {
  return (
    crew.length === crewSeats(scenarioId) &&
    new Set(crew).size === crew.length &&
    crew.every((id) => CREW.some((member) => member.id === id))
  )
}

export function createGame(scenarioId: string, seed = 1, start: StartId | null = null, crew?: string[]): GameState {
  const setup = SETUPS[scenarioId]
  if (!setup) throw new Error(`No setup for scenario: ${scenarioId}`)
  const team = crew ?? setup.crew
  if (!validCrew(scenarioId, team)) throw new Error(`Not a crew for ${scenarioId}: ${team.join(', ')}`)
  const left = start ? STARTS[start] : null
  return {
    scenarioId,
    start,
    day: 1,
    status: 'playing',
    solar: setup.solar,
    solarLoss: left?.solarLoss ?? 0,
    powerPenalty: 0,
    battery: Math.min(RULES.batteryCap, left?.battery ?? 0),
    air: clamp(setup.air + (left?.air ?? 0), RULES.airCap),
    food: clamp(setup.food + (left?.food ?? 0), RULES.foodCap),
    broken: [],
    offToday: [],
    weakLifeDays: 0,
    crew: team.map((id) => {
      const astronaut = newAstronaut(id)
      return { ...astronaut, mood: clamp(astronaut.mood + (left?.mood ?? 0), RULES.maxStat) }
    }),
    arriving: null,
    missions: { ice: 0, shield: 0, dish: 0, sun: 0, ...left?.progress },
    radioYesterday: true,
    airOutDays: 0,
    pod: false,
    flares: [],
    event: null,
    eventsSeen: [],
    seed,
    history: [],
  }
}

function newAstronaut(id: string): Astronaut {
  return { id, health: RULES.maxStat, mood: 4, fed: RULES.fullFed, streak: 0, away: null }
}

// ---------------------------------------------------------------- events

/** Applies the commander's answer to this morning's event card. */
export function answerEvent(state: GameState, option: number): { state: GameState; result: string } {
  if (!state.event) return { state, result: '' }
  const next = structuredClone(state)
  const pending = state.event
  const choice = EVENTS[pending.id].options[option]
  choice.apply(next, pending.who)
  for (const astronaut of next.crew) {
    astronaut.health = clamp(astronaut.health, RULES.maxStat)
    astronaut.mood = clamp(astronaut.mood, RULES.maxStat)
  }
  next.food = clamp(next.food, RULES.foodCap)
  next.air = clamp(next.air, RULES.airCap)
  next.event = null
  return { state: next, result: choice.result(next, pending.who) }
}

/** Draws tomorrow morning's event card, if there is one. */
function drawEvent(state: GameState): void {
  state.event = null
  if (state.day > RULES.maxDays) return
  const [chance, seedAfterChance] = roll(state.seed)
  state.seed = seedAfterChance
  if (chance > RULES.eventChance) return
  const atBase = state.crew.filter((astronaut) => !astronaut.away)
  const possible = EVENT_IDS.filter((id) => !state.eventsSeen.includes(id) && EVENTS[id].when(state))
  if (possible.length === 0 || atBase.length === 0) return
  // A card about one person at the base needs at least one person at the base, checked above.
  const [pickEvent, seedAfterEvent] = roll(state.seed)
  const [pickWho, seedAfterWho] = roll(seedAfterEvent)
  state.seed = seedAfterWho
  // While someone is out with the rover, half of the cards are about their trip.
  const [pickKind, seedAfterKind] = roll(state.seed)
  state.seed = seedAfterKind
  const onTheRoad = possible.filter((id) => EVENTS[id].aboutTraveller)
  const atHome = possible.filter((id) => !EVENTS[id].aboutTraveller)
  const pool = onTheRoad.length > 0 && (pickKind < 0.5 || atHome.length === 0) ? onTheRoad : atHome
  if (pool.length === 0) return
  const id = pool[Math.floor(pickEvent * pool.length)]
  const away = state.crew.find((astronaut) => astronaut.away)
  const who = EVENTS[id].aboutTraveller
    ? (away?.id ?? null)
    : EVENTS[id].aboutSomeone
      ? atBase[Math.floor(pickWho * atBase.length)].id
      : null
  state.event = { id, who }
  state.eventsSeen.push(id)
}

// ---------------------------------------------------------------- one day

interface Doing {
  astronaut: Astronaut
  job: JobId | 'trip-away'
  trip: TripId | null
  where: 'inside' | 'outside'
  points: number
  notes: string[]
  /** Came back early because of the alert. */
  recalled: boolean
  /** Hearts this person would lose to today's storm if the commander had carried on. */
  riskIfCarriedOn: number
  cameHome: boolean
  gaveUp: boolean
  /** The work they would have done, if the commander called them in before it was finished. */
  stoppedFrom: number | null
  fixedModule: ModuleId | null
  fixedPanels: number
}

export function resolveDay(
  state: GameState,
  scenario: Scenario,
  plan: Plan,
  response: Response = 'carry',
): { state: GameState; report: DayReport } {
  const next = structuredClone(state)
  const weather = weatherOn(scenario, state.day)
  const storm = weather.storm
  const hasShield = missionDone(state.missions, 'shield')
  const notes: string[] = []

  // Power. Whatever is not used goes into the battery.
  const available = powerAvailable(state)
  const on = poweredModules(state, plan)
  const used = on.reduce((sum, module) => sum + MODULES[module].power, 0)
  next.battery = Math.min(RULES.batteryCap, available - used)

  // The alert only reaches the base when the radio is on.
  const alert = alertFor(state, scenario, plan)
  const answer: Response = alert ? response : 'carry'

  // What everyone does today.
  const doing: Doing[] = next.crew.map((astronaut) => {
    const entry: Doing = {
      astronaut,
      job: 'rest',
      trip: null,
      where: 'inside',
      points: 0,
      notes: [],
      recalled: false,
      riskIfCarriedOn: 0,
      cameHome: false,
      gaveUp: false,
      stoppedFrom: null,
      fixedModule: null,
      fixedPanels: 0,
    }
    if (astronaut.away) {
      if (condition(astronaut) === 'unable') {
        astronaut.away = null
        entry.job = astronaut.health <= 1 ? 'sickbay' : 'rest'
        entry.notes.push('Too poorly to carry on: drove home early. The trip has to start again.')
        entry.gaveUp = true
        return entry
      }
      entry.job = 'trip-away'
      entry.trip = astronaut.away.trip
      entry.where = 'outside'
      return entry
    }
    let wanted: Job = plan.jobs[astronaut.id] ?? { kind: 'rest' }
    const problem = jobProblem(state, plan, astronaut.id, wanted)
    if (problem) {
      if (wanted.kind !== 'rest' && wanted.kind !== 'sickbay') entry.notes.push(`Could not ${JOBS[wanted.kind].name.toLowerCase()}: ${problem}`)
      wanted = { kind: astronaut.health <= 1 ? 'sickbay' : 'rest' }
    }
    entry.job = wanted.kind
    entry.where = JOBS[wanted.kind].outside ? 'outside' : 'inside'
    entry.points = workPoints(astronaut, wanted.kind)
    if (wanted.kind === 'trip' && wanted.trip) {
      entry.trip = wanted.trip
      astronaut.away = { trip: wanted.trip, daysLeft: tripDays(astronaut.id, wanted.trip) }
    }
    return entry
  })

  // Storm damage if nobody had moved: used to tell the commander what a good call saved.
  const damageAt = (where: Doing['where']): number => {
    if (!storm) return 0
    const level = storm.severe ? 1 : 0
    if (where === 'outside') return RULES.stormOutside[level]
    // The Moon-soil shield covers the whole base: under it, nobody indoors is hurt.
    return hasShield ? 0 : RULES.stormInside[level]
  }
  for (const entry of doing) entry.riskIfCarriedOn = damageAt(entry.where)

  // The commander's answer to the alert moves people, and costs them half their work.
  const half = (points: number) => Math.floor(points / 2)
  for (const entry of doing) {
    const wasOutside = entry.where === 'outside'
    if (answer === 'inside' && wasOutside) {
      entry.where = 'inside'
      if (entry.job === 'trip' || entry.job === 'trip-away') {
        entry.astronaut.away = null
        entry.recalled = true
        entry.points = 0
        entry.notes.push('Drove back early. The trip has to start again.')
      } else if (JOBS[entry.job].work) {
        entry.stoppedFrom = entry.points
        entry.points = half(entry.points)
        entry.notes.push('Stopped work early.')
      }
    }
  }

  // Work gets done.
  let gardenFood = 0
  for (const entry of doing) {
    const { astronaut, job, points } = entry
    if (job === 'garden') gardenFood += points
    if (job === 'lab') next.missions.shield += points
    if (job === 'build') next.missions.dish += points
    if (job === 'repair') {
      // Being called in has to cost something here too: half a repair mends nothing in a
      // broken module, and half as many panels (rounded down) as a whole day would.
      const stopped = entry.stoppedFrom !== null
      const broken = next.broken[0]
      if (broken && stopped) {
        entry.notes.push(`Stopped early: the ${MODULES[broken].name} is still broken.`)
      } else if (broken && points > 0) {
        next.broken.shift()
        entry.fixedModule = broken
        entry.notes.push(`Fixed the ${MODULES[broken].name}.`)
      } else if (!broken) {
        const panels = stopped ? Math.floor(panelsFixed(next.solarLoss, entry.stoppedFrom ?? 0) / 2) : points > 0 ? panelsFixed(next.solarLoss, points) : 0
        next.solarLoss -= panels
        entry.fixedPanels = panels
        entry.notes.push(panels > 0 ? `Got the solar panels back to work (+${panels} power).` : 'Stopped early: no panel was finished.')
      }
    }
    if ((job === 'trip' || job === 'trip-away') && astronaut.away) {
      astronaut.away.daysLeft -= 1
      if (astronaut.away.daysLeft <= 0) {
        const trip = astronaut.away.trip
        if (astronaut.away.found) {
          next.missions.shield += 2
          entry.notes.push('Brought home a glassy kind of Moon soil for the Lab: the shield research jumps ahead.')
        }
        astronaut.away = null
        entry.cameHome = true
        if (trip === 'pod') {
          next.pod = false
          next.food += RULES.podFood
          next.air += RULES.podAir
          entry.notes.push(`Came home with the supply pod: +${RULES.podFood} food, +${RULES.podAir} air.`)
        } else {
          next.missions.ice += 1
          entry.notes.push(`Came home: ${TRIPS[trip].brings.toLowerCase()}.`)
        }
      } else {
        entry.notes.push('Still out on the trip.')
      }
    }
  }

  // The machines.
  const airMade = on.includes('life') ? airPerDay(state) : 0
  let foodMade = (on.includes('farm') ? RULES.farmFood : 0) + gardenFood
  if (on.includes('scope')) {
    next.missions.sun += 1
    if (weather.watchFlare) next.flares.push({ ...weather.watchFlare, date: weather.date })
  }

  // The storm.
  let cropLoss = 0
  if (storm) {
    next.solarLoss += 1
    notes.push('The storm wore down the solar panels: 1 less power until someone repairs them.')
    if (!hasShield && foodMade > 0) {
      const lost = Math.min(foodMade, RULES.stormCropLoss)
      foodMade -= lost
      cropLoss = lost
      notes.push(`The storm hurt the plants: ${lost} less food today.`)
    }
  }
  const stormDamage = new Map<string, number>()
  for (const entry of doing) stormDamage.set(entry.astronaut.id, damageAt(entry.where))

  // Air and food.
  // Make first, then use, and only then check the tank is not over-full:
  // that way "made 5, used 3" always adds up on the report.
  next.air += airMade
  const airNeeded = next.crew.length
  const outOfAir = next.air < airNeeded
  next.air = clamp(next.air - airNeeded, RULES.airCap)
  next.airOutDays = outOfAir ? state.airOutDays + 1 : 0
  if (outOfAir) notes.push('The air ran low! Everyone feels ill.')

  next.food += foodMade
  // When food is short, the hungriest eat first.
  const ate = new Set<string>()
  for (const astronaut of [...next.crew].sort((a, b) => a.fed - b.fed)) {
    if (next.food <= 0) break
    next.food -= 1
    ate.add(astronaut.id)
  }
  next.food = Math.min(RULES.foodCap, next.food)
  if (ate.size < next.crew.length) notes.push('There was not enough food for everyone.')

  // Health and mood.
  const together = (a: Doing, b: Doing) =>
    a.astronaut.id !== b.astronaut.id &&
    a.job !== 'trip' &&
    a.job !== 'trip-away' &&
    b.job !== 'trip' &&
    b.job !== 'trip-away' &&
    JOBS[a.job].place === JOBS[b.job].place
  const pairedWith = (entry: Doing, pairs: [string, string][]) =>
    doing.find(
      (other) =>
        together(entry, other) &&
        pairs.some((pair) => pair.includes(entry.astronaut.id) && pair.includes(other.astronaut.id)),
    )

  const crewReports: CrewReport[] = doing.map((entry) => {
    const { astronaut, job } = entry
    const before = state.crew.find((member) => member.id === astronaut.id)!
    const info = crewInfo(astronaut.id)
    let health = astronaut.health
    let mood = astronaut.mood
    const lines = [...entry.notes]
    const why: Why[] = []

    const hurt = stormDamage.get(astronaut.id) ?? 0
    if (hurt > 0) {
      health -= hurt
      mood -= 1
      lines.push(`Hit by the storm ${entry.where === 'outside' ? 'outside' : 'inside the base'}: -${hurt} health.`)
    } else if (storm) {
      lines.push('Safe under the Moon-soil shield while the storm passed.')
    }
    if (outOfAir) health -= RULES.noAirDamage

    // Nobody gets better on an empty stomach: without a meal, rest does not heal.
    const fedToday = ate.has(astronaut.id)
    if (job === 'rest') {
      if (fedToday) health += 1
      mood += 2
    } else if (job === 'sickbay') {
      if (fedToday) health += 2
      mood += 1
    } else if (job === 'call') {
      mood += 3
      why.push('called')
      lines.push('Talked to family on Earth.')
    }

    const working = job === 'trip' || job === 'trip-away' || JOBS[job].work
    astronaut.streak = working ? before.streak + 1 : 0
    const tired = astronaut.streak >= RULES.tiredAfter
    if (working && !entry.recalled && !tired) {
      const realJob: JobId = job === 'trip-away' ? 'trip' : job
      if (info.loves.includes(realJob)) {
        mood += 1
        why.push('loves')
        lines.push(`Loves ${info.lovesText}.`)
      }
    }
    if (tired) {
      mood -= 1
      why.push('tired')
      lines.push('Tired: needs a day off.')
    }

    const friend = pairedWith(entry, FRIENDS)
    if (friend) {
      mood += 1
      why.push('friend')
      lines.push(`Spent the day with ${crewInfo(friend.astronaut.id).name}, a good friend.`)
    }
    const rival = pairedWith(entry, CLASHES)
    if (rival) {
      mood -= 1
      why.push('rival')
      lines.push(`Got annoyed with ${crewInfo(rival.astronaut.id).name}.`)
    }

    if (ate.has(astronaut.id)) {
      astronaut.fed = RULES.fullFed
    } else {
      astronaut.fed = Math.max(0, astronaut.fed - 1)
      mood -= 1
      if (astronaut.fed === 0) health -= 1
      why.push('hungry')
      lines.push('Went hungry.')
    }

    astronaut.health = clamp(health, RULES.maxStat)
    astronaut.mood = clamp(mood, RULES.maxStat)

    const did = entry.recalled ? 'Called back from the rover trip' : describe(job, entry.trip)
    return {
      id: astronaut.id,
      did,
      where: entry.where,
      healthBefore: before.health,
      healthAfter: astronaut.health,
      moodBefore: before.mood,
      moodAfter: astronaut.mood,
      ate: ate.has(astronaut.id),
      notes: lines,
      job,
      trip: entry.trip,
      points: entry.points,
      recalled: entry.recalled,
      hurt,
      cameHome: entry.cameHome,
      gaveUp: entry.gaveUp,
      fixedModule: entry.fixedModule,
      fixedPanels: entry.fixedPanels,
      why,
      friend: friend ? friend.astronaut.id : null,
      rival: rival ? rival.astronaut.id : null,
    }
  })

  // Finished missions pay off straight away.
  const finished = PROJECT_IDS.filter((id) => !missionDone(state.missions, id) && missionDone(next.missions, id))
  for (const id of finished) {
    next.missions[id] = MISSIONS[id].goal
    notes.push(id === 'shield' ? `The Moon-soil shield is built! ${MISSIONS[id].reward}` : `Mission complete: ${MISSIONS[id].name}! ${MISSIONS[id].reward}`)
    if (id === 'ice') next.air = Math.min(RULES.airCap, next.air + RULES.iceBonusAir)
    if (id === 'dish') {
      for (const astronaut of next.crew) {
        astronaut.mood = clamp(astronaut.mood + 2, RULES.maxStat)
        const line = crewReports.find((entry) => entry.id === astronaut.id)
        if (line) {
          line.moodAfter = astronaut.mood
          line.why.push('cheer')
          line.notes.push('Cheered when the radio telescope was finished.')
        }
      }
    }
  }

  // Was the commander's call a good one?
  let call: CallResult = null
  const heartsAtRisk = doing.reduce((sum, entry) => sum + entry.riskIfCarriedOn, 0)
  if (alert) {
    if (storm) call = answer === 'carry' ? 'hit' : 'saved'
    else call = answer === 'carry' ? 'calm' : 'false-alarm'
  } else if (storm) {
    call = 'surprise'
  }
  const heartsLost = [...stormDamage.values()].reduce((sum, value) => sum + value, 0)

  const report: DayReport = {
    day: state.day,
    date: weather.date,
    storm,
    flare: weather.watchFlare,
    alertShown: alert !== null,
    response: answer,
    call,
    heartsSaved: call === 'saved' ? heartsAtRisk - heartsLost : 0,
    power: { available, used, saved: next.battery },
    air: { made: airMade, used: airNeeded, left: next.air },
    food: { made: foodMade, eaten: ate.size, left: next.food },
    crew: crewReports,
    notes,
    finished,
    cropLoss,
    missions: { before: { ...state.missions }, after: { ...next.missions } },
  }

  // How the game ends.
  const everyoneDown = next.crew.every((astronaut) => condition(astronaut) === 'unable')
  if (everyoneDown || next.airOutDays >= 2) next.status = 'evacuated'
  // Finishing every mission does not end the tour by itself: the commander may hand over
  // early (handOver), or stay to get the base ready for the next crew.
  else if (state.day >= RULES.maxDays) next.status = 'done'

  // Set up tomorrow.
  next.history = [...state.history, report]
  next.radioYesterday = on.includes('comms')
  next.powerPenalty = 0
  next.offToday = []
  next.weakLifeDays = Math.max(0, state.weakLifeDays - 1)
  if (next.status === 'playing') {
    // The day counter only moves on while the mission is still running, so it never
    // points past the last day of real weather.
    next.day = state.day + 1
    if (next.arriving) {
      next.crew.push(newAstronaut(next.arriving))
      next.arriving = null
    }
    drawEvent(next)
  } else {
    next.event = null
  }

  return { state: next, report }
}

/**
 * What today would look like if the Sun stayed calm. The planning screen uses this to
 * show "air after today" without giving away whether a real storm is coming.
 */
export function calmPreview(state: GameState, scenario: Scenario, plan: Plan): DayReport {
  const calmDays = scenario.days.map((day, index) =>
    index === state.day - 1 ? { ...day, storm: null, watchFlare: null } : day,
  )
  return resolveDay(state, { ...scenario, days: calmDays }, plan).report
}

function describe(job: JobId | 'trip-away', trip: TripId | null): string {
  if ((job === 'trip' || job === 'trip-away') && trip) return TRIPS[trip].name
  return job === 'trip-away' ? 'Rover trip' : JOBS[job].name
}

// ---------------------------------------------------------------- the ending

export interface Rating {
  missions: MissionId[]
  /** True when the base is in good shape for the next crew. */
  handover: boolean
  /** One star per finished mission, plus one for a good handover. */
  stars: number
  maxStars: number
}

/** True once every mission is done. From then on the commander may hand the base over early. */
export function allMissionsDone(state: GameState): boolean {
  return MISSION_IDS.every((id) => missionDone(state.missions, id))
}

/**
 * Ends the tour before the last day. Only allowed in the morning, with every mission done.
 * The base is judged as it stands right now.
 */
export function handOver(state: GameState): GameState {
  if (state.status !== 'playing' || !allMissionsDone(state)) return state
  return { ...state, status: 'done', event: null }
}

export function handoverReady(state: GameState): boolean {
  return (
    state.status !== 'evacuated' &&
    state.crew.every((a) => !a.away) &&
    state.air >= RULES.handover.air &&
    state.food >= RULES.handover.food &&
    state.crew.every((a) => a.health >= RULES.handover.stat && a.mood >= RULES.handover.stat)
  )
}

export function rate(state: GameState): Rating {
  const missions = MISSION_IDS.filter((id) => missionDone(state.missions, id))
  const handover = handoverReady(state)
  return { missions, handover, stars: missions.length + (handover ? 1 : 0), maxStars: MISSION_IDS.length + 1 }
}
