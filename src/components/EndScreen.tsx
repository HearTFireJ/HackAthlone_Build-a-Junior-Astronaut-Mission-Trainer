import type { ScenarioInfo } from '../data/scenarios.ts'
import { MISSIONS, MISSION_IDS, crewInfo } from '../game/content.ts'
import { RULES, type DayReport, type GameState, handoverReady, missionDone, rate } from '../game/outpost.ts'
import { AboutData } from './AboutData.tsx'
import { FactLine, Pips, Token } from './bits.tsx'
import { clock, longDate } from './words.ts'

interface Props {
  info: ScenarioInfo
  game: GameState
  onAgain: () => void
}

const ANSWER_WORDS: Record<DayReport['response'], string> = {
  carry: 'Carried on',
  inside: 'Called crew inside',
}

function verdict(stars: number, maxStars: number, evacuated: boolean, outOfAir: boolean): string {
  if (evacuated && outOfAir) {
    return 'The air ran out two days in a row, so the crew flew home early. Everyone is safe. Next time, give Life Support power before the air gets low.'
  }
  if (evacuated) {
    return 'Everyone was too sick or too unhappy to work, so the crew flew home early. Everyone is safe. Next time, use rest, the sick bay and calls home sooner.'
  }
  if (stars >= maxStars) return 'A perfect tour. The next commander will have a hard time beating this.'
  if (stars >= 3) return 'A strong tour. The next crew takes over a working base and real results.'
  if (stars >= 1) return 'The base is still standing and you have something to show for it. Next time, push the missions harder.'
  return 'Everyone is safe, but the missions are still waiting. What would you do differently?'
}

/** The last screen: how the tour went, and what the real Sun did on those days. */
export function EndScreen({ info, game, onAgain }: Props) {
  const rating = rate(game)
  const evacuated = game.status === 'evacuated'
  const days = game.history.length
  const storms = game.history.filter((day) => day.storm)

  return (
    <main className="screen end">
      <header className="end-head">
        <p className="eyebrow">
          {info.title} · {info.dates}
        </p>
        <h1>{evacuated ? 'Mission cut short' : 'The next crew has arrived'}</h1>
        <p className="stars" aria-label={`${rating.stars} of ${rating.maxStars} stars`}>
          {Array.from({ length: rating.maxStars }, (_, index) => (
            <span key={index} className={index < rating.stars ? 'star on' : 'star'}>
              ★
            </span>
          ))}
        </p>
        <p className="lead">{verdict(rating.stars, rating.maxStars, evacuated, game.airOutDays >= 2)}</p>
        {!evacuated && days < RULES.maxDays && (
          <p className="hint">
            You handed the base over early, after day {days} of {RULES.maxDays}.
          </p>
        )}
        <button type="button" className="primary" onClick={onAgain}>
          Command another mission ▶
        </button>
      </header>

      <div className="end-grid">
        <section className="panel">
          <h2>Your missions</h2>
          <ul className="missions">
            {MISSION_IDS.map((id) => {
              const done = missionDone(game.missions, id)
              return (
                <li key={id} className={done ? 'mission done' : 'mission'}>
                  <div className="mission-head">
                    <span>
                      {done ? '⭐' : '⬜'} {MISSIONS[id].name}
                    </span>
                    <span className="mission-count">
                      {Math.min(game.missions[id], MISSIONS[id].goal)}/{MISSIONS[id].goal}
                    </span>
                  </div>
                </li>
              )
            })}
            <li className={handoverReady(game) ? 'mission done' : 'mission'}>
              <div className="mission-head">
                <span>{handoverReady(game) ? '⭐' : '⬜'} Hand over the base</span>
                <span className="mission-count">
                  💨 {game.air} · 🥕 {game.food}
                </span>
              </div>
              <p className="mission-text">
                Needs {RULES.handover.air} air, {RULES.handover.food} food, and everyone at {RULES.handover.stat} or more
                for health and mood.
              </p>
            </li>
          </ul>
        </section>

        <section className="panel">
          <h2>Your crew after {days} {days === 1 ? 'day' : 'days'}</h2>
          <ul className="end-crew">
            {game.crew.map((astronaut) => (
              <li key={astronaut.id}>
                <Token id={astronaut.id} />
                <span>
                  <strong>{crewInfo(astronaut.id).name}</strong>
                  <span className="crew-stats">
                    <Pips label="Health" icon="♥" value={astronaut.health} max={RULES.maxStat} tone="health" />
                    <Pips label="Mood" icon="☺" value={astronaut.mood} max={RULES.maxStat} tone="mood" />
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="panel">
        <h2>What the real Sun did</h2>
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
        <p>
          {storms.length === 0
            ? 'No particle storm began while you were in command.'
            : `${storms.length} real particle ${storms.length === 1 ? 'storm' : 'storms'} began while you were in command.`}
        </p>
        <div className="table-wrap">
          <table className="timeline">
            <thead>
              <tr>
                <th scope="col">Day</th>
                <th scope="col">Real date</th>
                <th scope="col">Biggest flare alert</th>
                <th scope="col">Particle storm</th>
                <th scope="col">Your call</th>
              </tr>
            </thead>
            <tbody>
              {game.history.map((day) => (
                <tr key={day.day} className={day.storm ? 'stormy' : undefined}>
                  <td>{day.day}</td>
                  <td>{longDate(day.date)}</td>
                  <td>
                    {day.flare ? (
                      <a href={day.flare.link} target="_blank" rel="noreferrer">
                        {day.flare.class} at {clock(day.flare.time)}
                        {day.flare.cme ? ', with a cloud' : ', no cloud listed'}
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    {day.storm ? (
                      <a href={day.storm.link} target="_blank" rel="noreferrer">
                        {day.storm.severe ? 'Severe storm' : 'Storm'} at {clock(day.storm.time)}
                      </a>
                    ) : (
                      'None began'
                    )}
                  </td>
                  <td>{day.alertShown ? ANSWER_WORDS[day.response] : day.flare ? 'Radio was off' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="hint">
          Times are in UTC. Every flare and storm links to its record in NASA's DONKI database. A storm is shown on the
          day it began; real particle storms can go on for days.
        </p>
      </section>

      {game.flares.length > 0 && (
        <section className="panel">
          <h2>🔭 Flares your Sun Telescope recorded</h2>
          <ul className="flare-cards">
            {game.flares.map((flare) => (
              <li key={flare.time}>
                <strong>Class {flare.class}</strong>
                <span>
                  {longDate(flare.date)}, {clock(flare.time)} UTC
                </span>
                <span>{flare.cme ? 'Threw a cloud of gas into space' : 'No cloud of gas listed'}</span>
                <a href={flare.link} target="_blank" rel="noreferrer">
                  NASA record
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="panel facts">
        <h2>The real science behind your outpost</h2>
        <FactLine id="ice" />
        <FactLine id="rover" />
        <FactLine id="shield" />
        <FactLine id="sun" />
        <FactLine id="fraction" />
        <FactLine id="dish" />
        <FactLine id="hazards" />
        <FactLine id="plants" />
      </section>

      <AboutData />
    </main>
  )
}
