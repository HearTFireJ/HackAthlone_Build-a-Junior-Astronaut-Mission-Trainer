// Downloads real space weather records from NASA's DONKI database and writes
// the compact file the game ships with: src/data/scenarios.json.
//
// Run with:  npm run data
//
// Anyone can re-run this to check that the game's storms are the real ones.
// Source: NASA Space Weather Database Of Notifications, Knowledge, Information
// (DONKI), https://ccmc.gsfc.nasa.gov/tools/DONKI/

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const API = 'https://ccmc.gsfc.nasa.gov/DONKI-API/get'
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'scenarios.json')

// Each mission is 10 real days. `firstDay` is mission day 1.
const SCENARIOS = [
  { id: 'quiet-2019', firstDay: '2019-12-01' },
  { id: 'sep-2017', firstDay: '2017-09-03' },
  { id: 'may-2024', firstDay: '2024-05-06' },
]
const MISSION_DAYS = 10

function addDays(isoDate, days) {
  const date = new Date(`${isoDate}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

async function get(kind, startDate, endDate) {
  const url = `${API}/${kind}?startDate=${startDate}&endDate=${endDate}`
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const text = (await response.text()).trim()
      // DONKI answers with an empty body when there is nothing in the range.
      return text ? JSON.parse(text) : []
    } catch (error) {
      if (attempt === 4) throw new Error(`${url} failed: ${error.message}`)
      await new Promise((resolve) => setTimeout(resolve, 1500 * attempt))
    }
  }
  return []
}

// Flare classes go A < B < C < M < X, then by the number after the letter.
function flareRank(classType) {
  const letter = 'ABCMX'.indexOf(classType[0])
  const number = Number.parseFloat(classType.slice(1)) || 0
  return letter * 100 + number
}

// Only instruments that sit near Earth tell us about the Moon.
// "MODEL:" entries are computer predictions, not measurements, and
// STEREO A orbits the Sun far away from the Earth-Moon system.
function measuredNearEarth(instrumentName) {
  return /^(GOES|SOHO|ACE)/.test(instrumentName)
}

async function buildScenario({ id, firstDay }) {
  // One extra day before the mission: the day-1 forecast looks at yesterday's flares.
  const from = addDays(firstDay, -1)
  const to = addDays(firstDay, MISSION_DAYS - 1)
  const [flares, particleEvents, geomagneticStorms] = await Promise.all([
    get('FLR', from, to),
    get('SEP', from, to),
    get('GST', from, to),
  ])

  const days = []
  for (let offset = -1; offset < MISSION_DAYS; offset += 1) {
    const date = addDays(firstDay, offset)

    const dayFlares = flares
      .filter((flare) => flare.peakTime?.startsWith(date))
      .sort((a, b) => flareRank(b.classType) - flareRank(a.classType))

    const dayParticles = particleEvents
      .filter((event) => event.eventTime?.startsWith(date))
      .map((event) => ({
        time: event.eventTime,
        instruments: (event.instruments ?? [])
          .map((instrument) => instrument.displayName)
          .filter(measuredNearEarth),
        link: event.link,
      }))
      .filter((event) => event.instruments.length > 0)

    const kpValues = geomagneticStorms
      .flatMap((storm) => storm.allKpIndex ?? [])
      .filter((kp) => kp.observedTime?.startsWith(date))
      .map((kp) => kp.kpIndex)

    days.push({
      date,
      strongestFlare: dayFlares[0]?.classType ?? null,
      strongestFlareLink: dayFlares[0]?.link ?? null,
      flareCount: dayFlares.length,
      particleEvents: dayParticles,
      maxKp: kpValues.length ? Math.max(...kpValues) : null,
    })
  }

  return { id, dayBefore: days[0], days: days.slice(1) }
}

const scenarios = []
for (const scenario of SCENARIOS) {
  scenarios.push(await buildScenario(scenario))
  console.log(`fetched ${scenario.id}`)
}

const output = {
  source: 'NASA DONKI (Space Weather Database Of Notifications, Knowledge, Information)',
  sourceUrl: 'https://ccmc.gsfc.nasa.gov/tools/DONKI/',
  retrievedAt: new Date().toISOString().slice(0, 10),
  scenarios,
}

await mkdir(dirname(OUT), { recursive: true })
await writeFile(OUT, `${JSON.stringify(output, null, 2)}\n`, 'utf8')
console.log(`wrote ${OUT}`)
