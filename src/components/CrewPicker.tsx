import { useState } from 'react'
import type { ScenarioInfo } from '../data/scenarios.ts'
import { CLASHES, CREW, FRIENDS, crewInfo } from '../game/content.ts'
import { crewSeats } from '../game/outpost.ts'
import { Avatar } from './Avatar.tsx'
import { Icon } from './Icon.tsx'

interface Props {
  info: ScenarioInfo
  onBack: () => void
  /** The chosen crew, in the order of the crew list. */
  onGo: (crew: string[]) => void
}

/** The names of the people paired with this astronaut in a list of pairs. */
function pairedWith(id: string, pairs: [string, string][]): string[] {
  return pairs.filter((pair) => pair.includes(id)).map((pair) => crewInfo(pair[0] === id ? pair[1] : pair[0]).name)
}

/** Between choosing a mission and landing: who comes to the Moon? */
export function CrewPicker({ info, onBack, onGo }: Props) {
  const seats = crewSeats(info.scenario.id)
  const [picked, setPicked] = useState<string[]>([])
  const left = seats - picked.length
  const toggle = (id: string) =>
    setPicked((current) => (current.includes(id) ? current.filter((other) => other !== id) : current.length < seats ? [...current, id] : current))

  return (
    <main className="screen crew-pick">
      <header className="start-head">
        <p className="eyebrow">{info.title} · {info.dates}</p>
        <h1>Choose your crew</h1>
        <p className="lead">The rocket has {seats} seats. Who comes to the Moon?</p>
      </header>

      <div className="crew-cards">
        {CREW.map((member) => {
          const on = picked.includes(member.id)
          return (
            <button
              key={member.id}
              type="button"
              className={`crew-card${on ? ' on' : ''}`}
              aria-pressed={on}
              disabled={!on && left === 0}
              onClick={() => toggle(member.id)}
            >
              {on && <span className="crew-card-tick" aria-hidden="true">✓</span>}
              <Avatar id={member.id} size={88} />
              <span className="crew-card-name">{member.name}</span>
              {/* The same three short tags as on the job menu: what decides who to take. */}
              <span className="trait love"><Icon name="heart" /> Loves {member.lovesText}</span>
              {pairedWith(member.id, FRIENDS).map((name) => (
                <span key={name} className="trait friend"><Icon name="smile" /> Happier beside {name}</span>
              ))}
              {pairedWith(member.id, CLASHES).map((name) => (
                <span key={name} className="trait clash"><Icon name="sad" /> Grumpy beside {name}</span>
              ))}
            </button>
          )
        })}
      </div>

      <div className="crew-pick-foot">
        <button type="button" className="back" onClick={onBack}>Back</button>
        <span className="crew-count">{left > 0 ? `Pick ${left} more` : 'Crew ready!'}</span>
        <button
          type="button"
          className="primary"
          disabled={left > 0}
          onClick={() => onGo(CREW.filter((member) => picked.includes(member.id)).map((member) => member.id))}
        >
          Take command <Icon name="play" />
        </button>
      </div>
    </main>
  )
}
