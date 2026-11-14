// The game's own icons, drawn the same way as the base in the picture: a thick dark
// outline and flat, friendly colours. They replace emoji, which look different on
// every computer and never match the rest of the screen.

import type { ReactNode } from 'react'

const INK = '#1c2340'

/** Shapes share one outline, so every icon looks like it came from the same pen. */
const line = { stroke: INK, strokeWidth: 1.9, strokeLinejoin: 'round', strokeLinecap: 'round' } as const
const open = { ...line, fill: 'none' } as const

const SHAPES = {
  bolt: <polygon points="13.5,2 5,13.5 11,13.5 9.5,22 19,10 12.8,10" fill="#ffc93c" {...line} />,
  air: (
    <>
      <circle cx="10" cy="13.5" r="7" fill="#bfe6ff" {...line} />
      <circle cx="18.8" cy="6.2" r="3" fill="#bfe6ff" {...line} />
      <path d="M6.5 12.5a3.8 3.8 0 0 1 3-3.4" {...open} stroke="#ffffff" />
    </>
  ),
  food: (
    <>
      <path d="M4 21C6 15 10 10 14.5 7.5l4 4C16 16 11 20 4 21z" fill="#ff9340" {...line} />
      <path d="M16.2 9.6C15.6 6.4 16.6 3.8 19 2.6c.6 1.9.3 3.8-.6 5.4 1.6-1.3 3.4-1.6 4.9-1-1.2 2.3-3.9 3.3-7.1 2.6z" fill="#46c37b" {...line} />
      <path d="M9.5 13.2l1.6 1.6M7.4 16.3l1.4 1.4" {...open} />
    </>
  ),
  heart: <path d="M12 20.5C6 16 3 12.6 3 9a4.5 4.5 0 0 1 9-1.8A4.5 4.5 0 0 1 21 9c0 3.6-3 7-9 11.5z" fill="#ff5d7a" {...line} />,
  smile: (
    <>
      <circle cx="12" cy="12" r="9" fill="#ffd35a" {...line} />
      <circle cx="8.8" cy="10" r="1.2" fill={INK} />
      <circle cx="15.2" cy="10" r="1.2" fill={INK} />
      <path d="M8 14q4 4 8 0" {...open} />
    </>
  ),
  sad: (
    <>
      <circle cx="12" cy="12" r="9" fill="#ffb07a" {...line} />
      <circle cx="8.8" cy="10" r="1.2" fill={INK} />
      <circle cx="15.2" cy="10" r="1.2" fill={INK} />
      <path d="M8 16.5q4-3.5 8 0" {...open} />
    </>
  ),
  tired: (
    <>
      <circle cx="11" cy="13" r="8.5" fill="#c9d4f5" {...line} />
      <path d="M6.6 12q1.4 1.2 2.8 0M11.6 12q1.4 1.2 2.8 0M9 16.6h4" {...open} />
      <path d="M17 2.5h4.5L17 8h4.5" {...open} />
    </>
  ),
  star: <polygon points="12,2.6 14.6,9 21.4,9.5 16.2,13.9 17.8,20.6 12,17 6.2,20.6 7.8,13.9 2.6,9.5 9.4,9" fill="#ffc93c" {...line} />,
  shield: (
    <>
      <path d="M12 2.5l8 3V11c0 5-3.5 8.8-8 10.5C7.5 19.8 4 16 4 11V5.5z" fill="#9fd68a" {...line} />
      <path d="M12 6.2v11.4" {...open} />
    </>
  ),
  telescope: (
    <>
      <path d="M3.5 13.2l10.8-5.4 2 4-10.8 5.4z" fill="#c9d4f5" {...line} />
      <path d="M14.3 7.8l4.6-2.3 2 4-4.6 2.3z" fill="#ffc93c" {...line} />
      <path d="M10.5 15l-3 6.5M11.5 14.6l3 6.9" {...open} />
    </>
  ),
  dish: (
    <>
      <path d="M4.2 5.8A10.5 10.5 0 0 0 18.2 19.8z" fill="#c9d4f5" {...line} />
      <path d="M11.2 12.8l4.4-4.4" {...open} />
      <circle cx="16.8" cy="7.2" r="2" fill="#ff5d6c" {...line} />
      <path d="M8.5 17.5L7 21.5h7" {...open} />
    </>
  ),
  book: (
    <>
      <path d="M3.5 5.6C6.6 4.2 9.8 4.6 12 6.2c2.2-1.6 5.4-2 8.5-.6V19c-3.1-1.4-6.3-1-8.5.6-2.2-1.6-5.4-2-8.5-.6z" fill="#8fc7ff" {...line} />
      <path d="M12 6.2v13.4" {...open} />
    </>
  ),
  wrench: <path d="M14.6 3.2a5.2 5.2 0 0 0-4.6 7.4l-6.5 6.5a2.3 2.3 0 0 0 3.3 3.3l6.5-6.5a5.2 5.2 0 0 0 7.3-5.9l-3.1 3.1-2.8-.7-.7-2.8 3.1-3.1a5.2 5.2 0 0 0-2.5-1.3z" fill="#c9d4f5" {...line} />,
  sprout: (
    <>
      <path d="M12 21.5V11" {...open} />
      <path d="M12 12c0-4-3-6.5-7.5-6.5C4.5 10 7.5 12.5 12 12z" fill="#46c37b" {...line} />
      <path d="M12 14.5c0-3.5 3-6 7.5-6 0 4-3 6.5-7.5 6z" fill="#7fdc9c" {...line} />
    </>
  ),
  flask: (
    <>
      <path d="M10 3.5V9L4.9 18.4a2 2 0 0 0 1.8 3h10.6a2 2 0 0 0 1.8-3L14 9V3.5z" fill="#ffffff" {...line} />
      <path d="M7.3 15.5h9.4l2 3.4a1.5 1.5 0 0 1-1.3 2.2H6.6a1.5 1.5 0 0 1-1.3-2.2z" fill="#b99cff" />
      <path d="M8.5 3.5h7" {...open} />
      <path d="M10 3.5V9L4.9 18.4a2 2 0 0 0 1.8 3h10.6a2 2 0 0 0 1.8-3L14 9V3.5" {...open} />
    </>
  ),
  rover: (
    <>
      <path d="M8 9V5.5h6.5L18 9" fill="#bfe6ff" {...line} />
      <rect x="2.5" y="9" width="17.5" height="7" rx="2.2" fill="#ffb454" {...line} />
      <circle cx="7.5" cy="17.5" r="3" fill="#4a5380" {...line} />
      <circle cx="15.5" cy="17.5" r="3" fill="#4a5380" {...line} />
      <path d="M20 11h2" {...open} />
    </>
  ),
  build: (
    <>
      <rect x="2.5" y="13.5" width="9.5" height="7" rx="1.2" fill="#ffb454" {...line} />
      <rect x="12" y="13.5" width="9.5" height="7" rx="1.2" fill="#ffb454" {...line} />
      <rect x="7.2" y="6.5" width="9.5" height="7" rx="1.2" fill="#ffd08a" {...line} />
      <path d="M12 2.5v2M9 3.5l1 1.5M15 3.5l-1 1.5" {...open} />
    </>
  ),
  rest: (
    <>
      <path d="M2.5 12.5h19V18h-19z" fill="#8fc7ff" {...line} />
      <path d="M2.5 6.5V20M21.5 12.5V20" {...open} />
      <rect x="4.5" y="9" width="6" height="3.5" rx="1.7" fill="#ffffff" {...line} />
    </>
  ),
  sickbay: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" fill="#ffffff" {...line} />
      <path d="M10.3 7h3.4v3.3H17v3.4h-3.3V17h-3.4v-3.3H7v-3.4h3.3z" fill="#ff5d6c" />
    </>
  ),
  call: (
    <>
      <path d="M4.5 4.5h15A1.8 1.8 0 0 1 21.3 6.3v8.4a1.8 1.8 0 0 1-1.8 1.8H12l-5 4.5v-4.5H4.5a1.8 1.8 0 0 1-1.8-1.8V6.3A1.8 1.8 0 0 1 4.5 4.5z" fill="#ffffff" {...line} />
      <path d="M12 13.8c-2.4-1.7-3.5-2.9-3.5-4.2a1.8 1.8 0 0 1 3.5-.6 1.8 1.8 0 0 1 3.5.6c0 1.3-1.1 2.5-3.5 4.2z" fill="#ff5d7a" />
    </>
  ),
  ice: (
    <>
      <polygon points="12,2.5 20.2,7.2 20.2,16.8 12,21.5 3.8,16.8 3.8,7.2" fill="#bfe6ff" {...line} />
      <path d="M12 2.5v19M3.8 7.2l16.4 9.6M20.2 7.2L3.8 16.8" {...open} strokeWidth="1.3" />
    </>
  ),
  battery: (
    <>
      <rect x="2.5" y="7" width="17" height="10" rx="2.5" fill="#ffffff" {...line} />
      <rect x="5" y="9.5" width="8" height="5" rx="1" fill="#46c37b" />
      <path d="M21.5 10.5v3" {...open} strokeWidth="2.6" />
    </>
  ),
  warning: (
    <>
      <path d="M12 3L22 20.5H2z" fill="#ffb454" {...line} />
      <path d="M12 9.5v5" {...open} strokeWidth="2.3" />
      <circle cx="12" cy="17.3" r="1.2" fill={INK} />
    </>
  ),
  pause: (
    <>
      <rect x="6" y="5" width="4.5" height="14" rx="1.5" fill={INK} />
      <rect x="13.5" y="5" width="4.5" height="14" rx="1.5" fill={INK} />
    </>
  ),
  play: <path d="M7.5 4.8v14.4L19.5 12z" fill={INK} stroke={INK} strokeWidth="1.9" strokeLinejoin="round" />,
  fast: (
    <>
      <path d="M3.5 5.5v13L12 12z" fill={INK} stroke={INK} strokeWidth="1.9" strokeLinejoin="round" />
      <path d="M12.5 5.5v13L21 12z" fill={INK} stroke={INK} strokeWidth="1.9" strokeLinejoin="round" />
    </>
  ),
  soundOn: (
    <>
      <path d="M3.5 9.5H7L12.5 5v14L7 14.5H3.5z" fill="#ffffff" {...line} />
      <path d="M15.8 9a4.5 4.5 0 0 1 0 6M18.3 6.5a8 8 0 0 1 0 11" {...open} />
    </>
  ),
  soundOff: (
    <>
      <path d="M3.5 9.5H7L12.5 5v14L7 14.5H3.5z" fill="#ffffff" {...line} />
      <path d="M16 9.5l5 5M21 9.5l-5 5" {...open} />
    </>
  ),
  rocket: (
    <>
      <path d="M8.3 12L4.5 17l3.8-.6zM15.7 12l3.8 5-3.8-.6z" fill="#ff5d6c" {...line} />
      <path d="M10 16.5q2 6 4 0z" fill="#ffc93c" {...line} />
      <path d="M12 2.5c4 3 5 7.5 4 13.5H8c-1-6 0-10.5 4-13.5z" fill="#ffffff" {...line} />
      <circle cx="12" cy="9.3" r="2.1" fill="#6cb8ff" {...line} />
    </>
  ),
  box: (
    <>
      <path d="M3.5 8L12 4l8.5 4v9L12 21l-8.5-4z" fill="#e0aa6e" {...line} />
      <path d="M3.5 8L12 12l8.5-4M12 12v9" {...open} />
    </>
  ),
  tip: (
    <>
      <circle cx="12" cy="12" r="9" fill="#ffc93c" {...line} />
      <path d="M8 12h7.5M12.5 8.5L16 12l-3.5 3.5" {...open} />
    </>
  ),
  look: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" fill="#bfe6ff" {...line} />
      <path d="M15.3 15.3l5.2 5.2" {...open} strokeWidth="2.6" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="5" fill="#ffc93c" {...line} />
      <path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3L7 7M17 17l1.7 1.7M18.7 5.3L17 7M7 17l-1.7 1.7" {...open} />
    </>
  ),
  earth: (
    <>
      <circle cx="12" cy="12" r="9" fill="#6cb8ff" {...line} />
      <path d="M7 6.5c2 .5 3 2 2.5 4S7 13 5.5 15.5M14 4.5c-.5 2 1 3 3 3.5s2.5 2.5 1.5 4.5-3 1.5-3.5 3.5" fill="none" stroke="#46c37b" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="12" cy="12" r="9" {...open} />
    </>
  ),
  keys: (
    <>
      <rect x="2.5" y="6" width="19" height="12" rx="2.5" fill="#ffffff" {...line} />
      <path d="M6.5 10h.01M10 10h.01M13.5 10h.01M17 10h.01M7.5 14h9" {...open} strokeWidth="2.2" />
    </>
  ),
  person: (
    <>
      <path d="M4.5 21.5a7.5 7.5 0 0 1 15 0z" fill="#ffb454" {...line} />
      <circle cx="12" cy="8.5" r="5.8" fill="#ffffff" {...line} />
      <rect x="8.3" y="6.3" width="7.4" height="4.6" rx="2.3" fill="#4a5380" />
    </>
  ),
  rock: (
    <>
      <path d="M3 4l7 5M3.5 9l5 3M8 3l4 4.5" {...open} />
      <circle cx="15" cy="15" r="6.5" fill="#b9a089" {...line} />
      <circle cx="13" cy="13.5" r="1.3" fill="#8f7965" />
      <circle cx="17" cy="16.5" r="1.7" fill="#8f7965" />
    </>
  ),
  dust: <path d="M3 8q3-3 6 0t6 0 6 0M3 13q3-3 6 0t6 0 6 0M3 18q3-3 6 0t6 0 6 0" {...open} stroke="#8f7965" strokeWidth="2.3" />,
  school: (
    <>
      <path d="M3.5 21V10.5L12 5l8.5 5.5V21z" fill="#ffd08a" {...line} />
      <rect x="10" y="14.5" width="4" height="6.5" fill="#b9805a" {...line} />
      <path d="M12 5V2h4v2.5h-4" fill="#ff5d6c" {...line} />
    </>
  ),
  cake: (
    <>
      <rect x="3.5" y="11.5" width="17" height="9" rx="2" fill="#ffc2d1" {...line} />
      <path d="M3.5 15.5q2.8 2.5 5.7 0t5.6 0 5.7 0" {...open} />
      <path d="M12 11.5V7" {...open} />
      <path d="M12 6.5c-1.5-1.5-.5-3 0-4 .5 1 1.5 2.5 0 4z" fill="#ffc93c" {...line} strokeWidth="1.5" />
    </>
  ),
  shadow: (
    <>
      <circle cx="12" cy="12" r="9" fill="#4a5380" {...line} />
      <path d="M12 3a9 9 0 0 1 0 18 12 12 0 0 0 0-18z" fill="#c9d4f5" />
      <circle cx="12" cy="12" r="9" {...open} />
    </>
  ),
  quake: <path d="M2.5 12h3.5l2.2-6 3.3 13 3-10 2.2 5.5 1.5-2.5h3.3" {...open} stroke="#e23d55" strokeWidth="2.4" />,
  gift: (
    <>
      <rect x="3.5" y="10" width="17" height="11" rx="1.8" fill="#ff8fa3" {...line} />
      <rect x="2.5" y="6.5" width="19" height="4" rx="1.3" fill="#ffc2d1" {...line} />
      <path d="M12 6.5V21M12 6.5c-2-4.5-6-3-4-.5M12 6.5c2-4.5 6-3 4-.5" {...open} />
    </>
  ),
  sparkle: (
    <>
      <path d="M10 3.5l1.8 4.7 4.7 1.8-4.7 1.8L10 16.5l-1.8-4.7L3.5 10l4.7-1.8z" fill="#ffc93c" {...line} />
      <path d="M18 13.5l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9z" fill="#ffe08a" {...line} strokeWidth="1.4" />
    </>
  ),
} satisfies Record<string, ReactNode>

