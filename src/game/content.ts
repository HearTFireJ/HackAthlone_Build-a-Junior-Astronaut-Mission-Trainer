// What the outpost is made of: its modules, the jobs, the crew, the missions.
// Everything here is made up for the game. The real data lives in weather.ts.

/** Modules that need electricity. Each day the commander chooses which ones to run. */
export const MODULE_IDS = ['life', 'farm', 'comms', 'scope', 'lab', 'garage'] as const
export type ModuleId = (typeof MODULE_IDS)[number]

export interface ModuleInfo {
  name: string
  /** Units of power it uses on a day it is switched on. */
  power: number
  /** What switching it on does, in a few words. */
  does: string
}

export const MODULES: Record<ModuleId, ModuleInfo> = {
  life: { name: 'Life Support', power: 2, does: 'Makes air to breathe' },
  farm: { name: 'Greenhouse', power: 2, does: 'Grow-lights: plants make food' },
  comms: { name: 'Radio Dish', power: 1, does: 'Storm alerts today, Sun report tomorrow' },
  scope: { name: 'Sun Telescope', power: 1, does: 'Shows whether a flare could bring a storm' },
  lab: { name: 'Lab', power: 2, does: 'Lets the crew do research' },
  garage: { name: 'Rover Bay', power: 2, does: 'Charges the rover for a trip' },
}

export const JOB_IDS = ['garden', 'lab', 'build', 'repair', 'trip', 'rest', 'sickbay', 'call'] as const
export type JobId = (typeof JOB_IDS)[number]

/** Where a job happens. People in the same place meet each other. */
export type Place = 'farm' | 'lab' | 'site' | 'panels' | 'habitat' | 'away'

export interface JobInfo {
  name: string
  place: Place
  /** Outside jobs leave the astronaut with no walls to block a storm. */
  outside: boolean
  /** Work jobs make people tired. Rest, sick bay and calling home do not. */
  work: boolean
  /** The module that must be switched on for this job. */
  needs?: ModuleId
  does: string
}

export const JOBS: Record<JobId, JobInfo> = {
  garden: { name: 'Tend the plants', place: 'farm', outside: false, work: true, needs: 'farm', does: 'More food' },
  lab: { name: 'Do research', place: 'lab', outside: false, work: true, needs: 'lab', does: 'Works on the Moon-soil shield' },
  build: { name: 'Build the telescope', place: 'site', outside: true, work: true, does: 'Works on the radio telescope. Outside!' },
  repair: { name: 'Repair', place: 'panels', outside: true, work: true, does: 'Fixes broken things. Outside!' },
  trip: { name: 'Rover trip', place: 'away', outside: true, work: true, needs: 'garage', does: 'Drives far from the base. Outside!' },
  rest: { name: 'Rest', place: 'habitat', outside: false, work: false, does: 'Better mood, a little health' },
  sickbay: { name: 'Sick bay', place: 'habitat', outside: false, work: false, does: 'Much better health' },
  call: { name: 'Call home', place: 'habitat', outside: false, work: false, needs: 'comms', does: 'Much better mood' },
}

export const TRIP_IDS = ['scout', 'drill', 'haul', 'pod'] as const
export type TripId = (typeof TRIP_IDS)[number]

export interface TripInfo {
  name: string
  /** How many days the astronaut is away. */
  days: number
  brings: string
}

export const TRIPS: Record<TripId, TripInfo> = {
  scout: { name: 'Scout the dark crater', days: 1, brings: 'A map of where to drill' },
  drill: { name: 'Drill for ice', days: 2, brings: 'Proof that there is ice' },
  haul: { name: 'Bring ice home', days: 2, brings: 'Ice for the Life Support machine' },
  pod: { name: 'Fetch the supply pod', days: 2, brings: 'Food and air' },
}

/** The three ice trips have to be done in this order. */
export const ICE_TRIPS: TripId[] = ['scout', 'drill', 'haul']

export interface CrewInfo {
  id: string
  name: string
  /** Jobs this person loves. Doing them lifts their mood and they do them better. */
  loves: JobId[]
  lovesText: string
  about: string
  colour: string
}

// Placeholder names: the author has not chosen the crew yet.
export const CREW: CrewInfo[] = [
  { id: 'aoife', name: 'Aoife', loves: ['garden'], lovesText: 'plants', about: 'Talks to the tomatoes.', colour: '#5fd38d' },
  { id: 'cian', name: 'Cian', loves: ['trip'], lovesText: 'driving the rover', about: 'Never gets lost. Says so often.', colour: '#ffb454' },
  { id: 'niamh', name: 'Niamh', loves: ['build', 'repair'], lovesText: 'building and fixing', about: 'Carries a spanner everywhere.', colour: '#6cb8ff' },
  { id: 'oisin', name: 'Oisín', loves: ['lab'], lovesText: 'experiments', about: 'Asks "why?" about everything.', colour: '#d58cff' },
  { id: 'saoirse', name: 'Saoirse', loves: ['lab'], lovesText: 'experiments', about: 'Labels everything. Even the labels.', colour: '#ff8fc0' },
  { id: 'tadhg', name: 'Tadhg', loves: ['garden'], lovesText: 'plants', about: 'Has given every seedling a name.', colour: '#f2665a' },
]

