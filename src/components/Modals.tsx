import type { ReactNode } from 'react'
import { MISSION_FACTS, type FactId } from '../data/facts.ts'
import type { ScenarioInfo } from '../data/scenarios.ts'
import { JOBS, MISSIONS, MISSION_IDS, crewInfo } from '../game/content.ts'
import { EVENTS } from '../game/events.ts'
import {
  RULES,
  type Alert,
  type DayReport,
  type GameState,
  type Plan,
  type Response,
  jobProblem,
  missionDone,
} from '../game/outpost.ts'
import { Change, FactLine, Token } from './bits.tsx'
import { MISSION_ICONS, clock, longDate, spacecraftList } from './words.ts'

export type Modal =
  | { kind: 'intro' }
  | { kind: 'event' }
  | { kind: 'event-result'; icon: string; title: string; text: string; fact?: FactId }
  | { kind: 'alert'; alert: Alert }
  | { kind: 'report'; report: DayReport }
  | null

interface Props {
  modal: Modal
  info: ScenarioInfo
  game: GameState
  plan: Plan
  onCloseIntro: () => void
  onAnswerEvent: (option: number) => void
  onCloseEventResult: () => void
  onRespond: (response: Response) => void
  onNextDay: () => void
}

function Card({ tone, children }: { tone: string; children: ReactNode }) {
  return (
    <div className="overlay" role="dialog" aria-modal="true">
      <div className={`card card-${tone}`}>{children}</div>
    </div>
  )
}

