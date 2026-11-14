import { crewInfo } from '../game/content.ts'
import { FACE, HAIR, HEAD, INK, colourOf, lookOf, shade } from '../scene/looks.ts'

/** The mouth: a small smile, as a curve on a head of size 1. */
const SMILE = `M ${(FACE.mouthR * 0.89).toFixed(3)} ${(FACE.mouthY + FACE.mouthR * 0.45).toFixed(3)} A ${FACE.mouthR} ${FACE.mouthR} 0 0 1 ${(-FACE.mouthR * 0.89).toFixed(3)} ${(FACE.mouthY + FACE.mouthR * 0.45).toFixed(3)}`

/** A small portrait of an astronaut: the same face and hair as their figure on the base. */
export function Avatar({ id, size = 44 }: { id: string; size?: number }) {
  const look = lookOf(id)
  const colour = colourOf(id)
  const hair = HAIR[look.style]
  // Outline width, on a head of size 1.
  const edge = 0.19
  return (
    <svg className="avatar" width={size} height={size} viewBox="0 0 44 44" role="img" aria-label={crewInfo(id).name}>
      <circle cx="22" cy="22" r="20.6" fill={shade(colour, 0.55)} stroke={INK} strokeWidth="2.4" />
      <clipPath id={`clip-${id}`}>
        <circle cx="22" cy="22" r="19.4" />
      </clipPath>
      <g clipPath={`url(#clip-${id})`} strokeLinejoin="round" strokeLinecap="round">
        {/* shoulders in their own colour */}
        <path d="M4 48 Q4 34.5 22 34.5 Q40 34.5 40 48 Z" fill={colour} stroke={INK} strokeWidth="2.2" />
        <g transform="translate(22 22.4) scale(11.6)">
          {hair.back && <path d={hair.back} fill={look.hair} stroke={INK} strokeWidth={edge * 2} paintOrder="stroke" />}
          <ellipse rx={HEAD.rx} ry={HEAD.ry} fill={look.skin} stroke={INK} strokeWidth={edge} />
          {[-1, 1].map((dir) => (
            <g key={dir}>
              <ellipse cx={dir * FACE.cheekX} cy={FACE.cheekY} rx="0.17" ry="0.1" fill="rgba(255,105,125,0.42)" />
              {look.freckles && [[-0.1, -0.1], [0.02, -0.15], [0.12, -0.09]].map(([dx, dy]) => (
                <circle key={dx} cx={dir * FACE.cheekX + dx} cy={FACE.cheekY + dy} r="0.035" fill="#b5754a" />
              ))}
              {look.glasses && <circle cx={dir * FACE.eyeX} cy={FACE.eyeY} r="0.3" fill="rgba(255,255,255,0.3)" stroke={INK} strokeWidth="0.11" />}
              <ellipse cx={dir * FACE.eyeX} cy={FACE.eyeY} rx={FACE.eyeRx} ry={FACE.eyeRy} fill={INK} />
              <circle cx={dir * FACE.eyeX - 0.045} cy={FACE.eyeY - 0.08} r="0.066" fill="#fff" />
              <circle cx={dir * FACE.eyeX + 0.048} cy={FACE.eyeY + 0.09} r="0.032" fill="#fff" />
            </g>
          ))}
          {look.glasses && <path d={`M ${-FACE.eyeX + 0.3} ${FACE.eyeY} L ${FACE.eyeX - 0.3} ${FACE.eyeY}`} stroke={INK} strokeWidth="0.11" />}
          <path d={SMILE} fill="none" stroke={INK} strokeWidth="0.12" />
          <path d={hair.front} fill={look.hair} stroke={INK} strokeWidth={edge * 2} paintOrder="stroke" />
        </g>
      </g>
    </svg>
  )
}
