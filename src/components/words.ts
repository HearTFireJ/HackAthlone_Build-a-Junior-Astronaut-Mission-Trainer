// All the words and labels the player reads. No rules live here.
// Keep the language plain: the players are 7 to 12 years old.

import type { Job, ResourceName } from '../game/mission.ts'
import { RULES } from '../game/mission.ts'
import type { ForecastLevel, SpaceWeatherDay } from '../game/scenario.ts'

export const RESOURCE_WORDS: Record<ResourceName, { icon: string; name: string }> = {
  power: { icon: '⚡', name: 'Power' },
  oxygen: { icon: '💨', name: 'Oxygen' },
  food: { icon: '🥬', name: 'Food' },
}

export const JOB_WORDS: Record<Job, { icon: string; name: string; effect: string; past: string }> = {
  solar: {
    icon: '🔧',
    name: 'Fix solar panels',
    effect: `+${RULES.jobOutput} ⚡`,
    past: 'fixed the solar panels',
  },
  oxygen: {
    icon: '💨',
    name: 'Run oxygen machine',
    effect: `+${RULES.jobOutput} 💨`,
    past: 'ran the oxygen machine',
  },
  farm: {
    icon: '🥬',
    name: 'Grow food',
    effect: `+${RULES.jobOutput} 🥬`,
    past: 'worked in the greenhouse',
  },
  science: {
    icon: '🔬',
    name: 'Explore outside',
    effect: `+${RULES.scienceOutput} 🔬  −${RULES.scienceOxygenCost} 💨`,
    past: 'explored outside',
  },
  rest: {
    icon: '😴',
    name: 'Rest',
    effect: `+${RULES.restHealing} ❤️`,
    past: 'rested',
  },
}

export const FORECAST_WORDS: Record<ForecastLevel, { label: string; advice: string }> = {
  low: { label: 'LOW', advice: 'A storm is not likely today. But forecasts can be wrong.' },
  medium: { label: 'MEDIUM', advice: 'A storm could come today. It is hard to say.' },
  high: { label: 'HIGH', advice: 'A storm is more likely today. It is still not certain.' },
}

/** "6 September 2017" */
export function longDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString('en-IE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/** What yesterday's Sun looked like, in one sentence with the real number in it. */
export function flareSentence(yesterday: SpaceWeatherDay): string {
  const flare = yesterday.strongestFlare
  if (!flare) return 'Yesterday NASA recorded no solar flares.'
  const size = flare.startsWith('X') ? 'the biggest kind' : flare.startsWith('M') ? 'a medium one' : 'a small one'
  return `Yesterday the Sun's strongest flare was class ${flare} (${size}).`
}

/** "GOES13: SEM/EPS >10 MeV" -> "GOES-13" */
function spacecraftName(instrument: string): string {
  const name = instrument.split(':')[0].trim()
  if (name === 'GOES-P') return 'GOES'
  return name.replace(/^GOES(\d+)$/, 'GOES-$1')
}

/** "the GOES-13 and SOHO spacecraft" */
export function spacecraftList(day: SpaceWeatherDay): string {
  const names = [...new Set(day.particleEvents.flatMap((event) => event.instruments.map(spacecraftName)))]
  if (names.length === 0) return 'spacecraft near Earth'
  const joined = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
  return `the ${joined} spacecraft`
}

export function hearts(health: number): string {
  return '❤️'.repeat(health) + '🤍'.repeat(Math.max(0, RULES.fullHealth - health))
}

export function stars(count: number): string {
  return '⭐'.repeat(count) + '☆'.repeat(Math.max(0, 3 - count))
}
