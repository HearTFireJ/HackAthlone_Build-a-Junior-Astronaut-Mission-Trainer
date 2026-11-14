import { useEffect, useState } from 'react'
import { EndScreen } from './components/EndScreen.tsx'
import { GameScreen } from './components/GameScreen.tsx'
import { type Modal, Modals } from './components/Modals.tsx'
import { StartScreen } from './components/StartScreen.tsx'
import { CrewPicker } from './components/CrewPicker.tsx'
import { FieldGuide } from './components/FieldGuide.tsx'
import { EVENT_FACTS, MISSION_FACTS, type FactId } from './data/facts.ts'
import { type ScenarioInfo, SCENARIOS } from './data/scenarios.ts'
import { clearGame, loadGame, saveGame } from './save.ts'
import { MODULES, MODULE_IDS, STARTS, type ModuleId } from './game/content.ts'
import { EVENTS, type EventId } from './game/events.ts'
import { DEMO, demoGame } from './game/demo.ts'
import {
  RULES,
  type DayReport,
  type GameState,
  type Job,
  type Plan,
  type Response,
  alertFor,
  answerEvent,
  allMissionsDone,
  canRun,
  createGame,
  drawStart,
  emptyPlan,
  handOver,
  jobProblem,
  powerAvailable,
  poweredModules,
  resolveDay,
} from './game/outpost.ts'
import { crewInfo } from './game/content.ts'
import type { PlaceId } from './scene/layout.ts'
import type { SceneEffect } from './scene/Scene.tsx'
import { MORNING, type Cue, type Tone, later, morningScript, restScript } from './scene/script.ts'

/** One line of the log: something that happened, and on which day. */
export interface LogLine {
  day: number
  text: string
  tone: Tone
}

// The app is always on exactly one of these screens.
// All the rules live in src/game/. This file only moves between screens and
// passes the player's clicks to the rules.
type Screen =
  | { name: 'start' }
  /** A mission is chosen: now choose who goes. */
  | { name: 'crew'; info: ScenarioInfo }
  | {
      name: 'game'
      /** A prepared game opened to show to an audience. It is never saved over the player's own game. */
      demo?: boolean
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
      /** Real-life facts found so far. They are kept in the field guide, not shown while playing. */
      facts: FactId[]
      /** How many field guide entries there were when the player last opened it. */
      guideSeen: number
      speed: number
      effect: SceneEffect | null
      /** Everything that has happened so far, in order. */
      log: LogLine[]
    }
  | { name: 'end'; info: ScenarioInfo; game: GameState; demo?: boolean }

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
  return restScript(before, result.state, result.report)
}

/** How many entries the field guide holds right now. Its button lights up when this grows. */
function guideEntries(game: GameState, facts: FactId[]): number {
  return game.history.filter((day) => day.flare !== null || day.storm !== null).length + facts.length
}

/** Adds facts to the list of found ones, without repeats. */
function withFacts(facts: FactId[], ...more: (FactId | undefined)[]): FactId[] {
  const all = [...facts]
  for (const id of more) if (id && !all.includes(id)) all.push(id)
  return all
}

/** The real-life facts that a day's events bring to light. */
function factsOf(report: DayReport): FactId[] {
  const facts: FactId[] = report.finished.map((id) => MISSION_FACTS[id])
  if (report.storm && report.response === 'inside') facts.push('shelter')
  if (report.call === 'false-alarm') facts.push('fraction')
  if (report.storm) facts.push('panels')
  if (report.cropLoss > 0) facts.push('plants')
  if (report.crew.some((member) => member.why.includes('rival'))) facts.push('hazards')
  return facts
}

/**
 * The demo: "?demo" at the end of the address opens a prepared game on the morning of
 * 11 May 2024, "?demo=end" opens the end of that game, and "?demo=5" another morning.
 * A script plays the days before with the game's own rules: see src/game/demo.ts.
 */
