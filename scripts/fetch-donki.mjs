// Downloads real space weather records from NASA's DONKI database and writes
// the compact file the game ships with: src/data/scenarios.json.
//
// Run with:  npm run data
//
// Anyone can re-run this to check that the game's flares and storms are the real ones.
// Source: NASA Space Weather Database Of Notifications, Knowledge, Information
// (DONKI), https://ccmc.gsfc.nasa.gov/tools/DONKI/

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const API = 'https://ccmc.gsfc.nasa.gov/DONKI-API/get'
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'scenarios.json')

// Each mission replays 10 real days. `firstDay` is mission day 1.
const SCENARIOS = [
  { id: 'quiet-2019', firstDay: '2019-12-01' },
  { id: 'sep-2017', firstDay: '2017-09-03' },
  { id: 'may-2024', firstDay: '2024-05-06' },
]
const MISSION_DAYS = 10

// A flare this big or bigger makes Mission Control send an alert in the game.
// The threshold is a game rule, not a NASA one.
const ALERT_FLARE = 'M5.0'

// Records of the same particle event from different instruments arrive minutes or
// hours apart. Records less than this many hours after the previous one count as
// the same storm. This grouping is a game rule too.
const SAME_STORM_HOURS = 12

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

// DONKI links each flare to the events it is related to. A linked CME means a
// coronal mass ejection (a huge cloud thrown off the Sun) came with the flare.
function cameWithCme(flare) {
  return (flare.linkedEvents ?? []).some((event) => event.activityID.includes('-CME-'))
}

/** Groups the measured particle records into storms. */
function findStorms(particleEvents) {
  const records = particleEvents
    .map((event) => ({
      time: event.eventTime,
      instruments: (event.instruments ?? []).map((i) => i.displayName).filter(measuredNearEarth),
      link: event.link,
    }))
    .filter((record) => record.time && record.instruments.length > 0)
    .sort((a, b) => a.time.localeCompare(b.time))

  const storms = []
  let lastTime = null
  for (const record of records) {
    const hoursSinceLast = lastTime === null ? Infinity : (Date.parse(record.time) - Date.parse(lastTime)) / 3_600_000
    if (hoursSinceLast > SAME_STORM_HOURS) {
      storms.push({ time: record.time, severe: false, instruments: [], link: record.link })
    }
    const storm = storms[storms.length - 1]
    for (const name of record.instruments) {
      if (!storm.instruments.includes(name)) storm.instruments.push(name)
      // Protons above 100 MeV get through much more shielding: the game calls that "severe".
      if (name.includes('>100 MeV')) storm.severe = true
    }
    lastTime = record.time
  }
  return storms
}

async function buildScenario({ id, firstDay }) {
  // One extra day before the mission: the day-1 briefing talks about yesterday.
  const from = addDays(firstDay, -1)
  const to = addDays(firstDay, MISSION_DAYS - 1)
  const [flares, particleEvents, geomagneticStorms] = await Promise.all([
    get('FLR', from, to),
    get('SEP', from, to),
    get('GST', from, to),
  ])
  const storms = findStorms(particleEvents)

  const days = []
  for (let offset = -1; offset < MISSION_DAYS; offset += 1) {
    const date = addDays(firstDay, offset)

    const dayFlares = flares
      .filter((flare) => flare.peakTime?.startsWith(date))
      .sort((a, b) => flareRank(b.classType) - flareRank(a.classType))
    const storm = storms.find((candidate) => candidate.time.startsWith(date)) ?? null

    // The flare Mission Control raises the alarm about: a big one, seen before any
    // storm arrived that day. Flares that came with a CME are the ones to watch.
    const bigFlares = dayFlares
      .filter((flare) => flareRank(flare.classType) >= flareRank(ALERT_FLARE))
      .filter((flare) => !storm || flare.peakTime < storm.time)
    const watch = bigFlares.find(cameWithCme) ?? bigFlares[0] ?? null

    const kpValues = geomagneticStorms
      .flatMap((entry) => entry.allKpIndex ?? [])
      .filter((kp) => kp.observedTime?.startsWith(date))
      .map((kp) => kp.kpIndex)

    days.push({
      date,
      flareCount: dayFlares.length,
      strongestFlare: dayFlares[0]?.classType ?? null,
      watchFlare: watch && {
        class: watch.classType,
        time: watch.peakTime,
        cme: cameWithCme(watch),
        location: watch.sourceLocation ?? null,
        link: watch.link,
      },
      storm,
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
  alertFlare: ALERT_FLARE,
  scenarios,
}

await mkdir(dirname(OUT), { recursive: true })
await writeFile(OUT, `${JSON.stringify(output, null, 2)}\n`)
console.log(`wrote ${OUT}`)
