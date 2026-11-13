import { type DayReport, type GameState, RESOURCES } from '../game/mission.ts'
import { forecastLevel, radioDown, weatherOn } from '../game/scenario.ts'
import { SupplyBars } from './SupplyBars.tsx'
import { FORECAST_WORDS, JOB_WORDS, RESOURCE_WORDS, hearts, longDate, spacecraftList } from './words.ts'

interface Props {
  /** The game after the day was played. */
  game: GameState
  report: DayReport
  onNext: () => void
}

/** What the forecast said compared with what the Sun really did. */
function forecastVerdict(game: GameState, report: DayReport): string | null {
  if (radioDown(game.scenario, report.day)) return null
  const level = forecastLevel(game.scenario, report.day)
  const said = `Mission Control said ${FORECAST_WORDS[level].label}.`
  if (report.storm > 0 && level === 'high') return `${said} The forecast was right.`
  if (report.storm > 0) return `${said} A surprise! Storms can come even when the chance looks small.`
  if (level === 'high') return `${said} No storm came. HIGH means "more likely", not "for sure".`
  return `${said} The forecast was right.`
}

/** The end of one day: what the Sun did, and what it meant for the crew and supplies. */
export function ResultScreen({ game, report, onNext }: Props) {
  const weather = weatherOn(game.scenario, report.day)
  const verdict = forecastVerdict(game, report)
  const over = game.status !== 'playing'
  const link = weather.particleEvents[0]?.link

  return (
    <main className="screen result">
      <header className="day-head">
        <div>
          <p className="eyebrow">End of day {report.day}</p>
          <h1>{report.storm === 0 ? '☀️ A calm day' : report.storm === 2 ? '🌩️ A severe solar storm!' : '🌩️ A solar storm!'}</h1>
        </div>
      </header>

      <div className="day-grid">
        <section className="panel">
          <h2>What the Sun did</h2>
          {report.storm === 0 ? (
            <p>No burst of solar particles was measured near Earth on {longDate(report.date)}.</p>
          ) : (
            <p>
              On {longDate(report.date)}, {spacecraftList(weather)} measured a burst of fast particles from the
              Sun{report.storm === 2 ? ', including very powerful ones' : ''}.{' '}
              {link && (
                <a href={link} target="_blank" rel="noreferrer">
                  See NASA's record
                </a>
              )}
            </p>
          )}
          {verdict && <p className="verdict">{verdict}</p>}
          {weather.maxKp !== null && weather.maxKp >= 7 && (
            <p className="hint">
              Back on Earth, the same space weather shook the planet's magnetic field and lit up the northern
              lights far from the North Pole.
            </p>
          )}
          {report.shelter && report.storm > 0 && (
            <p className="good">🛡️ Everyone was in the storm shelter. Nobody was hurt.</p>
          )}
          {report.shelter && report.storm === 0 && (
            <p className="hint">
              🛡️ Everyone stayed in the shelter, but no storm came. A day of work was lost. That is the price of
              playing it safe.
            </p>
          )}

          <h2>Supplies</h2>
          <SupplyBars now={report.resourcesAfter} />
          <p className="hint">
            Today:{' '}
            {RESOURCES.map((name) => `${RESOURCE_WORDS[name].name} +${report.produced[name]} −${report.used[name]}`).join(
              ' · ',
            )}
          </p>
          {report.machinesOff && (
            <p className="warning">
              ⚠️ There was no power this morning, so the oxygen machine and greenhouse lamps could not run.
            </p>
          )}
          {report.ranOutOf.map((name) => (
            <p key={name} className="warning">
              ⚠️ The base ran out of {name}.{' '}
              {name === 'power' ? 'Tomorrow the machines will be off.' : 'Everyone got weaker, and nobody could recover.'}
            </p>
          ))}
          {report.scienceGained > 0 && <p className="good">🔬 Science stars earned today: {report.scienceGained}</p>}
        </section>

        <section className="panel">
          <h2>Your crew</h2>
          <div className="crew">
            {report.crew.map((astronaut) => {
              return (
                <div key={astronaut.id} className="astronaut">
                  <div className="astronaut-head">
                    <span className="astronaut-name">{astronaut.name}</span>
                    <span className="hearts" aria-label={`Health ${astronaut.healthAfter}`}>
                      {hearts(astronaut.healthAfter)}
                    </span>
                  </div>
                  <p>
                    {astronaut.did === 'shelter'
                      ? 'Stayed in the storm shelter.'
                      : astronaut.tooSickToWork
                        ? 'Was too sick to work, and rested.'
                        : `${astronaut.name} ${JOB_WORDS[astronaut.did].past}.`}
                  </p>
                  {astronaut.stormDamage > 0 && (
                    <p className="warning">
                      {astronaut.did === 'science'
                        ? `Caught outside in the storm: −${astronaut.stormDamage} health.`
                        : `The base walls blocked only part of the storm: −${astronaut.stormDamage} health.`}
                    </p>
                  )}
                  {astronaut.shortageDamage > 0 && (
                    <p className="warning">Not enough air or food: −{astronaut.shortageDamage} health.</p>
                  )}
                  {astronaut.healed > 0 && <p className="good">Rested: +{astronaut.healed} health.</p>}
                  {astronaut.healthAfter <= 0 && <p className="warning">Too sick to work tomorrow.</p>}
                </div>
              )
            })}
          </div>

          <button type="button" className="primary" onClick={onNext}>
            {over ? 'See the mission report ▶' : `Go to day ${game.day} ▶`}
          </button>
        </section>
      </div>
    </main>
  )
}