export type IconName = keyof typeof SHAPES

/** One icon. It is as tall as the text beside it, and sits on the same line. */
export function Icon({ name, size = '1.15em' }: { name: IconName; size?: string }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">
      {SHAPES[name]}
    </svg>
  )
}

/** The emoji that sentences in the game still carry, and the icon that is shown instead. */
const EMOJI: Record<string, IconName> = {
  '⚡': 'bolt',
  '💨': 'air',
  '🥕': 'food',
  '⭐': 'star',
  '🛡': 'shield',
  '🔭': 'telescope',
  '📡': 'dish',
  '📖': 'book',
  '🔧': 'wrench',
  '🌱': 'sprout',
  '🧪': 'flask',
  '🚙': 'rover',
  '🏗': 'build',
  '🛋': 'rest',
  '🩹': 'sickbay',
  '📞': 'call',
  '❄': 'ice',
  '🔋': 'battery',
  '⚠': 'warning',
  '🚀': 'rocket',
  '📦': 'box',
  '👉': 'tip',
  '🔎': 'look',
  '☀': 'sun',
  '🌍': 'earth',
  '⌨': 'keys',
  '👩': 'person',
  '☄': 'rock',
  '🌫': 'dust',
  '🏫': 'school',
  '🎂': 'cake',
  '🌑': 'shadow',
  '📳': 'quake',
  '🎁': 'gift',
  '✨': 'sparkle',
  '🤝': 'star',
  '😴': 'tired',
  '♥': 'heart',
  '☺': 'smile',
  '☹': 'sad',
}

const EMOJI_PATTERN = new RegExp(`(${Object.keys(EMOJI).join('|')})\\uFE0F?`, 'gu')

/** A sentence from the game, with each emoji in it swapped for one of our own icons. */
export function Rich({ text }: { text: string }) {
  const parts: ReactNode[] = []
  let from = 0
  for (const match of text.matchAll(EMOJI_PATTERN)) {
    if (match.index > from) parts.push(text.slice(from, match.index))
    parts.push(<Icon key={match.index} name={EMOJI[match[1]]} />)
    from = match.index + match[0].length
  }
  if (from < text.length) parts.push(text.slice(from))
  return <>{parts}</>
}
