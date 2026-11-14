// Small helpers that turn game values into words and symbols for the screen.

import { crewInfo, type JobId, type MissionId, type ModuleId } from '../game/content.ts'
import { RULES, type Condition, type GameState } from '../game/outpost.ts'

export const MODULE_ICONS: Record<ModuleId, string> = {
  life: '💨',
  farm: '🌱',
  comms: '📡',
  scope: '🔭',
  lab: '🧪',
  garage: '🚙',
}

export const MISSION_ICONS: Record<MissionId, string> = {
  ice: '❄️',
  shield: '🛡️',
  dish: '🏗️',
  sun: '🔭',
}

export const JOB_ICONS: Record<JobId, string> = {
  garden: '🌱',
  lab: '🧪',
  build: '🏗️',
  repair: '🔧',
  trip: '🚙',
  rest: '🛋️',
  sickbay: '🩹',
  call: '📞',
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** "2017-09-06" becomes "6 September 2017". */
export function longDate(isoDate: string): string {
  const [year, month, day] = isoDate.slice(0, 10).split('-').map(Number)
  return `${day} ${MONTHS[month - 1]} ${year}`
}

/** "2017-09-06T12:02Z" becomes "12:02". The times in NASA's records are in UTC. */
export function clock(isoTime: string): string {
  return isoTime.slice(11, 16)
}

/** Turns "GOES13: SEM/EPS >10 MeV" style names into a short list of spacecraft. */
export function spacecraftList(instruments: string[]): string {
  const names = [...new Set(instruments.map((name) => name.split(':')[0].replace(/-?P$|\d+$/, '').trim()))]
  if (names.length <= 1) return names[0] ?? 'a spacecraft'
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

export const CONDITION_WORDS: Record<Condition, string> = {
  well: 'Ready to work',
  struggling: 'Works slowly',
  unable: 'Cannot work',
}

export function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`
}

/** What the base still lacks for a good handover to the next crew, as a few short words each. */
export function handoverNeeds(game: GameState): string[] {
  const needs: string[] = []
  const { air, food, stat } = RULES.handover
  if (game.air < air) needs.push(`${air - game.air} more air`)
  if (game.food < food) needs.push(`${food - game.food} more food`)
  for (const a of game.crew) {
    const name = crewInfo(a.id).name
    if (a.away) needs.push(`${name} back home`)
    if (a.health < stat) needs.push(`${name} healthier`)
    if (a.mood < stat) needs.push(`${name} happier`)
  }
  return needs
}
