/** The picture on the start screen: the outpost on the Moon, under an active Sun. Drawn in code, no image files. */
export function HeroArt() {
  // Stars are scattered by hand so they never sit on top of the Sun or the Earth.
  const stars: [number, number, number][] = [
    [22, 30, 1.1], [58, 92, 0.8], [96, 22, 0.9], [131, 64, 1.2], [160, 18, 0.7], [188, 96, 0.9], [214, 40, 1], [246, 110, 0.8],
    [268, 24, 0.7], [36, 128, 0.9], [112, 118, 0.7], [226, 78, 0.6], [398, 150, 0.9], [300, 138, 0.8], [8, 78, 0.7],
  ]
  return (
    <svg className="hero-art" viewBox="0 0 420 260" role="img" aria-label="A small base on the Moon. The Sun is throwing a loop of fire into space.">
      <defs>
        <radialGradient id="hero-sun" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff6c9" />
          <stop offset="55%" stopColor="#ffd166" />
          <stop offset="100%" stopColor="#ff8a3d" />
        </radialGradient>
        <radialGradient id="hero-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(255,190,90,0.55)" />
          <stop offset="100%" stopColor="rgba(255,190,90,0)" />
        </radialGradient>
        <linearGradient id="hero-ground" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8a8fa3" />
          <stop offset="100%" stopColor="#3b3f52" />
        </linearGradient>
        <linearGradient id="hero-dome" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f4f6ff" />
          <stop offset="100%" stopColor="#9aa5d6" />
        </linearGradient>
      </defs>

      {stars.map(([x, y, r]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill="#fff" opacity="0.8" />
      ))}

      {/* The Sun, with a loop of fire and a cloud of gas leaving it. */}
      <circle cx="350" cy="62" r="92" fill="url(#hero-glow)" />
      <path d="M 300 52 C 250 20, 262 96, 310 84" fill="none" stroke="#ff8a3d" strokeWidth="5" strokeLinecap="round" />
      <path d="M 300 52 C 258 30, 268 90, 310 84" fill="none" stroke="#ffd166" strokeWidth="2" strokeLinecap="round" />
      <circle cx="350" cy="62" r="46" fill="url(#hero-sun)" />
      <g fill="#ffb454" opacity="0.5">
        <circle cx="258" cy="58" r="5" />
        <circle cx="244" cy="70" r="3.5" />
        <circle cx="236" cy="52" r="2.5" />
        <circle cx="226" cy="64" r="1.8" />
      </g>

      {/* The Earth, far away. */}
      <circle cx="74" cy="54" r="15" fill="#3d7bd6" />
      <path d="M 66 46 q 6 -4 10 1 q -2 6 -8 5 z M 76 58 q 6 -2 8 3 q -4 5 -9 2 z" fill="#5fd38d" />
      <path d="M 74 39 a 15 15 0 0 0 0 30 a 22 22 0 0 1 0 -30 z" fill="rgba(5,8,18,0.45)" />

      {/* The ground. */}
      <path d="M 0 204 Q 210 158 420 204 L 420 260 L 0 260 Z" fill="url(#hero-ground)" />
      <g fill="#2f3345" opacity="0.8">
        <ellipse cx="64" cy="228" rx="26" ry="7" />
        <ellipse cx="352" cy="236" rx="34" ry="8" />
        <ellipse cx="236" cy="246" rx="16" ry="4" />
      </g>
      <g fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1">
        <path d="M 40 230 a 26 7 0 0 0 50 0" />
        <path d="M 320 239 a 34 8 0 0 0 66 0" />
      </g>

      {/* The radio dish. */}
      <path d="M 112 196 L 112 172" stroke="#c9cde0" strokeWidth="3" />
      <path d="M 96 160 Q 114 186 132 160 Z" fill="#dfe5ff" stroke="#8792bd" strokeWidth="1.5" transform="rotate(-24 114 166)" />

      {/* The corridor, the crew dome and the greenhouse. */}
      <rect x="150" y="186" width="130" height="10" rx="5" fill="#6d7699" />
      <path d="M 162 194 A 44 40 0 0 1 250 194 Z" fill="url(#hero-dome)" stroke="#6a76b0" strokeWidth="2" />
      <g fill="#ffd166">
        <rect x="182" y="176" width="10" height="8" rx="2" />
        <rect x="201" y="176" width="10" height="8" rx="2" />
        <rect x="220" y="176" width="10" height="8" rx="2" />
      </g>
      <rect x="264" y="172" width="48" height="24" rx="8" fill="#1f5a3a" stroke="#5fd38d" strokeWidth="2" />
      <g stroke="#5fd38d" strokeWidth="2" strokeLinecap="round">
        <path d="M 276 190 v -8 M 288 190 v -10 M 300 190 v -7" />
      </g>

      {/* Solar panels. */}
      <g>
        <path d="M 330 196 L 330 184 M 366 198 L 366 186" stroke="#c9cde0" strokeWidth="2" />
        <path d="M 316 186 L 344 176 L 348 184 L 320 194 Z" fill="#3d7bd6" stroke="#a8cdff" strokeWidth="1.2" />
        <path d="M 352 188 L 380 178 L 384 186 L 356 196 Z" fill="#3d7bd6" stroke="#a8cdff" strokeWidth="1.2" />
      </g>

      {/* The rover. */}
      <g>
        <rect x="32" y="200" width="34" height="13" rx="5" fill="#ffb454" stroke="#7a4a12" strokeWidth="1.5" />
        <rect x="40" y="194" width="16" height="9" rx="3" fill="#6cb8ff" stroke="#7a4a12" strokeWidth="1.2" />
        <circle cx="40" cy="215" r="5" fill="#23263a" stroke="#c9cde0" strokeWidth="1.5" />
        <circle cx="58" cy="215" r="5" fill="#23263a" stroke="#c9cde0" strokeWidth="1.5" />
      </g>
    </svg>
  )
}
