import type { CSSProperties, ReactNode } from 'react'
import { JOBS, MISSIONS, MODULES, TRIPS, type ModuleId, type Place } from '../game/content.ts'
import {
  RULES,
  airPerDay,
  type GameState,
  type Job,
  type Plan,
  availableTrips,
  canRun,
  jobProblem,
  missionDone,
  powerAvailable,
  powerUsed,
  poweredModules,
  solarToday,
} from '../game/outpost.ts'
import { Token } from './bits.tsx'
import { MODULE_ICONS } from './words.ts'

interface Props {
  game: GameState
  plan: Plan
  selected: string | null
  onTogglePower: (module: ModuleId) => void
  onAssign: (astronautId: string, job: Job) => void
  onSelect: (astronautId: string) => void
}

// Where each part of the base sits on the map, in percent of the map's width and height.
// The layout is fixed: the outpost arrived ready-built, so there is nothing to place.
const SPOTS = {
  comms: { left: 3, top: 5, width: 21, height: 25 },
  panels: { left: 30, top: 4, width: 40, height: 20 },
  scope: { left: 76, top: 5, width: 21, height: 25 },
  life: { left: 3, top: 37, width: 23, height: 27 },
  habitat: { left: 32, top: 31, width: 36, height: 34 },
  farm: { left: 74, top: 37, width: 23, height: 27 },
  shelter: { left: 2, top: 71, width: 17.5, height: 25 },
  lab: { left: 21.5, top: 71, width: 17.5, height: 25 },
  garage: { left: 41, top: 71, width: 17.5, height: 25 },
  site: { left: 60.5, top: 71, width: 18.5, height: 25 },
  crater: { left: 81, top: 69, width: 17, height: 28 },
} as const
type SpotId = keyof typeof SPOTS

// Small craters on the ground between the buildings: [x, y, radius] on a 160 by 100 grid.
const CRATERS: [number, number, number][] = [
  [43, 15, 3.4], [116.5, 13, 2.4], [45.5, 49, 2.8], [113.5, 56, 2.1], [20, 33.6, 1.9], [141, 33.4, 1.7],
  [80, 68.2, 1.5], [10, 67.6, 1.4], [150, 66, 1.3], [62, 27.6, 1.4], [100, 27.4, 1.1], [128, 67, 1.1],
  [30, 67.8, 1], [38, 31, 0.8], [124, 31.5, 0.9], [95, 67.5, 0.8],
]

