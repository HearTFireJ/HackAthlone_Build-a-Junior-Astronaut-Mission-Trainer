import { crewInfo } from '../game/content.ts'
import { colourOf, lookOf } from '../scene/draw.ts'

/** A small portrait of an astronaut, in the same colours as their figure on the base. */
export function Avatar({ id, size = 44 }: { id: string; size?: number }) {
  const look = lookOf(id)
  const colour = colourOf(id)
  return (
    <svg className="avatar" width={size} height={size} viewBox="0 0 44 44" role="img" aria-label={crewInfo(id).name}>
      <circle cx="22" cy="22" r="21" fill="#141b33" stroke={colour} strokeWidth="2" />
      <clipPath id={`clip-${id}`}>
        <circle cx="22" cy="22" r="20" />
      </clipPath>
      <g clipPath={`url(#clip-${id})`}>
        {/* shoulders in their own colour */}
        <rect x="6" y="32" width="32" height="16" rx="8" fill={colour} />
        {/* long hair is two locks beside the face: joined under the chin it looked like a beard */}
        {look.style === 'long' && [8.5, 28.5].map((x) => <rect key={x} x={x} y="16" width="7" height="23" rx="3.5" fill={look.hair} />)}
        <circle cx="22" cy="20" r="12.5" fill={look.hair} />
        {look.style === 'bun' && <circle cx="22" cy="6.5" r="5" fill={look.hair} />}
        {look.style === 'curly' && [[12, 12], [18, 8], [26, 8], [32, 12]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="5" fill={look.hair} />)}
        <circle cx="22" cy="23" r="9.5" fill={look.skin} />
        <circle cx="18.2" cy="23" r="1.5" fill="#171c31" />
        <circle cx="25.8" cy="23" r="1.5" fill="#171c31" />
        <path d="M18.5 27.5 Q22 30 25.5 27.5" fill="none" stroke="#171c31" strokeWidth="1.3" strokeLinecap="round" />
      </g>
    </svg>
  )
}
