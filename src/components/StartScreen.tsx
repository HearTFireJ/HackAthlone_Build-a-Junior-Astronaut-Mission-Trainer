import { type ScenarioInfo, SCENARIOS } from '../data/scenarios.ts'
import { SETUPS } from '../game/content.ts'
import { RULES } from '../game/outpost.ts'
import { AboutData } from './AboutData.tsx'
import { plural } from './words.ts'

interface Props {
  onPick: (info: ScenarioInfo) => void
}

/** First screen: what the game is, and which real stretch of days to play. */
export function StartScreen({ onPick }: Props) {
  return (
    <main className="screen start">
      <header className="start-head">
        <p className="eyebrow">Mission Control · Athlone, Ireland</p>
        <h1>Junior Astronaut Mission Trainer</h1>
        <p className="lead">
          You are the commander of a Moon outpost. Your crew has missions to do, not enough power for everything, and
          a Sun that does exactly what the real Sun did.
        </p>
      </header>

      <section aria-labelledby="pick-title">
        <h2 id="pick-title">Choose your mission</h2>
        <p className="hint">
          Each mission replays {RULES.maxDays} real days of the Sun's weather, from NASA's records. A stormier Sun
          means a harder mission.
        </p>
        <div className="mission-cards">
          {SCENARIOS.map((info) => {
            const setup = SETUPS[info.scenario.id]
            return (
              <button key={info.scenario.id} type="button" className="mission-card" onClick={() => onPick(info)}>
                <span className={`tag tag-${info.difficulty.replace(' ', '-').toLowerCase()}`}>{info.difficulty}</span>
                <span className="mission-title">{info.title}</span>
                <span className="mission-dates">{info.dates}</span>
                <span className="mission-blurb">{info.blurb}</span>
                <span className="mission-setup">
                  👩‍🚀 {plural(setup.crew.length, 'astronaut')} · 💨 {setup.air} air · 🥕 {setup.food} food
                </span>
                <span className="mission-go">Take command ▶</span>
              </button>
            )
          })}
        </div>
      </section>

      <section className="how" aria-labelledby="how-title">
        <h2 id="how-title">What a commander does</h2>
        <ol>
          <li>Shares out the power. There is never enough for every module.</li>
          <li>Gives each astronaut a job, and keeps them fed, healthy and in a good mood.</li>
          <li>Decides what to do when the Sun fires a flare: keep working, or take cover?</li>
        </ol>
      </section>

      <AboutData />
    </main>
  )
}
