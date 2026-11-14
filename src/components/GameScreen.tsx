import { useEffect, useRef, useState } from 'react'
import type { ScenarioInfo } from '../data/scenarios.ts'
import {
  CLASHES,
  FRIENDS,
  JOBS,
  JOB_IDS,
  MISSIONS,
  MISSION_IDS,
  MODULES,
  MODULE_IDS,
  TRIPS,
  crewInfo,
  type JobId,
  type MissionId,
  type ModuleId,
} from '../game/content.ts'
import {
  RULES,
  type GameState,
  type Job,
  type Plan,
  availableTrips,
  calmPreview,
  canRun,
  condition,
  handoverReady,
  jobProblem,
  missionDone,
  panelsFixed,
  powerAvailable,
  powerUsed,
  poweredModules,
  workPoints,
} from '../game/outpost.ts'
import { sunActivity, weatherOn, yesterdayOf } from '../game/weather.ts'
import type { PlaceId } from '../scene/layout.ts'
import { Scene, type Anchor, type SceneEffect } from '../scene/Scene.tsx'
import { hudOf, type Cue, type Hud, type Tone } from '../scene/script.ts'
import type { Pick } from '../scene/world.ts'
import { Avatar } from './Avatar.tsx'
import { Pips } from './bits.tsx'
import { CONDITION_WORDS, JOB_ICONS, MISSION_ICONS, longDate, plural } from './words.ts'

interface Props {
  info: ScenarioInfo
  game: GameState
  plan: Plan
  selected: string | null
  /** 'plan': the commander is giving orders. 'play': the day is playing out. */
  phase: 'plan' | 'play'
  dayKey: number
  script: Cue[] | null
  speed: number
  effect: SceneEffect | null
  /** How many entries in the field guide the player has not looked at yet. */
  guideNew: number
  onGuide: () => void
  onSelect: (astronautId: string | null) => void
  onTogglePower: (module: ModuleId) => void
  onAssign: (astronautId: string, job: Job) => void
  onStart: () => void
  onHelp: () => void
  onAlert: () => void
  onDayEnd: () => void
  onSpeed: () => void
}

interface LogLine {
  text: string
  tone: Tone
}

/** The job done at a place, for "pick someone, then click where they should go". */
function jobAt(place: PlaceId, game: GameState): Job | null {
  switch (place) {
    case 'farm':
      return game.broken.includes('farm') ? { kind: 'repair' } : { kind: 'garden' }
    case 'lab':
      return game.broken.includes('lab') ? { kind: 'repair' } : { kind: 'lab' }
    case 'site':
      return { kind: 'build' }
    case 'panels':
      return { kind: 'repair' }
    case 'habitat':
      return { kind: 'rest' }
    case 'garage': {
      if (game.broken.includes('garage')) return { kind: 'repair' }
      const trips = availableTrips(game)
      return trips.length > 0 ? { kind: 'trip', trip: trips[0] } : null
    }
    case 'life':
    case 'comms':
    case 'scope':
      return game.broken.includes(place) ? { kind: 'repair' } : null
    default:
      return null
  }
}

const PLACE_HINTS: Partial<Record<PlaceId, string>> = {
  shelter: 'The storm shelter. You can send everyone here when a flare alert comes in.',
  habitat: 'The crew quarters. Pick an astronaut first, then click here to let them rest.',
  panels: 'The solar panels make all the power. Pick an astronaut, then click here to repair them.',
  site: 'The radio telescope is built here. Pick an astronaut, then click here to build.',
}

/**
 * What each part of the base is for, in one short line, for when the mouse is over it.
 * Only that. Whether it is on, off or broken is already shown in the picture, and how
 * to play is not its business.
 */
const PLACE_WORDS: Record<PlaceId, [name: string, purpose: string]> = {
  habitat: ['Crew quarters', 'Where the crew eats, rests and sleeps.'],
  life: ['Life Support', 'Makes the air the crew breathes.'],
  farm: ['Greenhouse', "Grows the crew's food."],
  lab: ['Lab', 'Research into a Moon-soil shield against storms.'],
  garage: ['Rover Bay', 'Charges the rover for trips far from the base.'],
  comms: ['Radio Dish', 'Lets Mission Control warn you about the Sun.'],
  scope: ['Sun Telescope', 'Shows whether a flare could bring a storm.'],
  shelter: ['Storm shelter', 'The safest place when a storm comes.'],
  panels: ['Solar panels', "Make all of the base's power."],
  site: ['Radio telescope', 'Built here, piece by piece.'],
}

