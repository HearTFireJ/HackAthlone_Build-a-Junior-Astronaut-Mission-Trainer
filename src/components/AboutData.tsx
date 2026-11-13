import { DATA_SOURCE } from '../data/scenarios.ts'
import { longDate } from './words.ts'

/** Tells the player, honestly, what is real NASA data and what is made simple for the game. */
export function AboutData() {
  return (
    <details className="about">
      <summary>What is real in this game?</summary>
      <div className="about-body">
        <h3>Real</h3>
        <ul>
          <li>
            The dates, the solar flares and their sizes, and the days when spacecraft near Earth measured a
            burst of fast particles from the Sun. They come from NASA's space weather database, called DONKI.
          </li>
          <li>
            These are saved records, not live data. We copied them from{' '}
            <a href={DATA_SOURCE.url} target="_blank" rel="noreferrer">
              NASA DONKI
            </a>{' '}
            on {longDate(DATA_SOURCE.retrievedAt)}.
          </li>
          <li>
            The Moon has no air and no magnetic field to block those particles. That is why astronauts need a
            storm shelter.
          </li>
        </ul>
        <h3>Made simple for the game</h3>
        <ul>
          <li>Power, oxygen and food are counted in small made-up units, and health is shown as hearts.</li>
          <li>A whole day is either a storm day or a calm day. Real storms can last hours or days.</li>
          <li>
            The forecast only looks at yesterday's biggest flare. Real forecasters use much more, and they are
            still sometimes wrong.
          </li>
          <li>After a storm, the radio link is down the next morning. That is a game rule.</li>
          <li>
            The Moon base, the crew and Mission Control in Athlone are made up. Mission Control is inspired by
            I-LOFAR, a real radio telescope at Birr Castle in County Offaly that listens to the Sun.
          </li>
        </ul>
      </div>
    </details>
  )
}