/** Everything that pops up over the base: the welcome, event cards, flare alerts, the day's report. */
export function Modals({ modal, info, game, plan, onCloseIntro, onAnswerEvent, onCloseEventResult, onRespond, onNextDay }: Props) {
  if (!modal) return null

  if (modal.kind === 'intro') {
    return (
      <Card tone="intro">
        <p className="eyebrow">{info.title} · {info.dates}</p>
        <h2>Welcome, Commander</h2>
        <p>
          This outpost is yours for {RULES.maxDays} days. Your crew came here with missions to do. Then the next crew
          arrives and takes over.
        </p>
        <ol className="steps">
          <li>
            <strong>Share out the power.</strong> The solar panels cannot run every module at once. Click ⚡ to switch
            modules on.
          </li>
          <li>
            <strong>Give everyone a job.</strong> People work best at what they love, and they need food, rest and a
            good mood.
          </li>
          <li>
            <strong>Watch the Sun.</strong> The Sun in this game does exactly what the real Sun did on these dates. If
            it fires a big flare, Mission Control will call, but only if your Radio Dish is on.
          </li>
        </ol>
        <FactLine id="flare" />
        <p>
          ⭐ You earn one star for each mission you finish, and one more for handing the next crew a base with air, food
          and a healthy, happy crew.
        </p>
        <button type="button" className="primary" onClick={onCloseIntro}>
          {game.day === 1 && game.history.length === 0 ? 'Take command ▶' : 'Back to the base ▶'}
        </button>
      </Card>
    )
  }

  if (modal.kind === 'event' && game.event) {
    const card = EVENTS[game.event.id]
    const who = game.event.who
    return (
      <Card tone="event">
        <p className="eyebrow">Day {game.day} · This morning</p>
        <h2>
          <span aria-hidden="true">{card.icon}</span> {card.title}
        </h2>
        <p>{card.text(game, who)}</p>
        <div className="choices">
          {card.options.map((option, index) => (
            <button key={option.label} type="button" className="choice" onClick={() => onAnswerEvent(index)}>
              <strong>{option.label}</strong>
              <span>{option.detail}</span>
            </button>
          ))}
        </div>
        <p className="hint">This event is made up for the game. Only the Sun's flares and storms are real records.</p>
      </Card>
    )
  }

  if (modal.kind === 'event-result') {
    return (
      <Card tone="event">
        <h2>
          <span aria-hidden="true">{modal.icon}</span> {modal.title}
        </h2>
        <p>{modal.text}</p>
        {modal.fact && <FactLine id={modal.fact} />}
        <button type="button" className="primary" onClick={onCloseEventResult}>
          OK
        </button>
      </Card>
    )
  }

  if (modal.kind === 'alert') {
    const { flare, cloudKnown } = modal.alert
    const outside = game.crew.filter((astronaut) => {
      if (astronaut.away) return true
      const job = plan.jobs[astronaut.id]
      return !!job && JOBS[job.kind].outside && !jobProblem(game, plan, astronaut.id, job)
    })
    const names = outside.map((astronaut) => crewInfo(astronaut.id).name)
    const shield = missionDone(game.missions, 'shield')
    return (
      <Card tone="alert">
        <p className="eyebrow">Day {game.day} · Mission Control calling</p>
        <h2>⚠️ Flare alert</h2>
        <p>
          The Sun has just fired a <strong>class {flare.class} flare</strong>.{' '}
          <a href={flare.link} target="_blank" rel="noreferrer">
            Real NASA record
          </a>
          : {longDate(flare.time)}, {clock(flare.time)} UTC.
        </p>
        <p className={`clue ${cloudKnown ? (flare.cme ? 'danger' : 'safe') : 'unknown'}`}>
          {cloudKnown ? (
            flare.cme ? (
              <>
                🔭 <strong>A huge cloud of gas left the Sun with this flare.</strong> In the records this game uses,
                every particle storm came after a flare like that. But more than half of the flares like that brought
                no storm at all.
              </>
            ) : (
              <>
                🔭 <strong>NASA's record lists no cloud of gas with this flare.</strong> In the records this game uses,
                no flare like that was followed by a particle storm.
              </>
            )
          ) : (
            <>
              🔭 <strong>We cannot tell if a cloud of gas left the Sun.</strong> Your Sun Telescope is off today, so
              this is a guess.
            </>
          )}
        </p>
        <FactLine id="classes" />
        <FactLine id="particles" />
        <p>
          <strong>{names.length > 0 ? `Outside right now: ${names.join(', ')}.` : 'Nobody is outside right now.'}</strong>
        </p>
        <div className="choices">
          <button type="button" className="choice" onClick={() => onRespond('carry')}>
            <strong>Carry on</strong>
            <span>Everyone finishes their work. If a storm comes, people outside are hurt badly and people inside {shield ? 'are mostly safe behind the shield' : 'a little'}.</span>
          </button>
          <button type="button" className="choice" disabled={names.length === 0} onClick={() => onRespond('inside')}>
            <strong>Call outside crew in</strong>
            <span>{names.length > 0 ? `${names.join(', ')} ${names.length === 1 ? 'stops' : 'stop'} early. A rover trip is cancelled and must start again.` : 'Nobody is outside.'}</span>
          </button>
          <button type="button" className="choice" onClick={() => onRespond('shelter')}>
            <strong>Everyone to the storm shelter</strong>
            <span>Nobody is hurt. Everyone gets half a day's work done at most. If no storm comes, the crew is fed up with the wasted day.</span>
          </button>
        </div>
      </Card>
    )
  }

  if (modal.kind === 'report') {
    return <Report report={modal.report} game={game} onNextDay={onNextDay} />
  }

  return null
}

const CALL_WORDS: Record<NonNullable<DayReport['call']>, { title: string; tone: string }> = {
  saved: { title: 'Good call, Commander!', tone: 'good' },
  hit: { title: 'The storm hit while everyone was working', tone: 'bad' },
  'false-alarm': { title: 'No storm came this time', tone: 'calm' },
  calm: { title: 'You carried on, and no storm came', tone: 'good' },
  surprise: { title: 'A storm hit with no warning', tone: 'bad' },
}

