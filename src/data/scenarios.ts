// The real space weather the game ships with, plus the words shown for each mission.
// scenarios.json is written by scripts/fetch-donki.mjs (npm run data): do not edit it by hand.

import type { Scenario } from '../game/scenario.ts'
import raw from './scenarios.json'

export interface ScenarioInfo {
  scenario: Scenario
  /** Short name on the mission picker. */
  title: string
  /** The real dates, written for people. */
  dates: string
  difficulty: 'Calm' | 'Stormy' | 'Very stormy'
  /** One or two sentences about what really happened. */
  blurb: string
}

function find(id: string): Scenario {
  const scenario = raw.scenarios.find((entry) => entry.id === id)
  if (!scenario) throw new Error(`Missing scenario data: ${id}`)
  return scenario
}

export const DATA_SOURCE = {
  name: raw.source,
  url: raw.sourceUrl,
  retrievedAt: raw.retrievedAt,
}

export const SCENARIOS: ScenarioInfo[] = [
  {
    scenario: find('quiet-2019'),
    title: 'The Quiet Sun',
    dates: '1–10 December 2019',
    difficulty: 'Calm',
    blurb:
      "Every 11 years or so the Sun goes quiet. NASA's space weather database lists no solar flares at all for these ten days.",
  },
  {
    scenario: find('sep-2017'),
    title: 'September Surprise',
    dates: '3–12 September 2017',
    difficulty: 'Stormy',
    blurb:
      'The Sun fired its strongest flare in more than ten years. A brand-new radio telescope in Birr, Ireland, picked up the blast.',
  },
  {
    scenario: find('may-2024'),
    title: 'The Great May Storm',
    dates: '6–15 May 2024',
    difficulty: 'Very stormy',
    blurb:
      'The biggest solar storm to reach Earth in twenty years. People across Ireland saw the northern lights.',
  },
]