/** Where each mission is done. Pointing at one lights up the other, so the two are easy to match. */
const MISSION_PLACE: Record<MissionId, PlaceId> = { ice: 'garage', shield: 'lab', dish: 'site', sun: 'scope' }
const missionAt = (place: PlaceId): MissionId | null => MISSION_IDS.find((id) => MISSION_PLACE[id] === place) ?? null

/**
 * What one day of this job makes when this astronaut does it, in a few characters: "+2 🥕".
 * It is shown at the moment of choosing, so nobody has to remember the rules.
 */
function jobOutput(game: GameState, astronautId: string, job: Job): string | null {
  const astronaut = game.crew.find((member) => member.id === astronautId)
  if (!astronaut) return null
  const points = workPoints(astronaut, job.kind)
  if (points === 0) return null
  if (job.kind === 'garden') return `+${points} 🥕`
  if (job.kind === 'lab') return `+${points} ${MISSION_ICONS.shield}`
  if (job.kind === 'build') return `+${points} ${MISSION_ICONS.dish}`
  // A repair mends a broken module first; only with none broken does it bring panels back.
  if (job.kind === 'repair' && game.broken.length === 0) return `+${panelsFixed(game.solarLoss, points)} ⚡`
  return null
}

/**
 * Why this astronaut cannot be given this job, or null if they can. Giving someone a rover
 * trip takes the rover from whoever was going to drive, so a trip is checked as if nobody
 * else had been given one.
 */
function choiceProblem(game: GameState, plan: Plan, astronautId: string, job: Job): string | null {
  if (job.kind !== 'trip') return jobProblem(game, plan, astronautId, job)
  const jobs = Object.fromEntries(Object.entries(plan.jobs).filter(([id, other]) => id === astronautId || other.kind !== 'trip'))
  return jobProblem(game, { ...plan, jobs }, astronautId, job)
}

