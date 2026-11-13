import { CREW_SIZE, daysUntilSupplyShip } from '../game/mission.ts'

// Components only show things and report clicks.
// Every number on screen comes from src/game/, never from here.
export function TitleScreen() {
  return (
    <main className="title-screen">
      <p className="eyebrow">Mission Control · Athlone, Ireland</p>
      <h1>Junior Astronaut Mission Trainer</h1>
      <p className="lead">
        A Moon base, {CREW_SIZE} astronauts, and a supply ship that lands in{' '}
        {daysUntilSupplyShip(1) + 1} days. Can you keep everyone safe until then?
      </p>
      <p className="status">🌙 Base under construction — come back soon.</p>
      <footer>A NASA Space Apps Challenge 2026 project, built at HackAthlone.</footer>
    </main>
  )
}
