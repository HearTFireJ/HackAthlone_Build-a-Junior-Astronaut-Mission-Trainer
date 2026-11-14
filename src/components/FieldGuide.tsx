import { FACTS, type FactId } from '../data/facts.ts'
import type { ScenarioInfo } from '../data/scenarios.ts'
import type { DayReport, GameState } from '../game/outpost.ts'
import { AboutBody } from './AboutData.tsx'
import { FactLine } from './bits.tsx'
import { clock, longDate } from './words.ts'

/** True for a day on which the real Sun did something worth a line in the guide. */
const sunDid = (day: DayReport) => day.flare !== null || day.storm !== null

interface Props {
  info: ScenarioInfo
  game: GameState
  facts: FactId[]
  onClose: () => void
}

/**
 * The field guide: everything real behind the game, kept out of the way of playing.
 * It fills up as the mission goes on: real flares and storms the player has lived
 * through, and real-life facts they have come across.
 */
export function FieldGuide({ info, game, facts, onClose }: Props) {
  const days = game.history.filter(sunDid)
  const total = Object.keys(FACTS).length
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Field guide">
      <div className="card card-guide">
        <p className="eyebrow">Field guide</p>
        <h2>📖 The real science behind your outpost</h2>

        <section className="guide-part">
          <h3>☀️ What the real Sun did</h3>
          <p className="hint">
            The Sun in this mission does what the real Sun did on {info.dates}. Each line opens NASA's own record.
          </p>
          {days.length === 0 ? (
            <p className="guide-empty">Nothing here yet. Big flares and storms you live through are written down here.</p>
          ) : (
            <ul className="guide-sun">
              {days.map((day) => (
                <li key={day.day}>
                  <strong>
                    Day {day.day} · {longDate(day.date)}
                  </strong>
                  {day.flare && (
                    <a href={day.flare.link} target="_blank" rel="noreferrer">
                      Flare, class {day.flare.class}, at {clock(day.flare.time)} UTC{day.flare.cme ? ', with a cloud of gas' : ', no cloud listed'}
                    </a>
                  )}
                  {day.storm && (
                    <a href={day.storm.link} target="_blank" rel="noreferrer">
                      {day.storm.severe ? 'Severe particle storm' : 'Particle storm'}, first measured at {clock(day.storm.time)} UTC
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="guide-part">
          <h3>
            🔎 Real life: {facts.length} of {total} found
          </h3>
          <div className="guide-facts">
            {facts.map((id) => (
              <FactLine key={id} id={id} />
            ))}
          </div>
          {facts.length < total && <p className="guide-empty">{total - facts.length} more to find as you play.</p>}
        </section>

        <section className="guide-part">
          <h3>What is real in this game?</h3>
          <AboutBody />
        </section>

        <button type="button" className="primary" onClick={onClose}>
          Back to the base ▶
        </button>
      </div>
    </div>
  )
}