const box = (spot: SpotId): CSSProperties => {
  const { left, top, width, height } = SPOTS[spot]
  return { left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` }
}
const centre = (spot: SpotId) => {
  const { left, top, width, height } = SPOTS[spot]
  return { x: left + width / 2, y: top + height / 2 }
}

/** The outpost seen from above. Modules light up when they have power. */
export function BaseMap({ game, plan, selected, onTogglePower, onAssign, onSelect }: Props) {
  const on = poweredModules(game, plan)
  const spare = powerAvailable(game) - powerUsed(game, plan)
  const trips = availableTrips(game)

  // Which place each astronaut will spend the day in, from the plan.
  const whoIsAt = (place: Place) =>
    game.crew.filter((astronaut) => {
      if (astronaut.away) return place === 'away'
      const job = plan.jobs[astronaut.id] ?? { kind: 'rest' as const }
      const real = jobProblem(game, plan, astronaut.id, job) ? 'habitat' : JOBS[job.kind].place
      return real === place
    })

  const tokens = (place: Place) => (
    <span className="tokens">
      {whoIsAt(place).map((astronaut) => (
        <button
          key={astronaut.id}
          type="button"
          className="token-button"
          disabled={!!astronaut.away}
          onClick={(event) => {
            event.stopPropagation()
            onSelect(astronaut.id)
          }}
        >
          <Token id={astronaut.id} small selected={selected === astronaut.id} />
        </button>
      ))}
    </span>
  )

  // Clicking a place while an astronaut is selected gives them the job done there.
  const jobAt: Partial<Record<SpotId, Job>> = {
    farm: { kind: 'garden' },
    lab: { kind: 'lab' },
    site: { kind: 'build' },
    panels: { kind: 'repair' },
    habitat: { kind: 'rest' },
    garage: trips.length > 0 ? { kind: 'trip', trip: trips[0] } : undefined,
    crater: trips.length > 0 ? { kind: 'trip', trip: trips[0] } : undefined,
  }
  const canSendTo = (spot: SpotId) => {
    const job = jobAt[spot]
    return !!selected && !!job && !jobProblem(game, plan, selected, job)
  }
  const place = (spot: SpotId, className: string, children: ReactNode) => {
    const target = canSendTo(spot)
    const job = jobAt[spot]
    return (
      <div
        className={`spot ${className}${target ? ' target' : ''}`}
        style={box(spot)}
        onClick={target && selected && job ? () => onAssign(selected, job) : undefined}
        role={target ? 'button' : undefined}
      >
        {children}
      </div>
    )
  }

  const powered = (module: ModuleId, spot: SpotId, place_: Place | null, status: string) => {
    const running = on.includes(module)
    const broken = game.broken.includes(module)
    const blocked = !canRun(game, module)
    const cost = MODULES[module].power
    const cannotAfford = !running && cost > spare
    return place(
      spot,
      `module module-${module} ${running ? 'on' : 'off'}${broken ? ' broken' : ''}`,
      <>
        <span className="spot-icon" aria-hidden="true">{MODULE_ICONS[module]}</span>
        <span className="spot-name">{MODULES[module].name}</span>
        <span className={cannotAfford && !broken && !blocked ? 'spot-status short' : 'spot-status'}>
          {broken
            ? 'Broken: needs a repair'
            : blocked
              ? 'Cannot run today'
              : running
                ? status
                : cannotAfford
                  ? `${MODULES[module].does}. Not enough power left.`
                  : MODULES[module].does}
        </span>
        <button
          type="button"
          className={`switch${running ? ' on' : ''}`}
          disabled={blocked || cannotAfford}
          title={cannotAfford ? 'Not enough power left' : undefined}
          aria-pressed={running}
          onClick={(event) => {
            event.stopPropagation()
            onTogglePower(module)
          }}
        >
          ⚡{cost} {running ? 'ON' : 'OFF'}
        </button>
        {place_ && tokens(place_)}
      </>,
    )
  }

  const hub = centre('habitat')
  const corridors: SpotId[] = ['life', 'farm', 'lab', 'garage', 'shelter']
  const paths: SpotId[] = ['comms', 'scope', 'panels', 'site']
  const solar = solarToday(game)
  const iceDone = missionDone(game.missions, 'ice')
  const away = whoIsAt('away')

  return (
    <div className="map">
      {/* The Moon's surface: craters, lit from the top left. */}
      <svg className="map-ground" viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          <radialGradient id="pit" cx="38%" cy="34%" r="75%">
            <stop offset="0%" stopColor="#1b1d27" />
            <stop offset="70%" stopColor="#2a2d3a" />
            <stop offset="100%" stopColor="#555a6c" />
          </radialGradient>
        </defs>
        {CRATERS.map(([x, y, r]) => (
          <g key={`${x}-${y}`}>
            <circle cx={x} cy={y} r={r * 1.35} fill="rgba(255,255,255,0.045)" />
            <circle cx={x} cy={y} r={r} fill="url(#pit)" />
            <path d={`M ${x - r * 0.7} ${y + r * 0.72} A ${r} ${r} 0 0 0 ${x + r * 0.72} ${y - r * 0.7}`} className="rim" />
          </g>
        ))}
      </svg>
      {/* Corridors and footpaths, drawn under the modules. */}
      <svg className="map-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {corridors.map((spot) => (
          <g key={spot}>
            <line x1={hub.x} y1={hub.y} x2={centre(spot).x} y2={centre(spot).y} className="corridor-edge" />
            <line x1={hub.x} y1={hub.y} x2={centre(spot).x} y2={centre(spot).y} className="corridor" />
          </g>
        ))}
        {paths.map((spot) => (
          <line key={spot} x1={hub.x} y1={hub.y} x2={centre(spot).x} y2={centre(spot).y} className="path" />
        ))}
        <polyline
          points={`${centre('garage').x},${centre('garage').y} ${centre('garage').x},99 ${centre('crater').x},99 ${centre('crater').x},${centre('crater').y}`}
          className="road"
        />
      </svg>

      {powered('comms', 'comms', null, 'Listening for alerts')}

      {place(
        'panels',
        'panels',
        <>
          <span className="spot-name">☀️ Solar panels</span>
          <span className="panel-row" aria-hidden="true">
            {Array.from({ length: game.solar }, (_, index) => (
              <span key={index} className={index < solar ? 'cell' : 'cell dead'} />
            ))}
          </span>
          <span className="spot-status">
            ⚡ {solar} today{game.battery > 0 ? ` + 🔋 ${game.battery} saved` : ''}
            {game.solarLoss > 0 ? ` · ${game.solarLoss} worn or dusty` : ''}
            {game.powerPenalty > 0 ? ` · ${game.powerPenalty} lost today` : ''}
          </span>
          {tokens('panels')}
        </>,
      )}

      {powered('scope', 'scope', null, 'Watching the Sun')}
      {powered('life', 'life', null, `+${airPerDay(game)} air today${game.weakLifeDays > 0 ? ' (weak pump)' : ''}`)}

      {place(
        'habitat',
        'habitat',
        <>
          <span className="spot-icon" aria-hidden="true">🛏️</span>
          <span className="spot-name">Crew quarters</span>
          <span className="spot-status">Rest · Sick bay · Call home</span>
          {tokens('habitat')}
        </>,
      )}

      {powered('farm', 'farm', 'farm', `+${RULES.farmFood} food, more if tended`)}

      {place(
        'shelter',
        missionDone(game.missions, 'shield') ? 'shelter shielded' : 'shelter',
        <>
          <span className="spot-icon" aria-hidden="true">🛡️</span>
          <span className="spot-name">Storm shelter</span>
          <span className="spot-status">
            {missionDone(game.missions, 'shield') ? 'Moon-soil shield built' : 'Safe from storms. No work in here'}
          </span>
        </>,
      )}

      {powered('lab', 'lab', 'lab', missionDone(game.missions, 'shield') ? 'Research finished' : 'Ready for research')}
      {powered('garage', 'garage', null, trips.length > 0 ? 'Rover charged for a trip' : 'Rover is out')}

      {place(
        'site',
        'site',
        <>
          <span className="spot-icon" aria-hidden="true">🏗️</span>
          <span className="spot-name">{MISSIONS.dish.name}</span>
          <span className="dish-row" aria-hidden="true">
            {Array.from({ length: MISSIONS.dish.goal }, (_, index) => (
              <span key={index} className={index < game.missions.dish ? 'mast up' : 'mast'} />
            ))}
          </span>
          <span className="spot-status">
            {missionDone(game.missions, 'dish') ? 'Listening to space!' : `${Math.min(game.missions.dish, MISSIONS.dish.goal)} of ${MISSIONS.dish.goal} built`}
          </span>
          {tokens('site')}
        </>,
      )}

      {place(
        'crater',
        'crater',
        <>
          <span className="spot-name">🌑 Dark crater</span>
          {/* The crater is small: while someone is driving there, their marker takes the place of the text. */}
          {away.length === 0 && (
            <span className="spot-status">
              {iceDone ? 'Ice found! ❄️' : `Ice trips: ${game.missions.ice} of ${MISSIONS.ice.goal}`}
              {game.pod ? ' · 📦 pod waiting' : ''}
            </span>
          )}
          {away.map((astronaut) => {
            const trip = astronaut.away?.trip ?? plan.jobs[astronaut.id]?.trip
            return (
              <span key={astronaut.id} className="far-crew" title={trip ? TRIPS[trip].name : undefined}>
                <span aria-hidden="true">🚙</span>
                <Token id={astronaut.id} small />
                <span>{astronaut.away ? `back in ${astronaut.away.daysLeft} day${astronaut.away.daysLeft === 1 ? '' : 's'}` : 'leaves today'}</span>
              </span>
            )
          })}
        </>,
      )}
    </div>
  )
}
