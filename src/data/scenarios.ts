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
  /** Where the facts in the blurb come from. Shown as links in the mission report. */
  sources: { label: string; url: string }[]
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
    sources: [
      {
        label: 'NASA: the Sun was at its quietest in December 2019',
        url: 'https://www.nasa.gov/news-release/solar-cycle-25-is-here-nasa-noaa-scientists-explain-what-that-means/',
      },
    ],
  },
  {
    scenario: find('sep-2017'),
    title: 'September Surprise',
    dates: '3–12 September 2017',
    difficulty: 'Stormy',
    blurb:
      "The Sun fired the biggest flare of its whole 11-year cycle. Four days later, a brand-new radio telescope in Birr, Ireland, picked up radio waves from another giant flare.",
    sources: [
      {
        label: 'NASA: the flare of 6 September 2017',
        url: 'https://www.nasa.gov/solar-system/sun-erupts-with-significant-flare/',
      },
      {
        label: 'Trinity College Dublin: the telescope in Birr',
        url: 'https://www.tcd.ie/news_events/articles/new-radio-telescope-in-birr-detects-huge-solar-storms/',
      },
    ],
  },
  {
    scenario: find('may-2024'),
    title: 'The Great May Storm',
    dates: '6–15 May 2024',
    difficulty: 'Very stormy',
    blurb:
      'The strongest solar storm to reach Earth in twenty years. People across Ireland saw the northern lights.',
    sources: [
      {
        label: 'NASA: the storm of May 2024',
        url: 'https://science.nasa.gov/science-research/heliophysics/how-nasa-tracked-the-most-intense-solar-storm-in-decades/',
      },
      {
        label: 'RTÉ News: northern lights over Ireland',
        url: 'https://www.rte.ie/news/ireland/2024/0511/1448552-northern-lights',
      },
    ],
  },
]
