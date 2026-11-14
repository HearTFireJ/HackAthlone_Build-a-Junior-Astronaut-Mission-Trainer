import { useState } from 'react'
import { EndScreen } from './components/EndScreen.tsx'
import { GameScreen } from './components/GameScreen.tsx'
import { type Modal, Modals } from './components/Modals.tsx'
import { StartScreen } from './components/StartScreen.tsx'
import type { ScenarioInfo } from './data/scenarios.ts'
import { MODULES, MODULE_IDS, type ModuleId } from './game/content.ts'
import { EVENTS } from './game/events.ts'
import {
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

// The app is always on exactly one of these screens.
// All the rules live in src/game/. This file only moves between screens and
// passes the player's clicks to the rules.
type Screen =
  | { name: 'start' }
  | { name: 'game'; info: ScenarioInfo; game: GameState; plan: Plan; modal: Modal; selected: string | null }
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
          setScreen({ name: 'game', info, game, plan: emptyPlan(game), modal: { kind: 'intro' }, selected: null })
        }}
      />
    )
  }

  if (screen.name === 'end') {
    return <EndScreen info={screen.info} game={screen.game} onAgain={() => setScreen({ name: 'start' })} />
  }

  const finishDay = (response: Response) =>
    update((current) => {
      const { state, report } = resolveDay(current.game, current.info.scenario, current.plan, response)
      return { ...current, game: state, modal: { kind: 'report', report }, selected: null }
    })

  return (
    <>
      <GameScreen
        info={screen.info}
        game={screen.game}
        plan={screen.plan}
        selected={screen.selected}
        onSelect={(id) => update((current) => ({ ...current, selected: current.selected === id ? null : id }))}
        onTogglePower={(module) =>
          update((current) => {
            const turningOn = !current.plan.power[module]
            const spare = powerAvailable(current.game) - poweredModules(current.game, current.plan).reduce((sum, id) => sum + MODULES[id].power, 0)
            if (turningOn && (MODULES[module].power > spare || !canRun(current.game, module))) return current
            return { ...current, plan: { ...current.plan, power: { ...current.plan.power, [module]: turningOn } } }
          })
        }
        onAssign={(astronautId: string, job: Job) =>
          update((current) => {
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
        onStart={() =>
          update((current) => {
            const alert = alertFor(current.game, current.info.scenario, current.plan)
            if (alert) return { ...current, modal: { kind: 'alert', alert }, selected: null }
            const { state, report } = resolveDay(current.game, current.info.scenario, current.plan, 'carry')
            return { ...current, game: state, modal: { kind: 'report', report }, selected: null }
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
            return {
              ...current,
              game: state,
              // The answer may have cost power: make sure the plan still fits.
              plan: fitToPower(state, current.plan),
              modal: { kind: 'event-result', icon: card.icon, title: card.title, text: result },
            }
          })
        }
        onCloseEventResult={() => update((current) => ({ ...current, modal: null }))}
        onRespond={finishDay}
        onNextDay={() =>
          update((current) => {
            if (current.game.status !== 'playing') return { name: 'end', info: current.info, game: current.game }
            return {
              ...current,
              plan: planForNewDay(current.game, current.plan),
              modal: current.game.event ? { kind: 'event' } : null,
            }
          })
        }
      />
    </>
  )
}

export default App
