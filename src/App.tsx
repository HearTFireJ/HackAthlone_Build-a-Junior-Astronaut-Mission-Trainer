import { useState } from 'react'
import { EndScreen } from './components/EndScreen.tsx'
import { GameScreen } from './components/GameScreen.tsx'
import { type Modal, Modals } from './components/Modals.tsx'
import { StartScreen } from './components/StartScreen.tsx'
import { longDate } from './components/words.ts'
import { EVENT_FACTS } from './data/facts.ts'
import type { ScenarioInfo } from './data/scenarios.ts'
import { MODULES, MODULE_IDS, type ModuleId } from './game/content.ts'
import { EVENTS, type EventId } from './game/events.ts'
import {
  type DayReport,
  type GameState,
  type Job,
  type Plan,
  type Response,
  alertFor,
  answerEvent,
  canRun,
  createGame,
  emptyPlan,
  jobProblem,
  powerAvailable,
  poweredModules,
  resolveDay,
} from './game/outpost.ts'
import type { PlaceId } from './scene/layout.ts'
import type { SceneEffect } from './scene/Scene.tsx'
import { MORNING, type Cue, later, morningScript, restScript } from './scene/script.ts'

// The app is always on exactly one of these screens.
// All the rules live in src/game/. This file only moves between screens and
// passes the player's clicks to the rules.
type Screen =
  | { name: 'start' }
  | {
      name: 'game'
      info: ScenarioInfo
      game: GameState
      plan: Plan
      modal: Modal
      selected: string | null
      /** 'plan': giving orders. 'play': watching the day play out. */
      phase: 'plan' | 'play'
      /** Goes up by one each morning. */
      dayKey: number
      /** The film of the day that the picture is playing. */
      script: Cue[] | null
      /** The day's result, worked out by the rules, waiting for the film to finish. */
      pending: { state: GameState; report: DayReport } | null
      lastReport: DayReport | null
      speed: number
      effect: SceneEffect | null
    }
  | { name: 'end'; info: ScenarioInfo; game: GameState }

type Playing = Extract<Screen, { name: 'game' }>

/** Switches off anything the plan asks for that cannot run or does not fit the power budget. */
function fitToPower(game: GameState, plan: Plan): Plan {
  const on = poweredModules(game, plan)
  const power = Object.fromEntries(MODULE_IDS.map((module) => [module, on.includes(module)])) as Record<ModuleId, boolean>
  return { ...plan, power }
}

/** Today's plan starts as yesterday's, so the player only changes what they want to change. */
function planForNewDay(game: GameState, yesterday: Plan | null): Plan {
  const fresh = emptyPlan(game)
  if (!yesterday) return fresh
  const wanted = { ...fresh, power: { ...yesterday.power } }
  for (const module of MODULE_IDS) if (!canRun(game, module)) wanted.power[module] = false
  const plan = fitToPower(game, wanted)
  for (const astronaut of game.crew) {
    const job = yesterday.jobs[astronaut.id]
    // Rover trips are one-off decisions: they are never repeated automatically.
    if (astronaut.away || !job || job.kind === 'trip') continue
    if (!jobProblem(game, plan, astronaut.id, job)) plan.jobs[astronaut.id] = job
  }
  return plan
}

function seedFromClock(): number {
  return Math.floor(Math.random() * 1_000_000) + 1
}

/** The film for everything after the morning, from the result the rules worked out. */
function restOfDay(before: GameState, result: { state: GameState; report: DayReport }): Cue[] {
  const { report } = result
  const link = report.storm ? { href: report.storm.link, label: "See NASA's record" } : null
  return restScript(before, result.state, report, link, longDate(report.date))
}

/** What the picture shows when an event card has been answered. */
const EVENT_EFFECTS: Partial<Record<EventId, { fx: SceneEffect['fx']; place?: PlaceId; onlyOption?: number }>> = {
  rock: { fx: 'smoke', place: 'farm' },
  dust: { fx: 'dust', place: 'panels' },
  pump: { fx: 'smoke', place: 'life' },
  quake: { fx: 'shake' },
  birthday: { fx: 'confetti', place: 'habitat', onlyOption: 0 },
  school: { fx: 'confetti', place: 'habitat', onlyOption: 0 },
  box: { fx: 'confetti', place: 'habitat' },
}

