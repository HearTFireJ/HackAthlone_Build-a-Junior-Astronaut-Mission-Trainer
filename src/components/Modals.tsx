import type { ReactNode } from 'react'
import type { ScenarioInfo } from '../data/scenarios.ts'
import { JOBS, crewInfo } from '../game/content.ts'
import { EVENTS } from '../game/events.ts'
import {
  RULES,
  type Alert,
  type GameState,
  type Plan,
  type Response,
  jobProblem,
  missionDone,
} from '../game/outpost.ts'
import type { SceneEffect } from '../scene/Scene.tsx'

export type Modal =
  | { kind: 'intro' }
  | { kind: 'event' }
  | { kind: 'event-result'; icon: string; title: string; text: string; reaction?: Omit<SceneEffect, 'key'> }
  | { kind: 'guide' }
  | { kind: 'alert'; alert: Alert }
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
}

function Card({ tone, children }: { tone: string; children: ReactNode }) {
  return (
    <div className="overlay" role="dialog" aria-modal="true">
      <div className={`card card-${tone}`}>{children}</div>
    </div>
  )
}

/** Everything that pops up over the base: the welcome, event cards, flare alerts, the day's report. */
export function Modals({ modal, info, game, plan, onCloseIntro, onAnswerEvent, onCloseEventResult, onRespond }: Props) {
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
            <strong>Share out the power.</strong> The solar panels cannot run every module at once. Click the ⚡ switch
            under a module to turn it on.
          </li>
          <li>
            <strong>Give everyone a job.</strong> Click an astronaut, then click the place where they should work.
            People work best at what they love, and they need food, rest and a good mood.
          </li>
          <li>
            <strong>Start the day and watch.</strong> Your crew walks off to work and the day plays out in front of you.
          </li>
          <li>
            <strong>Watch the Sun.</strong> The Sun in this game does exactly what the real Sun did on these dates. If
            it fires a big flare, Mission Control will call, but only if your Radio Dish is on.
          </li>
        </ol>
        <p>
          ⭐ You earn one star for each mission you finish, and one more for handing the next crew a base with air, food
          and a healthy, happy crew.
        </p>
        <p>📖 The Field guide fills up with the real records and facts behind what you see. Look at it whenever you like.</p>
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
          The Sun has just fired a <strong>class {flare.class} flare</strong>.
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

  return null
}
