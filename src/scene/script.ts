// Turns one day's result into a little film: who walks where, what pops up, and when.
//
// The rules (src/game/outpost.ts) have already decided everything that happens. This
// file only decides how to show it. It is plain data, so it can be tested without a screen.

import { JOBS, MISSIONS, MODULES, TRIPS, crewInfo, type JobId, type MissionId, type ModuleId } from '../game/content.ts'
import { RULES, type DayReport, type GameState, type Missions, type Why } from '../game/outpost.ts'
import type { Activity, PlaceId } from './layout.ts'

/** The numbers on the screen while the day plays. They change step by step, as things happen. */
export interface Hud {
  air: number
  food: number
  missions: Missions
  crew: Record<string, { health: number; mood: number; fed: number }>
  panelsDead: number
}

export type Tone = 'plain' | 'good' | 'warn' | 'bad'

/** One thing that happens in the film, at a time in seconds from its start. */
export type Cue = { t: number } & (
  | { kind: 'caption'; text: string; tone: Tone }
  | { kind: 'time'; label: string }
  | { kind: 'go'; who: string; act: Activity; repairAt?: ModuleId | 'panels'; hurry?: boolean }
  | { kind: 'rover-in'; who: string; act: Activity; hurry?: boolean }
  /** Words that float up over a place or a person. `named` writes the person's name in front. */
  | { kind: 'float'; at: PlaceId | { who: string }; text: string; tone: Tone; named?: boolean; /** The same thing in full, for the log. */ log?: string }
  /** A line for the log only: nothing is drawn. */
  | { kind: 'note'; text: string; tone: Tone }
  | { kind: 'hit'; who: string }
  | { kind: 'flare' }
  | { kind: 'storm'; seconds: number; severe: boolean }
  | { kind: 'fx'; fx: 'wilt' | 'celebrate' | 'shake' | 'smoke' | 'dust' | 'confetti' | 'lander'; place?: PlaceId }
  | { kind: 'hud'; patch: Partial<Hud> }
  | { kind: 'alert' }
  | { kind: 'end' }
)

/** A cue without its time. */
type Body<C> = C extends unknown ? Omit<C, 't'> : never

/** How long floating words stay up, and how far apart the evening's lines come, in seconds. */
export const FLOAT_SECONDS = 3.6
const EVENING_GAP = 0.6

/** Seconds from "Start the day" to the moment a flare alert can come in. */
export const MORNING = 6.5

const ACTIVITY: Record<JobId, Activity> = {
  garden: 'garden',
  lab: 'lab',
  build: 'build',
  repair: 'repair',
  trip: 'board',
  rest: 'rest',
  sickbay: 'sickbay',
  call: 'call',
}

export function hudOf(state: GameState): Hud {
  return {
    air: state.air,
    food: state.food,
    missions: { ...state.missions },
    crew: Object.fromEntries(state.crew.map((a) => [a.id, { health: a.health, mood: a.mood, fed: a.fed }])),
    panelsDead: Math.min(state.solar, state.solarLoss + state.powerPenalty),
  }
}

/** What each repairer works on: broken modules first, in order, then the solar panels. */
function repairTargets(before: GameState, report: DayReport): Map<string, ModuleId | 'panels'> {
  const targets = new Map<string, ModuleId | 'panels'>()
  const broken = [...before.broken]
  for (const member of report.crew) {
    if (member.job !== 'repair') continue
    targets.set(member.id, (member.points > 0 ? broken.shift() : undefined) ?? 'panels')
  }
  return targets
}

/**
 * The morning: everyone walks to where the plan sends them. If a flare alert is due,
 * the film stops at the end of the morning and waits for the commander's answer.
 *
 * "preview" is the day as it would go if nobody were called in. The morning is the same
 * whatever the commander answers later, so it is safe to use.
 */
