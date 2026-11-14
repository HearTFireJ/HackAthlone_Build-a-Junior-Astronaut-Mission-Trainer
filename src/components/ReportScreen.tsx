import type { ScenarioInfo } from '../data/scenarios.ts'
import { type GameState, MISSION_DAYS, RULES, starsFor } from '../game/mission.ts'
import { forecastLevel, radioDown } from '../game/scenario.ts'
import { AboutData } from './AboutData.tsx'
import { FORECAST_WORDS, longDate, stars } from './words.ts'

interface Props {
  game: GameState
  info: ScenarioInfo
  onReplay: () => void
  onPickAnother: () => void
}

/** Short, friendly lessons drawn from what actually happened in this mission. */
function lessons(game: GameState): string[] {
  const days = game.history
  const stormsInShelter = days.filter((day) => day.storm > 0 && day.shelter).length
  const stormsOutOfShelter = days.filter((day) => day.storm > 0 && !day.shelter).length
  const shelterNoStorm = days.filter((day) => day.storm === 0 && day.shelter).length
  const shortDays = days.filter((day) => day.ranOutOf.some((name) => name !== 'power')).length
  const list: string[] = []

  if (stormsInShelter > 0) {
    list.push(`You had the crew in the shelter for ${stormsInShelter} storm${stormsInShelter > 1 ? 's' : ''}. Good call.`)
  }
  if (stormsOutOfShelter > 0) {
    list.push(
      `${stormsOutOfShelter} storm${stormsOutOfShelter > 1 ? 's' : ''} hit while the crew was out of the shelter. After one storm, more often follow.`,
    )
  }
  if (shelterNoStorm > 0) {
    list.push(
      `You used the shelter ${shelterNoStorm} time${shelterNoStorm > 1 ? 's' : ''} when no storm came. Real mission planners pay that price too, because nobody can forecast the Sun perfectly.`,
    )
  }
  if (shortDays > 0) {
    list.push(`The base ran out of air or food on ${shortDays} day${shortDays > 1 ? 's' : ''}. Keeping a little extra helps on shelter days.`)
  }
  if (days.every((day) => day.storm === 0)) {
    list.push('The Sun stayed quiet the whole time. With no storms, the hard part was sharing three people between four jobs.')
  }
  return list
}

/** The end of the mission: how it went, what really happened each day, and what it teaches. */
export function ReportScreen({ game, info, onReplay, onPickAnother }: Props) {
  const won = game.status === 'won'
  const starCount = starsFor(game)
  const [twoStars, threeStars] = RULES.starThresholds

  return (
    <main className="screen report">
      <header className="report-head">
        <p className="eyebrow">Mission report · {info.title}</p>
        {won ? (
          <>
            <h1>🚀 The supply ship has landed!</h1>
            <p className="big-stars" aria-label={`${starCount} of 3 stars`}>
              {stars(starCount)}
            </p>
            <p className="lead">
              Your crew lasted all {MISSION_DAYS} days and collected {game.science} science star
              {game.science === 1 ? '' : 's'}.{' '}
              {starCount < 3
                ? `Collect ${starCount === 1 ? twoStars : threeStars} for ${starCount + 1} stars next time.`
                : 'A top-class mission!'}
            </p>
          </>
        ) : (
          <>
            <h1>🏠 Time to head home</h1>
            <p className="lead">
              On day {game.day} the whole crew was too sick to keep the base running, so Mission Control
              brought everyone back to Earth. They are safe and will be fine. Every mission teaches something.
              Ready to try again?
            </p>
          </>
        )}
        <div className="report-actions">
          <button type="button" className="primary" onClick={onReplay}>
            Play this mission again ▶
          </button>
          <button type="button" className="secondary" onClick={onPickAnother}>
            Choose another mission
          </button>
        </div>
      </header>

      <div className="day-grid">
        <section className="panel">
          <h2>What you can learn from this mission</h2>
          <ul className="lessons">
            {lessons(game).map((lesson) => (
              <li key={lesson}>{lesson}</li>
            ))}
          </ul>
          <h2>What real astronauts do</h2>
          <p>
            NASA's Orion spacecraft has a plan for solar storms. The crew builds a shelter in the middle of the
            cabin and packs bags of supplies, food and water around themselves. Those bags help block the
            particles.{' '}
            <a
              href="https://www.nasa.gov/missions/artemis/orion/scientists-and-engineers-evaluate-orion-radiation-protection-plan/"
              target="_blank"
              rel="noreferrer"
            >
              Read about it at NASA
            </a>
          </p>
          <h2>What really happened</h2>
          <p>{info.blurb}</p>
          <p className="hint">
            Sources:{' '}
            {info.sources.map((source, index) => (
              <span key={source.url}>
                {index > 0 && ' · '}
                <a href={source.url} target="_blank" rel="noreferrer">
                  {source.label}
                </a>
              </span>
            ))}
          </p>
        </section>

        <section className="panel">
          <h2>Day by day</h2>
          <div className="table-wrap">
            <table className="timeline">
              <thead>
                <tr>
                  <th scope="col">Day</th>
                  <th scope="col">Real date</th>
                  <th scope="col">Forecast</th>
                  <th scope="col">The Sun</th>
                  <th scope="col">Your crew</th>
                </tr>
              </thead>
              <tbody>
                {game.history.map((day) => (
                  <tr key={day.day} className={day.storm > 0 && !day.shelter ? 'row-hit' : undefined}>
                    <td>{day.day}</td>
                    <td>{longDate(day.date)}</td>
                    <td>
                      {radioDown(game.scenario, day.day)
                        ? 'No radio'
                        : FORECAST_WORDS[forecastLevel(game.scenario, day.day)].label}
                    </td>
                    <td>{day.storm === 0 ? 'Calm' : day.storm === 2 ? '🌩️ Severe storm' : '🌩️ Storm'}</td>
                    <td>{day.shelter ? '🛡️ Shelter' : 'Working'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="hint">Sun data: NASA DONKI space weather database.</p>
        </section>
      </div>

      <AboutData />
    </main>
  )
}