/** What the base still lacks for a good handover to the next crew, as a few short words each. */
function handoverNeeds(game: GameState): string[] {
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

/** The main screen: the living base, with a few numbers around it. */
export function GameScreen(props: Props) {
  const { info, game, plan, selected, phase, dayKey, script, speed, effect, guideNew } = props
  // The numbers shown while a day plays. They belong to one day: "day" says which.
  const [played, setPlayed] = useState<{ day: number; hud: Hud } | null>(null)
  const hud = played && played.day === dayKey ? played.hud : null
  const [caption, setCaption] = useState<LogLine | null>(null)
  // Where the picked astronaut stands on the picture: the job menu opens beside them.
  const [anchor, setAnchor] = useState<Anchor | null>(null)
  const [timeLabel, setTimeLabel] = useState('Morning')
  const [toast, setToast] = useState<{ text: string; key: number } | null>(null)
  const [hovered, setHovered] = useState<Pick | null>(null)
  // The row of the mission window the mouse is over.
  const [goalOver, setGoalOver] = useState<MissionId | 'handover' | null>(null)

  const toastCount = useRef(0)
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 3200)
    return () => clearTimeout(timer)
  }, [toast])

  const say = (text: string) => {
    toastCount.current += 1
    setToast({ text, key: toastCount.current })
  }

  const weather = weatherOn(info.scenario, game.day)
  const shown = phase === 'play' && hud ? hud : hudOf(game)
  const available = powerAvailable(game)
  const used = powerUsed(game, plan)
  const on = poweredModules(game, plan)
  const preview = calmPreview(game, info.scenario, plan)
  const planning = phase === 'plan'

  const onCue = (cue: Cue) => {
    if (cue.kind === 'caption') {
      setCaption({ text: cue.text, tone: cue.tone })
    } else if (cue.kind === 'time') {
      setTimeLabel(cue.label)
    } else if (cue.kind === 'hud') {
      setPlayed((current) => ({ day: dayKey, hud: { ...(current && current.day === dayKey ? current.hud : hudOf(game)), ...cue.patch } }))
    } else if (cue.kind === 'alert') {
      props.onAlert()
    } else if (cue.kind === 'end') {
      props.onDayEnd()
    }
  }

  const togglePower = (module: ModuleId) => {
    const turningOn = !plan.power[module] || !on.includes(module)
    if (turningOn) {
      if (game.broken.includes(module)) return say(`The ${MODULES[module].name} is broken. Give someone the Repair job.`)
      if (!canRun(game, module)) return say(`The ${MODULES[module].name} cannot run today.`)
      if (MODULES[module].power > available - used) return say(`Not enough power left for the ${MODULES[module].name}. Switch something else off first.`)
    }
    props.onTogglePower(module)
  }

  const assign = (id: string, job: Job) => {
    const problem = choiceProblem(game, plan, id, job)
    if (problem) return say(problem)
    props.onAssign(id, job)
    props.onSelect(null)
  }

  const onPick = (pick: Pick | null) => {
    if (!planning) return
    if (!pick) return props.onSelect(null)
    if (pick.kind === 'pawn') return props.onSelect(selected === pick.id ? null : pick.id)
    if (pick.kind === 'switch') return togglePower(pick.module)
    const place = pick.id
    if (selected) {
      const job = jobAt(place, game)
      if (!job) return say(place === 'shelter' ? PLACE_HINTS.shelter! : `There is no job for ${crewInfo(selected).name} there today.`)
      return assign(selected, job)
    }
    const module = (['life', 'farm', 'comms', 'scope', 'lab', 'garage'] as PlaceId[]).includes(place) ? (place as ModuleId) : null
    if (module) return togglePower(module)
    say(PLACE_HINTS[place] ?? 'Pick an astronaut first.')
  }

  // The places that light up while someone is picked.
  const targets: PlaceId[] = []
  if (planning && selected) {
    for (const place of ['farm', 'lab', 'site', 'panels', 'habitat', 'garage', 'life', 'comms', 'scope'] as PlaceId[]) {
      const job = jobAt(place, game)
      if (job && !choiceProblem(game, plan, selected, job)) targets.push(place)
    }
  } else if (goalOver && goalOver !== 'handover') {
    // Pointing at a mission lights up the place where it is done.
    targets.push(MISSION_PLACE[goalOver])
  }

  // What the bottom bar says about the thing under the mouse: a name and one short line.
  let hover: [name: string, line: string] | null = null
  // The mission that goes with the place under the mouse, if there is one.
  let hoverMission: MissionId | null = null
  if (goalOver === 'handover') {
    const { air, food, stat } = RULES.handover
    hover = ['Hand over the base', `End with ${air} air, ${food} food, and everyone at ${stat} or more for health and mood. Reward: one more star.`]
  } else if (goalOver) {
    hover = [MISSIONS[goalOver].name, `${MISSIONS[goalOver].how} Reward: ${MISSIONS[goalOver].reward}`]
  } else if (hovered?.kind === 'place' || hovered?.kind === 'switch') {
    const place: PlaceId = hovered.kind === 'place' ? hovered.id : hovered.module
    hover = PLACE_WORDS[place]
    hoverMission = missionAt(place)
    // With someone picked, the question changes to "what happens if I click here?".
    const job = planning && selected && hovered.kind === 'place' ? jobAt(place, game) : null
    if (job && selected) {
      const problem = choiceProblem(game, plan, selected, job)
      const work = job.kind === 'trip' && job.trip ? TRIPS[job.trip].name : JOBS[job.kind].name
      const out = jobOutput(game, selected, job)
      hover = problem ? [crewInfo(selected).name, problem] : [`${crewInfo(selected).name} →`, out ? `${work}  ${out}` : work]
      hoverMission = null
    }
  } else if (hovered?.kind === 'pawn' && planning) {
    const who = crewInfo(hovered.id)
    hover = [who.name, `Loves ${who.lovesText}.`]
  }

  const yesterday = yesterdayOf(info.scenario, game.day)
  const activity = sunActivity(yesterday)

  return (
    <main className="game">
      <header className="topbar">
        <div className="topbar-day">
          <strong>
            Day {game.day} of {RULES.maxDays}
          </strong>
          <span className="real-date">{longDate(weather.date)}</span>
          <span className={`tag tag-${info.difficulty.replace(' ', '-').toLowerCase()}`}>{info.title}</span>
          <button type="button" className="help" onClick={props.onHelp} disabled={!planning}>
            ? How to play
          </button>
          <button type="button" className={guideNew > 0 ? 'help guide-button fresh' : 'help guide-button'} onClick={props.onGuide} disabled={!planning}>
            📖 Field guide
            {guideNew > 0 && <span className="guide-new">{guideNew} new</span>}
          </button>
        </div>

        <div className="meters">
          <Meter icon="⚡" label="Power" value={`${available - used}`} detail={`left of ${available}`} tone={available - used === 0 ? 'calm' : 'good'} />
          <Meter
            icon="💨"
            label="Air"
            value={String(shown.air)}
            gold={shown.air >= RULES.handover.air}
            detail={planning ? `after today: ${preview.air.left}` : ''}
            tone={!planning ? 'good' : preview.air.left < game.crew.length ? 'bad' : preview.air.left < game.crew.length * 2 ? 'warn' : 'good'}
          />
          <Meter
            icon="🥕"
            label="Food"
            value={String(shown.food)}
            gold={shown.food >= RULES.handover.food}
            detail={planning ? `after today: ${preview.food.left}` : ''}
            tone={!planning ? 'good' : preview.food.left < game.crew.length ? 'bad' : preview.food.left < game.crew.length * 2 ? 'warn' : 'good'}
          />
        </div>
      </header>

      {/* The picture is the game. Everything else floats over it. */}
      <section className="scene-wrap">
        <Scene game={game} plan={plan} dayKey={dayKey} script={script} speed={speed} selected={planning ? selected : null} targets={targets} effect={effect} onPick={onPick} onHover={setHovered} onCue={onCue} onAnchor={setAnchor} />

        {/* The crew, as small portraits. They only show how everyone is: orders are given on the picture. */}
        <ul className="crew-strip" aria-label="Crew">
          {game.crew.map((astronaut) => {
            const stats = shown.crew[astronaut.id] ?? astronaut
            const state = condition({ ...astronaut, health: stats.health, mood: stats.mood })
            const away = astronaut.away
            const picked = planning && selected === astronaut.id
            return (
              <li key={astronaut.id} className={`crew-chip state-${state}${picked ? ' picked' : ''}`}>
                <Avatar id={astronaut.id} size={34} />
                <span className="crew-main">
                  <span className="crew-name">
                    {crewInfo(astronaut.id).name}
                    {away ? <span className="crew-away">🚙 {plural(away.daysLeft, 'day')} left</span> : state !== 'well' && <span className={`tag tag-${state}`}>{CONDITION_WORDS[state]}</span>}
                  </span>
                  <span className="crew-stats">
                    <Pips label="Health" icon="♥" value={stats.health} max={RULES.maxStat} tone="health" />
                    <Pips label="Mood" icon="☺" value={stats.mood} max={RULES.maxStat} tone="mood" />
                    <Pips label="Fed" icon="●" value={stats.fed} max={RULES.fullFed} tone="fed" />
                  </span>
                </span>
              </li>
            )
          })}
          {game.arriving && <li className="crew-note">🚀 {crewInfo(game.arriving).name} lands tomorrow.</li>}
        </ul>

        {/* The missions, and the fifth star. */}
        <ul className="goals" aria-label="Missions">
          {MISSION_IDS.map((id) => {
            const done = missionDone(shown.missions, id)
            return (
              <li key={id} className={`goal${done ? ' done' : ''}${hoverMission === id || goalOver === id ? ' lit' : ''}`} onMouseEnter={() => setGoalOver(id)} onMouseLeave={() => setGoalOver(null)}>
                <span className="goal-name">
                  {done ? '✅' : MISSION_ICONS[id]} {MISSIONS[id].name}
                </span>
                <span className="goal-count">
                  {Math.min(shown.missions[id], MISSIONS[id].goal)}/{MISSIONS[id].goal}
                </span>
                <span className="bar">
                  <span className="bar-fill" style={{ width: `${Math.min(100, (100 * shown.missions[id]) / MISSIONS[id].goal)}%` }} />
                </span>
              </li>
            )
          })}
          <li className={`goal${handoverReady(game) ? ' done' : ''}${goalOver === 'handover' ? ' lit' : ''}`} onMouseEnter={() => setGoalOver('handover')} onMouseLeave={() => setGoalOver(null)}>
            <span className="goal-name">🤝 Hand over the base</span>
            <span className="goal-count">{handoverReady(game) ? 'ready' : 'not yet'}</span>
            {/* The fifth star. Say what is still missing, so it is never a surprise at the end. */}
            {!handoverReady(game) && <span className="goal-needs">Needs {handoverNeeds(game).join(', ')}.</span>}
          </li>
        </ul>

        {/* One line at the bottom: what is under the mouse, or what Mission Control says right now. */}
        {hover ? (
          <div className="subtitle info">
            <strong>{hover[0]}</strong> {hover[1]}
            {hoverMission && (
              <span className="mission-chip">
                {MISSION_ICONS[hoverMission]} Mission: {MISSIONS[hoverMission].name}
              </span>
            )}
          </div>
        ) : planning ? (
          <div className="subtitle plain">
            {selected ? (
              `👉 Pick a job for ${crewInfo(selected).name}, or click a place.`
            ) : game.day === 1 ? (
              '👉 Click an astronaut to give them a job. Click a ⚡ switch to share out the power.'
            ) : game.radioYesterday ? (
              <>
                📡 Yesterday the Sun fired {yesterday.flareCount === 0 ? 'no flares' : plural(yesterday.flareCount, 'flare')}
                {yesterday.strongestFlare ? ` (biggest: ${yesterday.strongestFlare})` : ''}. The Sun is{' '}
                <strong className={`activity-${activity.replace(' ', '-')}`}>{activity}</strong>.
              </>
            ) : (
              '📡 No Sun report: the Radio Dish was off yesterday.'
            )}
          </div>
        ) : (
          caption && (
            <div className={`subtitle tone-${caption.tone}`} key={caption.text}>
              {caption.text}
            </div>
          )
        )}

        {planning && selected && <JobMenu astronautId={selected} game={game} plan={plan} anchor={anchor} onAssign={(choice) => assign(selected, choice)} onClose={() => props.onSelect(null)} />}

          {/* On a small screen the switches in the picture are too small to tap: big ones go here. */}
          {planning && (
            <div className="power-row">
              {MODULE_IDS.map((module) => (
                <button key={module} type="button" className={on.includes(module) ? 'power-chip on' : 'power-chip'} onClick={() => togglePower(module)}>
                  ⚡{MODULES[module].power} {MODULES[module].name}
                </button>
              ))}
            </div>
          )}

          {toast && (
            <div className="toast" key={toast.key} role="status">
              {toast.text}
            </div>
          )}

        <div className="dock">
            {planning ? (
              <>
                <div className="warnings">
                  {!on.includes('comms') && <span className="note warn">📡 Radio off: no storm alerts today.</span>}
                  {preview.air.left < game.crew.length && <span className="note bad">💨 The air will run low tomorrow.</span>}
                  {preview.food.left < game.crew.length && <span className="note bad">🥕 Not enough food for tomorrow.</span>}
                  {on.includes('lab') && !someoneDoes(game, plan, 'lab') && <span className="note warn">🧪 Lab on, but nobody is researching.</span>}
                  {on.includes('garage') && !someoneDoes(game, plan, 'trip') && <span className="note warn">🚙 Rover Bay on, but nobody is driving.</span>}
                  {available - used > RULES.batteryCap && (
                    <span className="note">🔋 The battery only saves {RULES.batteryCap}. {available - used - RULES.batteryCap} power will be wasted.</span>
                  )}
                </div>
                <button type="button" className="primary" onClick={props.onStart}>
                  Start day {game.day} ▶
                </button>
              </>
            ) : (
              <div className="clock">
                <span className="clock-label">{timeLabel}</span>
                <button type="button" className="speed" onClick={props.onSpeed}>
                  {speed > 1 ? '▶ Normal speed' : '⏩ Faster'}
                </button>
              </div>
            )}
        </div>
      </section>
    </main>
  )
}