function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'start' })

  // Every change to a running game goes through here, using the latest state.
  const update = (change: (current: Playing) => Screen) =>
    setScreen((current) => (current.name === 'game' ? change(current) : current))

  if (screen.name === 'start') {
    return (
      <StartScreen
        onPick={(info) => {
          const game = createGame(info.scenario.id, seedFromClock())
          setScreen({
            name: 'game',
            info,
            game,
            plan: emptyPlan(game),
            modal: { kind: 'intro' },
            selected: null,
            phase: 'plan',
            dayKey: 1,
            script: null,
            pending: null,
            lastReport: null,
            speed: 1,
            effect: null,
          })
        }}
      />
    )
  }

  if (screen.name === 'end') {
    return <EndScreen info={screen.info} game={screen.game} onAgain={() => setScreen({ name: 'start' })} />
  }

  return (
    <>
      <GameScreen
        info={screen.info}
        game={screen.game}
        plan={screen.plan}
        selected={screen.selected}
        phase={screen.phase}
        dayKey={screen.dayKey}
        script={screen.script}
        speed={screen.speed}
        effect={screen.effect}
        lastReport={screen.lastReport}
        onSelect={(id) => update((current) => ({ ...current, selected: id }))}
        onSpeed={() => update((current) => ({ ...current, speed: current.speed > 1 ? 1 : 3 }))}
        onTogglePower={(module) =>
          update((current) => {
            if (current.phase !== 'plan') return current
            const turningOn = !current.plan.power[module]
            const spare = powerAvailable(current.game) - poweredModules(current.game, current.plan).reduce((sum, id) => sum + MODULES[id].power, 0)
            if (turningOn && (MODULES[module].power > spare || !canRun(current.game, module))) return current
            return { ...current, plan: { ...current.plan, power: { ...current.plan.power, [module]: turningOn } } }
          })
        }
        onAssign={(astronautId: string, job: Job) =>
          update((current) => {
            if (current.phase !== 'plan') return current
            const jobs = { ...current.plan.jobs, [astronautId]: job }
            // One rover: giving someone a trip takes it away from anyone else.
            if (job.kind === 'trip') {
              for (const [id, other] of Object.entries(jobs)) {
                if (id !== astronautId && other.kind === 'trip') jobs[id] = { kind: 'rest' }
              }
            }
            return { ...current, plan: { ...current.plan, jobs } }
          })
        }
        onHelp={() => update((current) => (current.modal || current.phase !== 'plan' ? current : { ...current, modal: { kind: 'intro' } }))}
        onStart={() =>
          update((current) => {
            // A card is open (an event to answer): the day cannot start yet.
            if (current.modal || current.phase !== 'plan') return current
            const alert = alertFor(current.game, current.info.scenario, current.plan)
            // The day as it goes if nobody is called in. With no alert, that is simply the day.
            const calm = resolveDay(current.game, current.info.scenario, current.plan, 'carry')
            const morning = morningScript(current.game, calm.report, alert !== null)
            if (alert) return { ...current, phase: 'play', script: morning, pending: null, selected: null }
            return { ...current, phase: 'play', script: [...morning, ...later(restOfDay(current.game, calm), MORNING)], pending: calm, selected: null }
          })
        }
        onAlert={() =>
          update((current) => {
            const alert = alertFor(current.game, current.info.scenario, current.plan)
            return alert ? { ...current, modal: { kind: 'alert', alert } } : current
          })
        }
        onDayEnd={() =>
          update((current) => {
            if (!current.pending) return current
            const { state, report } = current.pending
            if (state.status !== 'playing') return { name: 'end', info: current.info, game: state }
            return {
              ...current,
              game: state,
              plan: planForNewDay(state, current.plan),
              modal: state.event ? { kind: 'event' } : null,
              phase: 'plan',
              dayKey: current.dayKey + 1,
              script: null,
              pending: null,
              lastReport: report,
            }
          })
        }
      />
      <Modals
        modal={screen.modal}
        info={screen.info}
        game={screen.game}
        plan={screen.plan}
        onCloseIntro={() =>
          update((current) => ({ ...current, modal: current.game.event ? { kind: 'event' } : null }))
        }
        onAnswerEvent={(option) =>
          update((current) => {
            const pending = current.game.event
            if (!pending) return { ...current, modal: null }
            const card = EVENTS[pending.id]
            const { state, result } = answerEvent(current.game, option)
            const found = EVENT_EFFECTS[pending.id]
            const reaction = found && (found.onlyOption === undefined || found.onlyOption === option) ? { fx: found.fx, place: found.place } : undefined
            return {
              ...current,
              game: state,
              // The answer may have cost power: make sure the plan still fits.
              plan: fitToPower(state, current.plan),
              modal: { kind: 'event-result', icon: card.icon, title: card.title, text: result, fact: EVENT_FACTS[pending.id], reaction },
            }
          })
        }
        onCloseEventResult={() =>
          update((current) => {
            // Now that the card is out of the way, the picture shows what happened.
            const reaction = current.modal?.kind === 'event-result' ? current.modal.reaction : undefined
            return { ...current, modal: null, effect: reaction ? { key: (current.effect?.key ?? 0) + 1, ...reaction } : current.effect }
          })
        }
        onRespond={(response: Response) =>
          update((current) => {
            // The commander has answered the alert: now the rules can work out the day.
            const result = resolveDay(current.game, current.info.scenario, current.plan, response)
            return { ...current, modal: null, pending: result, script: restOfDay(current.game, result) }
          })
        }
      />
    </>
  )
}

export default App