/** The base has four beds: the crew never grows past this. */
export const MAX_CREW = 4

/** Pairs who cheer each other up when they spend the day in the same place. */
export const FRIENDS: [string, string][] = [
  ['aoife', 'cian'],
  ['niamh', 'oisin'],
  ['saoirse', 'tadhg'],
]

/**
 * Pairs who get on each other's nerves when they spend the day in the same place.
 * The two who love the same job are rivals: taking both gets that job done twice as fast,
 * and costs some peace.
 */
export const CLASHES: [string, string][] = [
  ['cian', 'niamh'],
  ['oisin', 'saoirse'],
  ['aoife', 'tadhg'],
]

/** The missions the crew came to do. Each one that is finished earns a star. */
export const MISSION_IDS = ['ice', 'dish', 'sun'] as const
export type MissionId = (typeof MISSION_IDS)[number]

/**
 * Everything the crew builds up over several days: the missions, and the Moon-soil shield.
 * The shield is not a mission and earns no star. It is the commander's choice: spend power
 * and working days on protection, or ride the storms out and get the missions done sooner.
 */
export const PROJECT_IDS = ['ice', 'shield', 'dish', 'sun'] as const
export type ProjectId = (typeof PROJECT_IDS)[number]

export interface MissionInfo {
  name: string
  /** Progress needed to finish. */
  goal: number
  how: string
  reward: string
}

export const MISSIONS: Record<ProjectId, MissionInfo> = {
  ice: {
    name: 'Find water ice',
    goal: 3,
    how: 'Three rover trips: scout, drill, bring ice home.',
    reward: 'Life Support makes much more air.',
  },
  shield: {
    name: 'Moon-soil shield',
    goal: 8,
    how: 'Research in the Lab.',
    reward: 'Storms can no longer hurt anyone indoors, or the plants.',
  },
  dish: {
    name: 'Radio telescope',
    goal: 12,
    how: 'Build it outside, piece by piece.',
    reward: 'The whole crew cheers up.',
  },
  sun: {
    name: 'Watch the Sun',
    goal: 5,
    how: 'Run the Sun Telescope for 5 days.',
    reward: 'Flare alerts always show whether a storm could follow.',
  },
}

/** How each real stretch of days is set up. Chosen by the difficulty the player picks. */
export interface Setup {
  /** Units of power the solar panels make on a good day. */
  solar: number
  air: number
  food: number
  /** How many seats the mission has, and who goes if the commander does not choose. */
  crew: string[]
}

export const SETUPS: Record<string, Setup> = {
  'quiet-2019': { solar: 7, air: 12, food: 14, crew: ['aoife', 'cian', 'niamh', 'oisin'] },
  'sep-2017': { solar: 7, air: 10, food: 12, crew: ['aoife', 'cian', 'niamh'] },
  'may-2024': { solar: 7, air: 9, food: 10, crew: ['aoife', 'cian', 'niamh'] },
}

/**
 * What the last crew left behind. One of these is drawn at the start of every game, so no two
 * games begin the same way. Each one pairs a good thing with a bad thing: none is simply better.
 * No start breaks a module: a repair is outside work, and on a level with a flare alert every
 * day a careful commander might never get it done. All of it is made up for the game.
 */
export const START_IDS = ['dusty', 'pantry', 'airy', 'scouted', 'started', 'notes'] as const
export type StartId = (typeof START_IDS)[number]

export interface StartInfo {
  /** A few words each: they are shown as two labels on the welcome card. */
  good: string
  bad: string
  /** Added to the level's starting air and food. */
  air?: number
  food?: number
  battery?: number
  /** Solar panels that make no power until someone repairs them. */
  solarLoss?: number
  /** Progress already made on a mission or on the shield. */
  progress?: Partial<Record<ProjectId, number>>
  /** Added to everyone's starting mood. */
  mood?: number
}

export const STARTS: Record<StartId, StartInfo> = {
  dusty: { good: 'Battery full', bad: '2 solar panels dusty', battery: 3, solarLoss: 2 },
  pantry: { good: 'Extra food', bad: 'Less air', food: 3, air: -3 },
  airy: { good: 'Extra air', bad: 'Less food', air: 3, food: -3 },
  scouted: { good: 'Dark crater already scouted', bad: 'Less food', progress: { ice: 1 }, food: -3 },
  started: { good: 'Radio telescope already started', bad: 'Crew feeling low', progress: { dish: 3 }, mood: -1 },
  notes: { good: 'Shield research already started', bad: '1 solar panel dusty', progress: { shield: 3 }, solarLoss: 1 },
}

export function crewInfo(id: string): CrewInfo {
  const info = CREW.find((member) => member.id === id)
  if (!info) throw new Error(`Unknown astronaut: ${id}`)
  return info
}