function Report({ report, game, onNextDay }: { report: DayReport; game: GameState; onNextDay: () => void }) {
  const { storm, flare, call } = report
  const over = game.status !== 'playing'
  // Finished missions are shown in their own box, so their lines are left out of the list below.
  const otherNotes = report.notes.filter((note) => !note.startsWith('Mission complete'))
  return (
    <Card tone="report">
      <p className="eyebrow">
        End of day {report.day} · {longDate(report.date)}
      </p>

      <div className={`sun-box ${storm ? 'storm' : 'quiet'}`}>
        {storm ? (
          <>
            <h2>🌩️ A {storm.severe ? 'severe ' : ''}solar particle storm arrived</h2>
            <p>
              This really happened. {spacecraftList(storm.instruments)} first measured it at {clock(storm.time)} UTC on{' '}
              {longDate(storm.time)}.{' '}
              <a href={storm.link} target="_blank" rel="noreferrer">
                See NASA's record
              </a>
              {storm.severe ? ' It was strong enough to get through thick walls.' : ''}
            </p>
          </>
        ) : (
          <>
            <h2>☀️ No new particle storm today</h2>
            <p>
              {flare
                ? `The Sun fired a class ${flare.class} flare, but NASA's records show no new particle storm starting near Earth that day.`
                : "NASA's records show no big flare and no new particle storm starting on this date."}
            </p>
          </>
        )}
        {storm && report.response === 'shelter' && <FactLine id="shelter" />}
        {call === 'false-alarm' && <FactLine id="fraction" />}
        {call && (
          <p className={`call tone-${CALL_WORDS[call].tone}`}>
            <strong>{CALL_WORDS[call].title}</strong>{' '}
            {call === 'saved' && report.heartsSaved > 0 && `Your choice saved the crew ${report.heartsSaved} health.`}
            {call === 'false-alarm' && 'That is how it goes: most alerts are not followed by a storm, and nobody can be sure in advance.'}
            {call === 'surprise' && 'With the Radio Dish off, Mission Control could not warn you.'}
            {call === 'hit' && 'Mission Control warned you, and you chose to keep working.'}
          </p>
        )}
      </div>

      {report.finished.map((id) => (
        <div key={id} className="win-box">
          <h2>⭐ Mission complete: {MISSIONS[id].name}!</h2>
          <p>{MISSIONS[id].reward}</p>
          <FactLine id={MISSION_FACTS[id]} />
        </div>
      ))}

      <ul className="report-crew">
        {report.crew.map((member) => (
          <li key={member.id}>
            <Token id={member.id} small />
            <div>
              <div className="report-line">
                <strong>{crewInfo(member.id).name}</strong>
                <span className="report-did">{member.did}</span>
                <Change icon="♥" before={member.healthBefore} after={member.healthAfter} />
                <Change icon="☺" before={member.moodBefore} after={member.moodAfter} />
              </div>
              {member.notes.length > 0 && <div className="report-notes">{member.notes.join(' ')}</div>}
            </div>
          </li>
        ))}
      </ul>

      <ul className="report-missions" aria-label="Missions">
        {MISSION_IDS.map((id) => {
          const goal = MISSIONS[id].goal
          const before = Math.min(report.missions.before[id], goal)
          const after = Math.min(report.missions.after[id], goal)
          return (
            <li key={id} className={after >= goal ? 'done' : after > before ? 'moved' : undefined}>
              <span className="rm-name">
                {after >= goal ? '✅' : MISSION_ICONS[id]} {MISSIONS[id].name}
              </span>
              <span className="bar">
                <span className="bar-fill" style={{ width: `${(100 * after) / goal}%` }} />
              </span>
              <span className="rm-count">
                {after}/{goal}
                {after > before && <strong> +{after - before} today</strong>}
              </span>
            </li>
          )
        })}
      </ul>

      <div className="report-base">
        <span>⚡ {report.power.used} of {report.power.available} power used{report.power.saved > 0 ? `, ${report.power.saved} saved in the battery` : ''}</span>
        <span>💨 Air: +{report.air.made} made, {report.air.used} breathed, {report.air.left} left</span>
        <span>🥕 Food: +{report.food.made} grown, {report.food.eaten} eaten, {report.food.left} left</span>
      </div>

      {otherNotes.length > 0 && (
        <ul className="report-list">
          {otherNotes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}

      {storm && report.finished.length === 0 && report.response !== 'shelter' && <FactLine id="panels" />}

      <button type="button" className="primary" onClick={onNextDay}>
        {over ? 'See how the mission went ▶' : `Day ${report.day + 1} ▶`}
      </button>
    </Card>
  )
}
