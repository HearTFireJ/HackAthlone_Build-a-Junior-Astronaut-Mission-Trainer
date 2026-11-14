import type { ReactNode } from 'react'
import type { ScenarioInfo } from '../data/scenarios.ts'
import { JOBS, STARTS, crewInfo } from '../game/content.ts'
import { EVENTS } from '../game/events.ts'
import {
  RULES,
  type Alert,
  type GameState,
  type Plan,
  type Response,
  handoverReady,
  jobProblem,
  missionDone,
} from '../game/outpost.ts'
import { handoverNeeds } from './words.ts'
import type { SceneEffect } from '../scene/Scene.tsx'
import { Icon, Rich } from './Icon.tsx'

export type Modal =
  | { kind: 'intro' }
  | { kind: 'event' }
  | { kind: 'event-result'; icon: string; title: string; text: string; reaction?: Omit<SceneEffect, 'key'> }
  | { kind: 'guide' }
  | { kind: 'alert'; alert: Alert }
  /** Every mission is done: hand the base over now, or stay? */
  | { kind: 'handover' }
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
  /** true: end the tour now. false: stay. */
  onHandover: (now: boolean) => void
}

function Card({ tone, children }: { tone: string; children: ReactNode }) {
  return (
    <div className="overlay" role="dialog" aria-modal="true">
      <div className={`card card-${tone}`}>{children}</div>
    </div>
  )
}

/** Everything that pops up over the base: the welcome, event cards, flare alerts, the day's report. */
export function Modals({ modal, info, game, plan, onCloseIntro, onAnswerEvent, onCloseEventResult, onRespond, onHandover }: Props) {
  if (!modal) return null

  if (modal.kind === 'intro') {
    const fresh = game.day === 1 && game.history.length === 0
    const left = fresh && game.start ? STARTS[game.start] : null
    return (
      <Card tone="intro">
        <p className="eyebrow">{info.title} · {info.dates}</p>
        <h2>Welcome, Commander</h2>
        {left && (
          <div className="start-note">
            <span className="start-label">The last crew left you:</span>
            <span className="start-tag good"><Icon name="sparkle" /> {left.good}</span>
            <span className="start-tag bad"><Icon name="warning" /> {left.bad}</span>
          </div>
        )}
        <p>
          This outpost is yours for {RULES.maxDays} days. Your crew came here with missions to do. Then the next crew
          arrives and takes over.
        </p>
        <ol className="steps">
          <li>
            <strong>Share out the power.</strong> The solar panels cannot run every module at once. Click the <Icon name="bolt" /> switch
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
          <Icon name="star" /> You earn one star for each mission you finish, and one more for handing the next crew a base with air, food
          and a healthy, happy crew.
        </p>
        <p><Icon name="book" /> The Field guide fills up with the real records and facts behind what you see. Look at it whenever you like.</p>
        <p className="hint"><Icon name="keys" /> Keys: Space starts the day or pauses it, F plays faster, 1 to 5 pick an astronaut.</p>
        <button type="button" className="primary" onClick={onCloseIntro}>
          {fresh ? 'Take command' : 'Back to the base'} <Icon name="play" />
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
          <Rich text={card.icon} /> {card.title}
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
          <Rich text={modal.icon} /> {modal.title}
        </h2>
        <p>{modal.text}</p>
        <button type="button" className="primary" onClick={onCloseEventResult}>
          OK
        </button>
      </Card>
    )
  }

  if (modal.kind === 'handover') {
    const ready = handoverReady(game)
    return (
      <Card tone="event">
        <p className="eyebrow">Day {game.day} · This morning</p>
        <h2><Icon name="star" /> Every mission is done!</h2>
        <p>The next crew can come as soon as you call them.</p>
        <p className={`clue ${ready ? 'safe' : 'unknown'}`}>
          {ready ? (
            <>
              <Icon name="star" /> <strong>The base is ready.</strong> Handing over now earns the last star.
            </>
          ) : (
            <>
              <Icon name="star" /> <strong>The base is not ready for the last star.</strong> Needs {handoverNeeds(game).join(', ')}.
            </>
          )}
        </p>
        <div className="choices">
          <button type="button" className="choice" onClick={() => onHandover(true)}>
            <strong>Hand over now</strong>
            <span>The tour ends this morning. The base is judged as it is.</span>
          </button>
          <button type="button" className="choice" onClick={() => onHandover(false)}>
            <strong>{game.day >= RULES.maxDays ? 'Stay one more day' : `Stay until day ${RULES.maxDays}`}</strong>
            <span>Keep working on the base. You can still hand over on any morning.</span>
          </button>
        </div>
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
        <h2><Icon name="warning" /> Flare alert</h2>
        <p>
          The Sun has just fired a <strong>class {flare.class} flare</strong>.
        </p>
        <p className={`clue ${cloudKnown ? (flare.cme ? 'danger' : 'safe') : 'unknown'}`}>
          {/* Only what was seen. What it means for storms is for the player to find out; the field guide helps. */}
          {cloudKnown ? (
            flare.cme ? (
              <>
                <Icon name="telescope" /> <strong>A huge cloud of gas left the Sun with this flare.</strong>
              </>
            ) : (
              <>
                <Icon name="telescope" /> <strong>No cloud of gas was seen with this flare.</strong>
              </>
            )
          ) : (
            <>
              <Icon name="telescope" /> <strong>We cannot tell if a cloud of gas left the Sun.</strong> Your Sun Telescope is off today.
            </>
          )}
        </p>
        <p>
          <strong>{names.length > 0 ? `Outside right now: ${names.join(', ')}.` : 'Nobody is outside right now.'}</strong>
        </p>
        <div className="choices">
          <button type="button" className="choice" onClick={() => onRespond('carry')}>
            <strong>Carry on</strong>
            <span>Everyone finishes their work. If a storm comes, people outside are hurt badly{shield ? '. Indoors is safe under the shield.' : ' and people indoors a little.'}</span>
          </button>
          <button type="button" className="choice" disabled={names.length === 0} onClick={() => onRespond('inside')}>
            <strong>Call outside crew in</strong>
            <span>{names.length > 0 ? `${names.join(', ')} ${names.length === 1 ? 'stops' : 'stop'} early and ${names.length === 1 ? 'gets' : 'get'} half a day's work done at most. A rover trip is cancelled and must start again.` : 'Nobody is outside.'}</span>
          </button>
        </div>
      </Card>
    )
  }

  return null
}