export function morningScript(before: GameState, preview: DayReport, alert: boolean): Cue[] {
  const cues: Cue[] = [
    { t: 0, kind: 'time', label: 'Morning' },
    { t: 0, kind: 'caption', text: `Day ${before.day}. Off to work!`, tone: 'plain' },
  ]
  const repairs = repairTargets(before, preview)
  preview.crew.forEach((member, index) => {
    const wasAway = !!before.crew.find((a) => a.id === member.id)?.away
    // The log says where everyone is going.
    const going = member.job === 'trip-away' ? 'still out with the rover' : member.job === 'trip' && member.trip ? TRIPS[member.trip].name : JOBS[member.job].name
    cues.push({ t: 0.25 * index, kind: 'note', text: `${crewInfo(member.id).name} → ${going}`, tone: 'plain' })
    if (member.job === 'trip-away') return
    if (wasAway) {
      // Gave up a trip: the rover brings them home first thing.
      cues.push({ t: 0.4, kind: 'rover-in', who: member.id, act: ACTIVITY[member.job] })
      return
    }
    cues.push({ t: 0.25 * index, kind: 'go', who: member.id, act: ACTIVITY[member.job], repairAt: repairs.get(member.id) })
  })
  if (alert) {
    cues.push({ t: MORNING - 0.9, kind: 'flare' })
    cues.push({ t: MORNING - 0.9, kind: 'caption', text: 'The Sun has just fired a big flare!', tone: 'warn' })
    cues.push({ t: MORNING, kind: 'alert' })
  }
  return cues
}

const WHY_WORDS: Record<Why, string> = {
  loves: 'loves this job',
  tired: 'tired',
  friend: 'with a friend',
  rival: 'annoyed',
  bored: 'bored',
  hungry: 'hungry',
  called: 'called home',
  cheer: 'hooray!',
}

const MISSION_PLACE: Record<MissionId, PlaceId> = { ice: 'life', shield: 'shelter', dish: 'site', sun: 'scope' }

const signed = (value: number) => (value > 0 ? `+${value}` : `−${Math.abs(value)}`)

/**
 * The rest of the day, once the commander's answer is known: people move if they were
 * called in, the storm comes or does not, the work pays off, everyone goes home to eat.
 */
