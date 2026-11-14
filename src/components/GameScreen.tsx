import type { ScenarioInfo } from '../data/scenarios.ts'
import {
  CLASHES,
  FRIENDS,
  JOBS,
  JOB_IDS,
  MISSIONS,
  MISSION_IDS,
  TRIPS,
  crewInfo,
  type JobId,
  type ModuleId,
} from '../game/content.ts'
import {
  RULES,
  type Astronaut,
  type GameState,
  type Job,
  type Plan,
  availableTrips,
  calmPreview,
  condition,
  handoverReady,
  jobProblem,
  missionDone,
  powerAvailable,
  powerUsed,
  poweredModules,
} from '../game/outpost.ts'
import { sunActivity, weatherOn, yesterdayOf } from '../game/weather.ts'
import { BaseMap } from './BaseMap.tsx'
import { Pips, Token } from './bits.tsx'
import { CONDITION_WORDS, JOB_ICONS, longDate, plural } from './words.ts'

interface Props {
  info: ScenarioInfo
  game: GameState
  plan: Plan
  selected: string | null
  onSelect: (astronautId: string) => void
  onTogglePower: (module: ModuleId) => void
  onAssign: (astronautId: string, job: Job) => void
  onStart: () => void
}

/** The main screen: the base seen from above, and the commander's panel beside it. */
export function GameScreen({ info, game, plan, selected, onSelect, onTogglePower, onAssign, onStart }: Props) {
  const weather = weatherOn(info.scenario, game.day)
  const available = powerAvailable(game)
  const used = powerUsed(game, plan)
  const on = poweredModules(game, plan)
  const preview = calmPreview(game, info.scenario, plan)

  return (
    <main className="game">
      <header className="topbar">
        <div className="topbar-day">
          <strong>
            Day {game.day} of {RULES.maxDays}
          </strong>
          <span className="real-date" title="The Sun's weather in this mission is the real weather of this date.">
            {longDate(weather.date)} · real date
          </span>
        </div>
        <div className="meters">
          <Meter icon="⚡" label="Power" value={`${available - used} left`} detail={`${used} of ${available} used`} tone={available - used === 0 ? 'calm' : 'good'} />
          <Meter icon="💨" label="Air" value={String(game.air)} detail={`after today: ${preview.air.left}`} tone={preview.air.left < game.crew.length ? 'bad' : preview.air.left < game.crew.length * 2 ? 'warn' : 'good'} />
          <Meter icon="🥕" label="Food" value={String(game.food)} detail={`after today: ${preview.food.left}`} tone={preview.food.left < game.crew.length ? 'bad' : preview.food.left < game.crew.length * 2 ? 'warn' : 'good'} />
        </div>
      </header>

      <div className="game-body">
        <section className="map-wrap" aria-label="The base, seen from above">
          <BaseMap game={game} plan={plan} selected={selected} onTogglePower={onTogglePower} onAssign={onAssign} onSelect={onSelect} />
          <p className="map-hint">
            {selected
              ? `Now click where ${crewInfo(selected).name} should go, or pick a job in the list.`
              : 'Click ⚡ on a module to switch it on. Click an astronaut to give them a job.'}
          </p>
        </section>

        <aside className="side">
          <SunReport info={info} game={game} radioOn={on.includes('comms')} />

          <section className="panel">
            <h2>Crew</h2>
            <div className="crew-list">
              {game.crew.map((astronaut) => (
                <CrewCard
                  key={astronaut.id}
                  astronaut={astronaut}
                  game={game}
                  plan={plan}
                  open={selected === astronaut.id}
                  onSelect={() => onSelect(astronaut.id)}
                  onAssign={(job) => onAssign(astronaut.id, job)}
                />
              ))}
              {game.arriving && (
                <p className="hint">🚀 {crewInfo(game.arriving).name} lands tomorrow morning.</p>
              )}
            </div>
          </section>

          <section className="panel">
            <h2>Missions</h2>
            <ul className="missions">
              {MISSION_IDS.map((id) => {
                const done = missionDone(game.missions, id)
                return (
                  <li key={id} className={done ? 'mission done' : 'mission'}>
                    <div className="mission-head">
                      <span>{done ? '✅' : '⬜'} {MISSIONS[id].name}</span>
                      <span className="mission-count">
                        {Math.min(game.missions[id], MISSIONS[id].goal)}/{MISSIONS[id].goal}
                      </span>
                    </div>
                    <div className="bar">
                      <div className="bar-fill" style={{ width: `${Math.min(100, (100 * game.missions[id]) / MISSIONS[id].goal)}%` }} />
                    </div>
                    <p className="mission-text">
                      {done ? `Done! ${MISSIONS[id].reward}` : `${MISSIONS[id].how} Reward: ${MISSIONS[id].reward}`}
                    </p>
                  </li>
                )
              })}
              <li className={handoverReady(game) ? 'mission done' : 'mission'}>
                <div className="mission-head">
                  <span>{handoverReady(game) ? '✅' : '⬜'} Ready for the next crew</span>
                </div>
                <p className="mission-text">
                  On the last day: at least {RULES.handover.air} air and {RULES.handover.food} food, and everyone healthy and
                  happy enough to work.
                </p>
              </li>
            </ul>
          </section>
        </aside>
      </div>

      <footer className="action-bar">
        <div className="action-notes">
          {!on.includes('comms') && <span className="note warn">📡 Radio Dish is off: no storm alerts today, no Sun report tomorrow.</span>}
          {preview.air.left < game.crew.length && <span className="note bad">💨 The air will run low tomorrow.</span>}
          {preview.food.left < game.crew.length && <span className="note bad">🥕 Not enough food for tomorrow.</span>}
          {on.includes('lab') && !someoneDoes(game, plan, 'lab') && (
            <span className="note warn">🧪 The Lab is on, but nobody is doing research there.</span>
          )}
          {on.includes('garage') && !someoneDoes(game, plan, 'trip') && (
            <span className="note warn">🚙 The Rover Bay is on, but nobody is going on a trip.</span>
          )}
          {available - used > RULES.batteryCap && (
            <span className="note">🔋 The battery only saves {RULES.batteryCap} power. {available - used - RULES.batteryCap} will be wasted.</span>
          )}
        </div>
        <button type="button" className="primary" onClick={onStart}>
          Start day {game.day} ▶
        </button>
      </footer>
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
      <span className="meter-detail">{detail}</span>
    </div>
  )
}

