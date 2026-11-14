import { DATA_SOURCE } from '../data/scenarios.ts'
import { longDate } from './words.ts'

/** Tells the player, honestly, what is real NASA data and what is made up for the game. */
export function AboutData() {
  return (
    <details className="about">
      <summary>What is real in this game?</summary>
      <div className="about-body">
        <h3>Real</h3>
        <ul>
          <li>
            Every solar flare and every particle storm in the game: its date, its time and its size. They come from
            NASA's space weather database, called DONKI, and each one links to its record.
          </li>
          <li>
            Whether a huge cloud of gas left the Sun with a flare. Scientists call that cloud a coronal mass ejection,
            or CME. DONKI records which flares came with one.
          </li>
          <li>
            These are saved records, not live data. We copied them from{' '}
            <a href={DATA_SOURCE.url} target="_blank" rel="noreferrer">
              NASA DONKI
            </a>{' '}
            on {longDate(DATA_SOURCE.retrievedAt)}.
          </li>
        </ul>
        <h3>Made simple for the game</h3>
        <ul>
          <li>
            Mission Control only calls about flares of class {DATA_SOURCE.alertFlare.replace('.0', '')} or bigger. That
            cut-off is a game rule.
          </li>
          <li>
            In the game a storm lasts one day: the day spacecraft near Earth first measured it. Real particle storms
            can go on for several days.
          </li>
          <li>
            A storm is called "severe" in the game when the spacecraft measured protons above 100 MeV, which get
            through more shielding.
          </li>
          <li>
            Power, air and food are counted in small made-up units. Health, mood and hunger are shown as simple marks.
            How much a storm hurts people and how much it wears the solar panels are game rules.
          </li>
          <li>
            In the game a storm spoils some of the day's crop. Scientists are still finding out what space radiation
            does to plants, so that rule is a guess.
          </li>
        </ul>
        <h3>Made up</h3>
        <ul>
          <li>The outpost, the crew, the missions and the morning event cards.</li>
          <li>
            Mission Control in Athlone. It is inspired by I-LOFAR, a real radio telescope at Birr Castle in County
            Offaly that listens to the Sun.
          </li>
        </ul>
        <h3>How it was made</h3>
        <ul>
          <li>
            Built in one weekend at HackAthlone 2026 for the NASA Space Apps Challenge. The code was written with the
            help of AI coding tools, directed and checked by a person.
          </li>
        </ul>
      </div>
    </details>
  )
}
