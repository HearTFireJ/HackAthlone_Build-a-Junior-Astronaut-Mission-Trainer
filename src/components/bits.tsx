// Small pieces of the screen that several components share.

import type { CSSProperties } from 'react'
import { crewInfo } from '../game/content.ts'

/** An astronaut seen from above: a round helmet in their own colour, with their initial. */
export function Token({ id, small = false, selected = false }: { id: string; small?: boolean; selected?: boolean }) {
  const info = crewInfo(id)
  return (
    <span
      className={`token${small ? ' small' : ''}${selected ? ' selected' : ''}`}
      style={{ '--token': info.colour } as CSSProperties}
      title={info.name}
    >
      {info.name[0]}
    </span>
  )
}

/** A row of little marks, like five hearts with three filled in. */
export function Pips({ label, icon, value, max, tone }: { label: string; icon: string; value: number; max: number; tone: string }) {
  return (
    <span className={`pips tone-${tone}`} title={`${label}: ${value} of ${max}`}>
      <span className="pips-label">{label}</span>
      <span aria-hidden="true">
        {Array.from({ length: max }, (_, index) => (
          <span key={index} className={index < value ? 'pip on' : 'pip'}>
            {icon}
          </span>
        ))}
      </span>
      <span className="sr-only">
        {value} of {max}
      </span>
    </span>
  )
}

/** Shows a change in a stat, like "♥ 4 → 2". */
export function Change({ icon, before, after }: { icon: string; before: number; after: number }) {
  const tone = after > before ? 'up' : after < before ? 'down' : 'same'
  return (
    <span className={`change ${tone}`}>
      {icon} {before === after ? after : `${before} → ${after}`}
    </span>
  )
}
