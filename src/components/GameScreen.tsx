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
  powerAvailable,
  powerUsed,
  poweredModules,
} from '../game/outpost.ts'
import { sunActivity, weatherOn, yesterdayOf } from '../game/weather.ts'
import type { PlaceId } from '../scene/layout.ts'
import { Scene, type SceneEffect } from '../scene/Scene.tsx'
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

/** The main screen: the living base, with a few numbers around it. */
export function GameScreen(props: Props) {
  const { info, game, plan, selected, phase, dayKey, script, speed, effect, guideNew } = props
  // The numbers shown while a day plays. They belong to one day: "day" says which.
  const [played, setPlayed] = useState<{ day: number; hud: Hud } | null>(null)
  const hud = played && played.day === dayKey ? played.hud : null
  const [caption, setCaption] = useState<LogLine | null>(null)
  const [log, setLog] = useState<LogLine[]>([])
  const [timeLabel, setTimeLabel] = useState('Morning')
  const [toast, setToast] = useState<{ text: string; key: number } | null>(null)

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
      const line = { text: cue.text, tone: cue.tone }
      setCaption(line)
      setLog((lines) => [...lines, line])
    } else if (cue.kind === 'time') {
      setTimeLabel(cue.label)
      if (cue.label === 'Morning') setLog([])
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
    const problem = jobProblem(game, plan, id, job)
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
      if (job && !jobProblem(game, plan, selected, job)) targets.push(place)
    }
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
            detail={planning ? `after today: ${preview.air.left}` : ''}
            tone={!planning ? 'good' : preview.air.left < game.crew.length ? 'bad' : preview.air.left < game.crew.length * 2 ? 'warn' : 'good'}
          />
          <Meter
            icon="🥕"
            label="Food"
            value={String(shown.food)}
            detail={planning ? `after today: ${preview.food.left}` : ''}
            tone={!planning ? 'good' : preview.food.left < game.crew.length ? 'bad' : preview.food.left < game.crew.length * 2 ? 'warn' : 'good'}
          />
        </div>
      </header>

      <div className="stage">
        <aside className="crew-col">
          {game.crew.map((astronaut) => {
            const stats = shown.crew[astronaut.id] ?? astronaut
            const state = condition({ ...astronaut, health: stats.health, mood: stats.mood })
            const job = plan.jobs[astronaut.id]
            const problem = job && !astronaut.away ? jobProblem(game, plan, astronaut.id, job) : null
            const away = astronaut.away
            const picked = planning && selected === astronaut.id
            const real: Job | undefined = problem ? { kind: astronaut.health <= 1 ? 'sickbay' : 'rest' } : job
            const jobLabel = away
              ? `🚙 ${TRIPS[away.trip].name} · ${plural(away.daysLeft, 'day')} left`
              : real
                ? `${JOB_ICONS[real.kind]} ${real.kind === 'trip' && real.trip ? TRIPS[real.trip].name : JOBS[real.kind].name}`
                : '🛋️ Rest'
            return (
              <div key={astronaut.id} className={`crew-card state-${state}${picked ? ' picked' : ''}`}>
                <button type="button" className="crew-head" disabled={!!away || !planning} onClick={() => props.onSelect(picked ? null : astronaut.id)} aria-expanded={picked}>
                  <Avatar id={astronaut.id} />
                  <span className="crew-main">
                    <span className="crew-name">
                      {crewInfo(astronaut.id).name}
                      {state !== 'well' && <span className={`tag tag-${state}`}>{CONDITION_WORDS[state]}</span>}
                    </span>
                    <span className="crew-stats">
                      <Pips label="Health" icon="♥" value={stats.health} max={RULES.maxStat} tone="health" />
                      <Pips label="Mood" icon="☺" value={stats.mood} max={RULES.maxStat} tone="mood" />
                      <Pips label="Fed" icon="●" value={stats.fed} max={RULES.fullFed} tone="fed" />
                    </span>
                    <span className="crew-job">{jobLabel}</span>
                  </span>
                </button>
              </div>
            )
          })}
          {game.arriving && <p className="hint">🚀 {crewInfo(game.arriving).name} lands tomorrow morning.</p>}

          <ul className="goals" aria-label="Missions">
            {MISSION_IDS.map((id) => {
              const done = missionDone(shown.missions, id)
              return (
                <li key={id} className={done ? 'goal done' : 'goal'} title={`${MISSIONS[id].how} Reward: ${MISSIONS[id].reward}`}>
                  <span className="goal-name">
                    {done ? '✅' : MISSION_ICONS[id]} {MISSIONS[id].name}
                  </span>
                  <span className="bar">
                    <span className="bar-fill" style={{ width: `${Math.min(100, (100 * shown.missions[id]) / MISSIONS[id].goal)}%` }} />
                  </span>
                  <span className="goal-count">
                    {Math.min(shown.missions[id], MISSIONS[id].goal)}/{MISSIONS[id].goal}
                  </span>
                </li>
              )
            })}
            <li
              className={handoverReady(game) ? 'goal done' : 'goal'}
              title={`On the last day: at least ${RULES.handover.air} air and ${RULES.handover.food} food, and everyone at ${RULES.handover.stat} or more for health and mood.`}
            >
              <span className="goal-name">🤝 Hand over the base</span>
              <span className="goal-count">{handoverReady(game) ? 'ready now' : 'not ready'}</span>
            </li>
          </ul>

          <section className="radio" aria-label="Messages from Mission Control">
            <h2>📡 Mission Control</h2>
            {planning && (
              <p>
                {game.radioYesterday ? (
                  <>
                    Yesterday the Sun fired {yesterday.flareCount === 0 ? 'no flares' : plural(yesterday.flareCount, 'flare')}
                    {yesterday.strongestFlare ? ` (biggest: ${yesterday.strongestFlare})` : ''}. The Sun is{' '}
                    <strong className={`activity-${activity.replace(' ', '-')}`}>{activity}</strong>.
                  </>
                ) : (
                  <>No Sun report: the Radio Dish was off yesterday.</>
                )}{' '}
                {on.includes('comms') ? 'Radio on: we will call if there is a big flare.' : 'Radio off: we cannot warn you today.'}
              </p>
            )}
            {log.length > 0 && (
              <ul className="radio-log">
                {planning && <li className="radio-when">Yesterday:</li>}
                {log.map((line, index) => (
                  <li key={index} className={`tone-${line.tone}`}>
                    {line.text}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>

        <section className="scene-wrap">
          <Scene game={game} plan={plan} dayKey={dayKey} script={script} speed={speed} selected={planning ? selected : null} targets={targets} effect={effect} onPick={onPick} onCue={onCue} />

          {planning ? (
            <div className="subtitle plain">
              {selected
                ? `👉 Now click where ${crewInfo(selected).name} should go.`
                : '👉 Click a ⚡ switch to turn a module on. Click an astronaut, then a place. Then start the day.'}
            </div>
          ) : (
            caption && (
              <div className={`subtitle tone-${caption.tone}`} key={caption.text}>
                {caption.text}
              </div>
            )
          )}

          {planning && selected && <JobMenu astronautId={selected} game={game} plan={plan} onAssign={(choice) => assign(selected, choice)} onClose={() => props.onSelect(null)} />}

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
      </div>
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

function Meter({ icon, label, value, detail, tone }: { icon: string; label: string; value: string; detail: string; tone: 'good' | 'warn' | 'bad' | 'calm' }) {
  return (
    <div className={`meter tone-${tone}`}>
      <span className="meter-icon" aria-hidden="true">{icon}</span>
      <span className="meter-main">
        <span className="meter-label">{label}</span>
        <strong>{value}</strong>
      </span>
      {detail && <span className="meter-detail">{detail}</span>}
    </div>
  )
}

/** The list of jobs that opens beside an astronaut's card. */
function JobMenu({ astronautId, game, plan, onAssign, onClose }: { astronautId: string; game: GameState; plan: Plan; onAssign: (job: Job) => void; onClose: () => void }) {
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
  return (
    <div className="job-menu">
      <button type="button" className="job-menu-close" onClick={onClose} aria-label="Close">
        ✕
      </button>
      <p className="job-menu-about">
        <strong>{info.name}</strong> loves {info.lovesText}. {info.about} {relationshipLine(astronautId, game)}
        {willBeTired && <span className="tired"> Has worked {astronaut?.streak} days in a row: one more and {info.name} is tired.</span>}
      </p>
      <div className="job-grid">
        {choices.map((choice) => {
          const why = jobProblem(game, plan, astronautId, choice.job)
          const chosen = current?.kind === choice.job.kind && current?.trip === choice.job.trip
          return (
            <button key={`${choice.job.kind}-${choice.job.trip ?? ''}`} type="button" className={`job${chosen ? ' chosen' : ''}`} disabled={!!why} onClick={() => onAssign(choice.job)}>
              <span className="job-title">
                {JOB_ICONS[choice.job.kind]} {choice.label}
                {info.loves.includes(choice.job.kind) && <span className="heart" title={`${info.name} loves this`}> ♥</span>}
              </span>
              <span className="job-does">{why ?? choice.does}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function relationshipLine(id: string, game: GameState): string {
  const onCrew = (other: string) => game.crew.some((member) => member.id === other)
  const lines: string[] = []
  for (const [a, b] of FRIENDS) {
    const other = a === id ? b : b === id ? a : null
    if (other && onCrew(other)) lines.push(`Happier beside ${crewInfo(other).name}.`)
  }
  for (const [a, b] of CLASHES) {
    const other = a === id ? b : b === id ? a : null
    if (other && onCrew(other)) lines.push(`Annoyed when stuck with ${crewInfo(other).name}.`)
  }
  return lines.join(' ')
}