/** The morning message from Mission Control. It only arrives if the radio was on yesterday. */
function SunReport({ info, game, radioOn }: { info: ScenarioInfo; game: GameState; radioOn: boolean }) {
  const yesterday = yesterdayOf(info.scenario, game.day)
  const activity = sunActivity(yesterday)
  return (
    <section className="panel control">
      <h2>📡 Mission Control, Athlone</h2>
      {game.radioYesterday ? (
        <p>
          <strong>Sun report.</strong> Yesterday ({longDate(yesterday.date)}) the Sun fired{' '}
          {yesterday.flareCount === 0 ? 'no flares' : plural(yesterday.flareCount, 'flare')}
          {yesterday.strongestFlare ? `, the biggest was ${yesterday.strongestFlare}` : ''}. The Sun is{' '}
          <strong className={`activity-${activity.replace(' ', '-')}`}>{activity}</strong>.{' '}
          {activity === 'quiet' ? 'A good day for work outside.' : 'Keep the Radio Dish on so we can warn you.'}
        </p>
      ) : (
        <p>
          <strong>No Sun report.</strong> The Radio Dish was off yesterday, so nothing came through this morning.
        </p>
      )}
      <p className="hint">
        {radioOn ? 'Radio is on today: we will call if the Sun fires a big flare.' : 'Radio is off today: we cannot reach you.'}{' '}
        Flare records: NASA DONKI.
      </p>
    </section>
  )
}

