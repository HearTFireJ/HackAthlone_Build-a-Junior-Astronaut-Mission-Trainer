import {
  type DayPlan,
  type GameState,
  JOBS,
  type Job,
  MISSION_DAYS,
  daysUntilSupplyShip,
  resolveDay,
} from '../game/mission.ts'
import { forecastLevel, radioDown, weatherOn, yesterdayOf } from '../game/scenario.ts'
import { SupplyBars } from './SupplyBars.tsx'
import { FORECAST_WORDS, JOB_WORDS, flareSentence, hearts, longDate } from './words.ts'

interface Props {
  game: GameState
  plan: DayPlan
  /** Receives a function that turns the latest plan into the new one. */
  onChange: (change: (plan: DayPlan) => DayPlan) => void
  onStart: () => void
}

/** The planning screen: read the forecast, give out jobs, start the day. */
export function DayScreen({ game, plan, onChange, onStart }: Props) {
  const today = weatherOn(game.scenario, game.day)
  const noRadio = radioDown(game.scenario, game.day)
  const level = forecastLevel(game.scenario, game.day)

  // Supplies do not depend on the storm, so running the day ahead of time is a
  // safe way to preview them. Nothing about health is shown from this preview.
  const preview = resolveDay(game, plan).report

  const setJob = (astronautId: string, job: Job) =>
    onChange((latest) => ({ ...latest, jobs: { ...latest.jobs, [astronautId]: job } }))

  const shipIn = daysUntilSupplyShip(game.day)

  return (
    <main className="screen day">
      <header className="day-head">
        <div>
          <p className="eyebrow">
            Day {game.day} of {MISSION_DAYS}
          </p>
          <h1>Plan the day</h1>
        </div>
        <div className="day-facts">
          <span title="Science stars collected so far">🔬 Science: {game.science}</span>
          <span>🚀 {shipIn === 0 ? 'Supply ship lands tonight!' : `Supply ship in ${shipIn + 1} days`}</span>
        </div>
      </header>

      <div className="day-grid">
        <section className="panel" aria-labelledby="forecast-title">
          <h2 id="forecast-title">📡 Message from Mission Control</h2>
          {noRadio ? (
            <div className="forecast forecast-none">
              <p className="forecast-level">No forecast today</p>
              <p>
                Yesterday's storm knocked out our radio link to Earth. Mission Control cannot reach you this
                morning. You decide.
              </p>
            </div>
          ) : (
            <div className={`forecast forecast-${level}`}>
              <p className="forecast-level">Storm chance today: {FORECAST_WORDS[level].label}</p>
              <p>{flareSentence(yesterdayOf(game.scenario, game.day))}</p>
              <p>{FORECAST_WORDS[level].advice}</p>
            </div>
          )}
          <p className="hint">Real Sun data for {longDate(today.date)}, from NASA DONKI.</p>
          <details className="explain">
            <summary>What is a solar storm?</summary>
            <p>
              A solar flare is a giant flash on the Sun. After a big flare, the Sun can throw out a burst of
              very fast particles: a solar storm. Earth's air and magnetic field block them. The Moon has
              neither, so astronauts there need thick walls to hide behind.
            </p>
          </details>

          <h2>Supplies</h2>
          <SupplyBars now={game.resources} after={preview.resourcesAfter} />
          {preview.machinesOff && (
            <p className="warning">
              ⚠️ No power! The oxygen machine and greenhouse lamps are off today. Fix the solar panels first.
            </p>
          )}
          {preview.crew
            .filter((astronaut) => astronaut.noSuitOxygen)
            .map((astronaut) => (
              <p key={astronaut.id} className="warning">
                ⚠️ Not enough oxygen to fill a space suit. {astronaut.name} cannot go outside today.
              </p>
            ))}
          {preview.ranOutOf
            .filter((name) => name !== 'power')
            .map((name) => (
              <p key={name} className="warning">
                ⚠️ With this plan the base runs out of {name} today. Everyone will get weaker.
              </p>
            ))}
        </section>

        <section className="panel" aria-labelledby="crew-title">
          <h2 id="crew-title">👩‍🚀 Your crew</h2>
          <div className={`crew${plan.shelter ? ' crew-sheltered' : ''}`}>
            {game.crew.map((astronaut) => {
              const sick = astronaut.health <= 0
              const chosen: Job = sick ? 'rest' : (plan.jobs[astronaut.id] ?? 'rest')
              return (
                <div key={astronaut.id} className="astronaut astronaut-plan">
                  <div className="astronaut-head">
                    <span className="astronaut-name">{astronaut.name}</span>
                    <span className="hearts" aria-label={`Health ${astronaut.health}`}>
                      {hearts(astronaut.health)}
                    </span>
                    {sick && <span className="warning">Too sick to work. Must rest today.</span>}
                  </div>
                  <div className="jobs" role="group" aria-label={`Job for ${astronaut.name}`}>
                    {JOBS.map((job) => (
                      <button
                        key={job}
                        type="button"
                        className={`job${chosen === job ? ' job-chosen' : ''}`}
                        aria-pressed={chosen === job}
                        disabled={plan.shelter || (sick && job !== 'rest')}
                        onClick={() => setJob(astronaut.id, job)}
                      >
                        <span className="job-icon">{JOB_WORDS[job].icon}</span>
                        <span className="job-name">{JOB_WORDS[job].name}</span>
                        <span className="job-effect">{JOB_WORDS[job].effect}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
          <p className="hint">
            Exploring is outside the base. In a storm, people outside get hurt the most. The base walls block
            only some of it.
          </p>

        </section>
      </div>

      {/* Always visible at the bottom, so the two big decisions never scroll away. */}
      <div className="action-bar">
        <label className={`shelter-toggle${plan.shelter ? ' shelter-on' : ''}`}>
          <input
            type="checkbox"
            checked={plan.shelter}
            onChange={(event) => {
              const shelter = event.target.checked
              onChange((latest) => ({ ...latest, shelter }))
            }}
          />
          <span>
            <strong>🛡️ Everyone into the storm shelter</strong>
            <span className="shelter-detail">
              Safe from any storm. Nobody works today, and the base still uses its supplies.
            </span>
          </span>
        </label>
        <button type="button" className="primary" onClick={onStart}>
          Start the day ▶
        </button>
      </div>
    </main>
  )
}