/** True when at least one astronaut is set to do this job today and really can. */
function someoneDoes(game: GameState, plan: Plan, kind: JobId): boolean {
  return game.crew.some((astronaut) => {
    const job = plan.jobs[astronaut.id]
    return !astronaut.away && job?.kind === kind && !jobProblem(game, plan, astronaut.id, job)
  })
}

/** A number in the top bar. `gold` means it is high enough for the handover star. */
function Meter({ icon, label, value, detail, tone, gold = false }: { icon: string; label: string; value: string; detail: string; tone: 'good' | 'warn' | 'bad' | 'calm'; gold?: boolean }) {
  return (
    <div className={`meter tone-${tone}${gold ? ' gold' : ''}`}>
      <span className="meter-icon" aria-hidden="true">{icon}</span>
      <span className="meter-main">
        <span className="meter-label">{label}</span>
        <strong>{value}</strong>
      </span>
      {detail && <span className="meter-detail">{detail}</span>}
    </div>
  )
}

const MENU_WIDTH = 288
const MENU_HEIGHT = 520

/**
 * The list of jobs. It opens on the picture, just left of the crew quarters where the
 * astronaut stands. That way it covers none of the crew, and the places people are sent
 * to (greenhouse, lab, building site, rover bay) stay in view and can still be clicked.
 */
