import { type ScenarioInfo, SCENARIOS } from '../data/scenarios.ts'
import { CREW_SIZE, MISSION_DAYS } from '../game/mission.ts'
import { AboutData } from './AboutData.tsx'

interface Props {
  onPick: (info: ScenarioInfo) => void
}

/** First screen: what the game is, and which real ten days to play. */
export function MissionPicker({ onPick }: Props) {
  return (
    <main className="screen picker">
      <header className="picker-head">
        <p className="eyebrow">Mission Control · Athlone, Ireland</p>
        <h1>Junior Astronaut Mission Trainer</h1>
        <p className="lead">
          You are in charge of a Moon base. {CREW_SIZE} astronauts must last {MISSION_DAYS} days until the
          supply ship lands. Each day you choose their jobs. Watch out for solar storms!
        </p>
      </header>

      <section aria-labelledby="pick-title">
        <h2 id="pick-title">Choose your mission</h2>
        <p className="hint">Each mission uses the Sun's real weather from ten real days, recorded by NASA.</p>
        <div className="mission-cards">
          {SCENARIOS.map((info) => (
            <button key={info.scenario.id} type="button" className="mission-card" onClick={() => onPick(info)}>
              <span className={`tag tag-${info.difficulty.replace(' ', '-').toLowerCase()}`}>{info.difficulty}</span>
              <span className="mission-title">{info.title}</span>
              <span className="mission-dates">{info.dates}</span>
              <span className="mission-blurb">{info.blurb}</span>
              <span className="mission-go">Start mission ▶</span>
            </button>
          ))}
        </div>
      </section>

      <section className="how" aria-labelledby="how-title">
        <h2 id="how-title">How to play</h2>
        <ol>
          <li>Read the storm forecast from Mission Control.</li>
          <li>Give each astronaut one job. There are more jobs than astronauts, so something always waits.</li>
          <li>
            If you think a storm is coming, send everyone to the storm shelter. They will be safe, but nobody
            works that day.
          </li>
        </ol>
      </section>

      <AboutData />
    </main>
  )
}