export function restScript(before: GameState, after: GameState, report: DayReport): Cue[] {
  const cues: Cue[] = []
  const add = (t: number, cue: Body<Cue>) => cues.push({ t, ...cue } as Cue)
  const stats = hudOf(before).crew
  const inRover = (job: JobId | 'trip-away') => job === 'trip' || job === 'trip-away'
  let t = 0

  add(t, { kind: 'time', label: 'Midday' })
  for (const member of report.crew) {
    if (member.gaveUp) add(t, { kind: 'note', text: `${crewInfo(member.id).name} was too poorly to carry on and drove home. The trip has to start again.`, tone: 'bad' })
  }
  if (report.alertShown) {
    if (report.response === 'shelter') {
      add(t, { kind: 'caption', text: 'Everyone to the storm shelter!', tone: 'warn' })
      for (const member of report.crew) {
        if (member.recalled) add(t, { kind: 'rover-in', who: member.id, act: 'shelter', hurry: true })
        else if (!inRover(member.job)) add(t, { kind: 'go', who: member.id, act: 'shelter', hurry: true })
      }
    } else if (report.response === 'inside') {
      add(t, { kind: 'caption', text: 'Outside crew, come inside!', tone: 'warn' })
      for (const member of report.crew) {
        if (member.recalled) add(t, { kind: 'rover-in', who: member.id, act: 'idle', hurry: true })
        else if (!inRover(member.job) && JOBS[member.job as JobId].outside) add(t, { kind: 'go', who: member.id, act: 'idle', hurry: true })
      }
    } else {
      add(t, { kind: 'caption', text: 'Carrying on with the work.', tone: 'plain' })
    }
    t += 4.4
  } else {
    t += 2.6
  }

  if (report.storm) {
    add(t, { kind: 'time', label: 'Storm' })
    add(t, { kind: 'storm', seconds: 4.8, severe: report.storm.severe })
    add(t, { kind: 'caption', text: `A ${report.storm.severe ? 'severe ' : ''}solar particle storm hits the base!`, tone: 'bad' })
    let sheltered = false
    for (const member of report.crew) {
      if (member.hurt > 0) {
        add(t + 1.5, { kind: 'hit', who: member.id })
        add(t + 1.5, { kind: 'float', at: { who: member.id }, text: `−${member.hurt} ♥`, tone: 'bad' })
        stats[member.id] = { ...stats[member.id], health: Math.max(0, stats[member.id].health - member.hurt) }
      } else if (member.where === 'shelter') {
        sheltered = true
      }
    }
    add(t + 1.5, { kind: 'hud', patch: { crew: { ...stats } } })
    if (sheltered) add(t + 1.8, { kind: 'float', at: 'shelter', text: '🛡️ Safe in here', tone: 'good' })
    add(t + 2.6, { kind: 'hud', patch: { panelsDead: Math.min(before.solar, before.solarLoss + before.powerPenalty + 1) } })
    add(t + 2.6, { kind: 'float', at: 'panels', text: '−1 ⚡ worn by the storm', tone: 'bad' })
    if (report.cropLoss > 0) {
      add(t + 3.2, { kind: 'fx', fx: 'wilt' })
      add(t + 3.2, { kind: 'float', at: 'farm', text: `−${report.cropLoss} 🥕 plants hurt`, tone: 'bad' })
    }
    t += 5.6
  } else if (report.alertShown) {
    add(t, { kind: 'caption', text: 'No storm came this time.', tone: report.response === 'carry' ? 'good' : 'plain' })
    t += 3
  }

  // The day's work pays off.
  add(t, { kind: 'time', label: 'Afternoon' })
  if (!report.storm && !report.alertShown) add(t, { kind: 'caption', text: 'A quiet day: no big flare, no storm.', tone: 'plain' })
  if (report.air.made > 0) add(t, { kind: 'float', at: 'life', text: `+${report.air.made} 💨`, tone: 'good' })
  if (report.food.made > 0) add(t + 0.3, { kind: 'float', at: 'farm', text: `+${report.food.made} 🥕`, tone: 'good' })
  const worked = (job: JobId) => report.crew.filter((m) => m.job === job).reduce((sum, m) => sum + m.points, 0)
  if (worked('lab') > 0) add(t + 0.6, { kind: 'float', at: 'lab', text: `+${worked('lab')} 🛡️ research`, tone: 'good' })
  if (worked('build') > 0) add(t + 0.9, { kind: 'float', at: 'site', text: `+${worked('build')} 🏗️ built`, tone: 'good' })
  if (report.missions.after.sun > report.missions.before.sun) add(t + 1.2, { kind: 'float', at: 'scope', text: '+1 🔭 day of watching', tone: 'good' })
  for (const member of report.crew) {
    if (member.job !== 'repair') continue
    const mended = member.fixedModule ? `🔧 ${MODULES[member.fixedModule].name} fixed!` : member.fixedPanels > 0 ? `🔧 +${member.fixedPanels} ⚡ panels mended` : null
    add(t + 0.4, { kind: 'float', at: { who: member.id }, text: mended ?? '🔧 Repair not finished', tone: mended ? 'good' : 'warn' })
  }
  add(t + 0.3, {
    kind: 'hud',
    patch: {
      air: before.air + report.air.made,
      food: before.food + report.food.made,
      missions: { ...report.missions.after },
      panelsDead: Math.min(after.solar, after.solarLoss),
    },
  })
  for (const member of report.crew) {
    if (!member.cameHome || !member.trip) continue
    add(Math.max(0, t - 1.6), { kind: 'rover-in', who: member.id, act: 'idle' })
    add(t + 1.8, {
      kind: 'float',
      at: { who: member.id },
      text: member.trip === 'pod' ? `📦 +${RULES.podFood} 🥕 +${RULES.podAir} 💨` : `✓ ${TRIPS[member.trip].brings}`,
      tone: 'good',
    })
  }
  if (report.finished.length > 0) {
    report.finished.forEach((id, index) => {
      add(t + 2 + index * 0.3, { kind: 'fx', fx: 'celebrate', place: MISSION_PLACE[id] })
    })
    const names = report.finished.map((id) => MISSIONS[id].name).join(' and ')
    add(t + 2, { kind: 'caption', text: `⭐ Mission complete: ${names}! ${MISSIONS[report.finished[0]].reward}`, tone: 'good' })
    t += 2.4
  }
  t += 2.8

  // Home for dinner.
  add(t, { kind: 'time', label: 'Evening' })
  add(t, { kind: 'caption', text: 'Evening. Home for dinner.', tone: 'plain' })
  for (const member of report.crew) {
    const stillAway = !!after.crew.find((a) => a.id === member.id)?.away
    if (stillAway || member.job === 'sickbay') continue
    add(t + 0.1, { kind: 'go', who: member.id, act: 'idle' })
  }
  t += 3.6

  const fed = (id: string, ate: boolean) => (ate ? RULES.fullFed : Math.max(0, (stats[id]?.fed ?? RULES.fullFed) - 1))
  add(t, {
    kind: 'hud',
    patch: {
      air: report.air.left,
      food: report.food.left,
      crew: Object.fromEntries(report.crew.map((m) => [m.id, { health: m.healthAfter, mood: m.moodAfter, fed: fed(m.id, m.ate) }])),
    },
  })
  if (report.notes.some((note) => note.startsWith('The air ran low'))) {
    add(t, { kind: 'caption', text: 'The air ran low! Everyone feels ill.', tone: 'bad' })
  } else if (report.food.eaten < report.crew.length) {
    add(t, { kind: 'caption', text: 'There was not enough food for everyone.', tone: 'warn' })
  }
  let shown = 0
  for (const member of report.crew) {
    const mood = member.moodAfter - member.moodBefore
    const health = member.healthAfter - (member.healthBefore - member.hurt)
    // Say who: "with a friend, annoyed" on one line tells the player nothing they can act on.
    const words = (reason: Why) =>
      reason === 'friend' && member.friend
        ? `happy beside ${crewInfo(member.friend).name}`
        : reason === 'rival' && member.rival
          ? `grumpy beside ${crewInfo(member.rival).name}`
          : WHY_WORDS[reason]
    const reasons = member.why.map(words)
    const why = reasons.slice(0, 3).join(', ')
    const parts: string[] = []
    // A mood that is already full cannot go up: say so, or "±0 loves this job" reads like a bug.
    const steady = member.moodAfter >= RULES.maxStat ? 'full' : '±0'
    if (mood !== 0 || why) parts.push(`☺ ${mood === 0 ? steady : signed(mood)}`)
    if (health !== 0) parts.push(`♥ ${signed(health)}`)
    if (why) parts.push(why)
    if (parts.length === 0) continue
    // The words over a head stay short; the log gets every reason.
    const full = why ? [...parts.slice(0, -1), reasons.join(', ')].join('  ') : parts.join('  ')
    add(t + shown * EVENING_GAP, { kind: 'float', at: { who: member.id }, text: parts.join('  '), log: full, tone: mood < 0 || health < 0 ? 'bad' : 'good', named: true })
    shown += 1
  }
  // Leave the last line up long enough to be read.
  t += Math.max(2.8, (shown - 1) * EVENING_GAP + FLOAT_SECONDS)
  add(t, { kind: 'end' })
  return cues
}

/** Moves every cue later by the same amount, to play one script after another. */
export function later(cues: Cue[], seconds: number): Cue[] {
  return cues.map((cue) => ({ ...cue, t: cue.t + seconds }))
}