function JobMenu({ astronautId, game, plan, anchor, onAssign, onClose }: { astronautId: string; game: GameState; plan: Plan; anchor: Anchor | null; onAssign: (job: Job) => void; onClose: () => void }) {
  const info = crewInfo(astronautId)
  const astronaut = game.crew.find((member) => member.id === astronautId)
  const current = plan.jobs[astronautId]
  const choices: { job: Job; label: string; does: string }[] = []
  for (const kind of JOB_IDS) {
    if (kind === 'trip') {
      for (const trip of availableTrips(game)) {
        choices.push({ job: { kind, trip }, label: `${TRIPS[trip].name} (${plural(TRIPS[trip].days, 'day')})`, does: `Brings: ${TRIPS[trip].brings}. Outside!` })
      }
    } else {
      choices.push({ job: { kind }, label: JOBS[kind].name, does: JOBS[kind].does })
    }
  }
  const willBeTired = !!astronaut && astronaut.streak + 1 >= RULES.tiredAfter

  let place: { left: number; top: number; maxHeight: number } | undefined
  if (anchor) {
    const edge = Math.min(anchor.x - 44, anchor.roomLeft - 10)
    const left = edge - MENU_WIDTH >= 8 ? edge - MENU_WIDTH : Math.max(8, Math.min(anchor.x + 44, anchor.width - MENU_WIDTH - 8))
    const maxHeight = Math.min(MENU_HEIGHT, anchor.height - 16)
    const top = Math.max(8, Math.min(anchor.y - maxHeight * 0.8, anchor.height - maxHeight - 8))
    place = { left, top, maxHeight }
  }

  return (
    <div className="job-menu" style={place}>
      <button type="button" className="job-menu-close" onClick={onClose} aria-label="Close">
        ✕
      </button>
      {/* Only what changes which job is the right one: what they love, who they get on
          with, and whether they need a day off. Each one is a short tag, easy to scan. */}
      <p className="job-menu-about">
        <strong>{info.name}</strong>
        <span className="trait love">♥ Loves {info.lovesText}</span>
        {companions(astronautId, FRIENDS, game).map((name) => (
          <span key={name} className="trait friend">☺ Happier beside {name}</span>
        ))}
        {companions(astronautId, CLASHES, game).map((name) => (
          <span key={name} className="trait clash">☹ Grumpy beside {name}</span>
        ))}
        {willBeTired && <span className="trait tired">😴 Tired: needs a day off</span>}
      </p>
      <div className="job-list">
        {choices.map((choice) => {
          const why = choiceProblem(game, plan, astronautId, choice.job)
          const chosen = current?.kind === choice.job.kind && current?.trip === choice.job.trip
          const out = why ? null : jobOutput(game, astronautId, choice.job)
          // The number already says what the job makes: only "Outside!" is still worth a line.
          const note = why ?? (out ? (JOBS[choice.job.kind].outside ? 'Outside!' : null) : choice.does)
          return (
            <button key={`${choice.job.kind}-${choice.job.trip ?? ''}`} type="button" className={`job${chosen ? ' chosen' : ''}`} disabled={!!why} onClick={() => onAssign(choice.job)}>
              <span className="job-title">
                {out && <span className="job-out">{out}</span>}
                {JOB_ICONS[choice.job.kind]} {choice.label}
                {info.loves.includes(choice.job.kind) && <span className="heart" title={`${info.name} loves this`}> ♥</span>}
              </span>
              {note && <span className="job-does">{note}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** The names of the people on the base who are paired with this one in a list of pairs. */
function companions(id: string, pairs: [string, string][], game: GameState): string[] {
  const names: string[] = []
  for (const [a, b] of pairs) {
    const other = a === id ? b : b === id ? a : null
    if (other && game.crew.some((member) => member.id === other)) names.push(crewInfo(other).name)
  }
  return names
}