function demoScreen(): Screen | null {
  const wanted = new URLSearchParams(window.location.search).get('demo')
  if (wanted === null) return null
  const info = SCENARIOS.find((item) => item.scenario.id === DEMO.scenarioId)
  if (!info) return null
  const asked = Number(wanted)
  const day = wanted === 'end' ? RULES.maxDays + 1 : asked >= 2 && asked <= RULES.maxDays ? Math.floor(asked) : DEMO.day
  const { game, plan } = demoGame(info.scenario, day)
  if (game.status !== 'playing') return { name: 'end', info, game, demo: true }
  let facts: FactId[] = ['flare']
  for (const report of game.history) facts = withFacts(facts, ...factsOf(report))
  return {
    name: 'game',
    demo: true,
    info,
    game,
    plan,
    modal: null,
    selected: null,
    phase: 'plan',
    dayKey: game.day,
    script: null,
    pending: null,
    facts,
    guideSeen: guideEntries(game, facts),
    speed: 1,
    effect: null,
    log: [{ day: game.day, text: `👉 Demo: a script played days 1 to ${game.day - 1} by the game's own rules. Today is yours.`, tone: 'plain' }],
  }
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
  const [screen, setScreen] = useState<Screen>(() => demoScreen() ?? { name: 'start' })

  // Every change to a running game goes through here, using the latest state.
  const update = (change: (current: Playing) => Screen) =>
    setScreen((current) => (current.name === 'game' ? change(current) : current))

  // Keep the game in the browser each morning, so a closed tab does not lose it.
  // Only the planning morning is saved: a day that is half played starts again from its morning.
  useEffect(() => {
    if (screen.name === 'end' && !screen.demo) clearGame()
    if (screen.name !== 'game' || screen.demo || screen.phase !== 'plan' || screen.modal?.kind === 'intro') return
    saveGame({
      scenarioId: screen.info.scenario.id,
      game: screen.game,
      plan: screen.plan,
      facts: screen.facts,
      guideSeen: screen.guideSeen,
      dayKey: screen.dayKey,
      log: screen.log,
    })
  }, [screen])

  if (screen.name === 'start') {
    const saved = loadGame()
    const savedInfo = saved ? SCENARIOS.find((info) => info.scenario.id === saved.scenarioId) : undefined
    return (
      <StartScreen
        saved={saved && savedInfo ? { title: savedInfo.title, day: saved.game.day } : null}
        onContinue={() => {
          if (!saved || !savedInfo) return
          setScreen({
            name: 'game',
            info: savedInfo,
            game: saved.game,
            plan: saved.plan,
            modal: saved.game.event ? { kind: 'event' } : null,
            selected: null,
            phase: 'plan',
            dayKey: saved.dayKey,
            script: null,
            pending: null,
            facts: saved.facts,
            guideSeen: saved.guideSeen,
            speed: 1,
            effect: null,
            log: saved.log,
          })
        }}
        onPick={(info) => setScreen({ name: 'crew', info })}
      />
    )
  }

  if (screen.name === 'crew') {
    const info = screen.info
    return (
      <CrewPicker
        info={info}
        onBack={() => setScreen({ name: 'start' })}
        onGo={(crew) => {
          // The seed decides both the event cards and what the last crew left behind.
          const seed = seedFromClock()
          const game = createGame(info.scenario.id, seed, drawStart(seed), crew)
          const left = game.start ? STARTS[game.start] : null
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
            facts: ['flare'],
            guideSeen: 0,
            speed: 1,
            effect: null,
            log: left ? [{ day: 1, text: `📦 The last crew left: ${left.good} · ${left.bad}`, tone: 'plain' }] : [],
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
        locked={screen.modal !== null}
        log={screen.log}
        onLog={(text, tone) => update((current) => ({ ...current, log: [...current.log, { day: current.game.day, text, tone }] }))}
        guideNew={Math.max(0, guideEntries(screen.game, screen.facts) - screen.guideSeen)}
        onGuide={() =>
          update((current) =>
            current.modal || current.phase !== 'plan' ? current : { ...current, modal: { kind: 'guide' }, guideSeen: guideEntries(current.game, current.facts) },
          )
        }
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
        onHandover={() => update((current) => (current.modal || current.phase !== 'plan' || !allMissionsDone(current.game) ? current : { ...current, modal: { kind: 'handover' } }))}
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
            return alert ? { ...current, modal: { kind: 'alert', alert }, facts: withFacts(current.facts, 'classes', 'particles', 'flash') } : current
          })
        }
        onDayEnd={() =>
          update((current) => {
            if (!current.pending) return current
            const { state, report } = current.pending
            if (state.status !== 'playing') return { name: 'end', info: current.info, game: state, demo: current.demo }
            const landed = state.crew.filter((astronaut) => !current.game.crew.some((old) => old.id === astronaut.id))
            return {
              ...current,
              effect: landed.length > 0 ? { key: (current.effect?.key ?? 0) + 1, fx: 'lander' } : current.effect,
              log: [...current.log, ...landed.map((astronaut) => ({ day: state.day, text: `🚀 ${crewInfo(astronaut.id).name} has landed and joins the crew.`, tone: 'good' as const }))],
              game: state,
              plan: planForNewDay(state, current.plan),
              // The morning after the last mission is finished, the commander is asked whether to hand over.
              modal: allMissionsDone(state) && !allMissionsDone(current.game) ? { kind: 'handover' } : state.event ? { kind: 'event' } : null,
              phase: 'plan',
              dayKey: current.dayKey + 1,
              script: null,
              pending: null,
              facts: withFacts(current.facts, ...factsOf(report)),
            }
          })
        }
      />
      {screen.modal?.kind === 'guide' && (
        <FieldGuide info={screen.info} game={screen.game} facts={screen.facts} onClose={() => update((current) => ({ ...current, modal: null }))} />
      )}
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
              modal: { kind: 'event-result', icon: card.icon, title: card.title, text: result, reaction },
              log: [...current.log, { day: current.game.day, text: `${card.icon} ${card.title}: ${result}`, tone: 'plain' }],
              facts: withFacts(current.facts, EVENT_FACTS[pending.id]),
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
        onHandover={(now) =>
          update((current) => {
            if (now) return { name: 'end', info: current.info, game: handOver(current.game), demo: current.demo }
            // Staying: today's event card, if there is one, is still waiting.
            return { ...current, modal: current.game.event ? { kind: 'event' } : null }
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