interface CardProps {
  astronaut: Astronaut
  game: GameState
  plan: Plan
  open: boolean
  onSelect: () => void
  onAssign: (job: Job) => void
}

function CrewCard({ astronaut, game, plan, open, onSelect, onAssign }: CardProps) {
  const info = crewInfo(astronaut.id)
  const state = condition(astronaut)
  const job = plan.jobs[astronaut.id]
  const problem = job ? jobProblem(game, plan, astronaut.id, job) : null
  const away = astronaut.away

  const jobLabel = away
    ? `🚙 ${TRIPS[away.trip].name} (${plural(away.daysLeft, 'day')} left)`
    : job
      ? `${JOB_ICONS[job.kind]} ${job.kind === 'trip' && job.trip ? TRIPS[job.trip].name : JOBS[job.kind].name}`
      : 'Rest'

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
  // Working several days in a row costs mood: warn before it happens.
  const plannedWork = away ? true : !!job && JOBS[job.kind].work && !problem
  const willBeTired = plannedWork && astronaut.streak + 1 >= RULES.tiredAfter
  const isChosen = (candidate: Job) => job?.kind === candidate.kind && job?.trip === candidate.trip
  const lovesJob = (kind: JobId) => info.loves.includes(kind)

  return (
    <div className={`crew-card${open ? ' open' : ''} state-${state}`}>
      <button type="button" className="crew-head" onClick={onSelect} disabled={!!away} aria-expanded={open}>
        <Token id={astronaut.id} />
        <span className="crew-main">
          <span className="crew-name">
            {info.name} <span className="crew-loves">loves {info.lovesText}</span>
          </span>
          <span className="crew-stats">
            <Pips label="Health" icon="♥" value={astronaut.health} max={RULES.maxStat} tone="health" />
            <Pips label="Mood" icon="☺" value={astronaut.mood} max={RULES.maxStat} tone="mood" />
            <Pips label="Fed" icon="●" value={astronaut.fed} max={RULES.fullFed} tone="fed" />
          </span>
          <span className="crew-job">
            <span className={problem ? 'job-now bad' : 'job-now'}>{jobLabel}</span>
            {state !== 'well' && <span className={`tag tag-${state}`}>{CONDITION_WORDS[state]}</span>}
            {willBeTired && <span className="tag tag-struggling">Tired after today: needs a day off</span>}
          </span>
          {problem && !away && <span className="crew-problem">⚠ {problem} They will rest instead.</span>}
        </span>
      </button>
      {open && !away && (
        <div className="job-grid">
          {choices.map((choice) => {
            const why = jobProblem(game, plan, astronaut.id, choice.job)
            return (
              <button
                key={`${choice.job.kind}-${choice.job.trip ?? ''}`}
                type="button"
                className={`job${isChosen(choice.job) ? ' chosen' : ''}`}
                disabled={!!why}
                onClick={() => onAssign(choice.job)}
              >
                <span className="job-title">
                  {JOB_ICONS[choice.job.kind]} {choice.label}
                  {lovesJob(choice.job.kind) && <span className="heart" title={`${info.name} loves this`}> ♥</span>}
                </span>
                <span className="job-does">{why ?? choice.does}</span>
              </button>
            )
          })}
          <p className="hint about">
            {info.about} {relationshipLine(astronaut.id, game)}
          </p>
        </div>
      )}
    </div>
  )
}

function relationshipLine(id: string, game: GameState): string {
  const onCrew = (other: string) => game.crew.some((member) => member.id === other)
  const lines: string[] = []
  for (const [a, b] of FRIENDS) {
    const other = a === id ? b : b === id ? a : null
    if (other && onCrew(other)) lines.push(`Happier when working beside ${crewInfo(other).name}.`)
  }
  for (const [a, b] of CLASHES) {
    const other = a === id ? b : b === id ? a : null
    if (other && onCrew(other)) lines.push(`Gets annoyed when stuck with ${crewInfo(other).name}.`)
  }
  return lines.join(' ')
}
