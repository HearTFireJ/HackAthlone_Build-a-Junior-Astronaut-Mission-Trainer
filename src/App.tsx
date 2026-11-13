import { useState } from 'react'
import { DayScreen } from './components/DayScreen.tsx'
import { MissionPicker } from './components/MissionPicker.tsx'
import { ReportScreen } from './components/ReportScreen.tsx'
import { ResultScreen } from './components/ResultScreen.tsx'
import type { ScenarioInfo } from './data/scenarios.ts'
import { type DayPlan, type DayReport, type GameState, createGame, emptyPlan, resolveDay } from './game/mission.ts'

// The app is always on exactly one of these screens.
// All game rules are in src/game/; this file only moves between screens.
type Screen =
  | { name: 'pick' }
  | { name: 'plan'; info: ScenarioInfo; game: GameState; plan: DayPlan }
  | { name: 'result'; info: ScenarioInfo; game: GameState; report: DayReport }
  | { name: 'report'; info: ScenarioInfo; game: GameState }

function startMission(info: ScenarioInfo): Screen {
  const game = createGame(info.scenario)
  // A new day starts with everyone resting, so every job is a choice the player makes.
  return { name: 'plan', info, game, plan: emptyPlan(game) }
}

function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'pick' })

  if (screen.name === 'pick') {
    return <MissionPicker onPick={(info) => setScreen(startMission(info))} />
  }

  if (screen.name === 'plan') {
    return (
      <DayScreen
        game={screen.game}
        plan={screen.plan}
        onChange={(change) =>
          setScreen((current) => (current.name === 'plan' ? { ...current, plan: change(current.plan) } : current))
        }
        onStart={() => {
          // Read the plan from the latest state, in case a job was tapped a moment ago.
          setScreen((current) => {
            if (current.name !== 'plan') return current
            const { state, report } = resolveDay(current.game, current.plan)
            return { name: 'result', info: current.info, game: state, report }
          })
          window.scrollTo(0, 0)
        }}
      />
    )
  }

  if (screen.name === 'result') {
    return (
      <ResultScreen
        game={screen.game}
        report={screen.report}
        onNext={() => {
          const { info, game } = screen
          setScreen(game.status === 'playing' ? { name: 'plan', info, game, plan: emptyPlan(game) } :{ name: 'report', info, game })
          window.scrollTo(0, 0)
        }}
      />
    )
  }

  return (
    <ReportScreen
      game={screen.game}
      info={screen.info}
      onReplay={() => setScreen(startMission(screen.info))}
      onPickAnother={() => setScreen({ name: 'pick' })}
    />
  )
}

export default App
