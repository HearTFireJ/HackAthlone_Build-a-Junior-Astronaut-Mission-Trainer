// How each astronaut looks: skin, hair and a few small touches. All of it is made up for the game.
//
// The hair shapes are written once, as outlines around a head of size 1 that sits at (0, 0).
// The figures on the base (canvas) and the small portraits (SVG) both use them, so a person
// looks the same everywhere.

import { CREW } from '../game/content.ts'

export type HairStyle = 'long' | 'short' | 'bun' | 'curly' | 'puffs' | 'quiff'

export interface Look {
  skin: string
  hair: string
  style: HairStyle
  glasses?: boolean
  freckles?: boolean
}

const LOOKS: Record<string, Look> = {
  aoife: { skin: '#f6cfae', hair: '#d9552f', style: 'long', freckles: true },
  cian: { skin: '#c98f62', hair: '#2a2530', style: 'short' },
  niamh: { skin: '#f3d3b8', hair: '#7a4a28', style: 'bun' },
  oisin: { skin: '#eec39a', hair: '#f0c64f', style: 'curly' },
  saoirse: { skin: '#8d5a3b', hair: '#2b2028', style: 'puffs' },
  tadhg: { skin: '#f1cba6', hair: '#c3c8d6', style: 'quiff', glasses: true },
}
const DEFAULT_LOOK: Look = { skin: '#e9bd94', hair: '#4a3a2c', style: 'short' }

export function lookOf(id: string): Look {
  return LOOKS[id] ?? DEFAULT_LOOK
}

export function colourOf(id: string): string {
  return CREW.find((member) => member.id === id)?.colour ?? '#ffffff'
}

/** A darker (below 0) or lighter (above 0) shade of a colour written like "#5fd38d". */
export function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16)
  const mix = (c: number) => Math.round(amount < 0 ? c * (1 + amount) : c + (255 - c) * amount)
  return `rgb(${mix((n >> 16) & 255)},${mix((n >> 8) & 255)},${mix(n & 255)})`
}

/** The head is a little wider than it is tall: chubby cheeks. */
export const HEAD = { rx: 1.06, ry: 0.96 }

/** The outline colour of everything in the picture. */
export const INK = '#171c31'

// Every outline runs clockwise. Two overlapping parts that ran opposite ways would cut a hole in each other.
const dot = (cx: number, cy: number, r: number) => `M ${cx - r} ${cy} a ${r} ${r} 0 1 1 ${2 * r} 0 a ${r} ${r} 0 1 1 ${-2 * r} 0 Z`
const rrect = (x: number, y: number, w: number, h: number, r: number) =>
  `M ${x + r} ${y} h ${w - 2 * r} a ${r} ${r} 0 0 1 ${r} ${r} v ${h - 2 * r} a ${r} ${r} 0 0 1 ${-r} ${r} h ${-(w - 2 * r)} a ${r} ${r} 0 0 1 ${-r} ${-r} v ${-(h - 2 * r)} a ${r} ${r} 0 0 1 ${r} ${-r} Z`
/** The top of every haircut: an arch from one temple, over the head, to the other. */
const CAP = 'M -1.13 0 A 1.13 1.07 0 0 1 1.13 0'

export interface Hair {
  /** Hair seen behind the head: locks, a bun, curls. Painted before the face. */
  back: string
  /** The hair on top, with the fringe. Painted over the forehead. */
  front: string
  /** Extra hair that only shows from behind. */
  down?: string
}

export const HAIR: Record<HairStyle, Hair> = {
  // Swept to one side, with a long lock each side of the face.
  long: {
    back: rrect(-1.36, -0.3, 0.62, 1.62, 0.3) + rrect(0.74, -0.3, 0.62, 1.62, 0.3),
    front: `${CAP} L 1.1 0.24 C 1.02 -0.1 0.8 -0.42 0.42 -0.58 C 0.15 -0.28 -0.45 -0.1 -0.98 -0.18 L -1.09 0.22 Z`,
    down: rrect(-1.24, -0.45, 2.48, 1.8, 0.55),
  },
  // Cropped short, with a few spikes.
  short: {
    back: '',
    front: `${CAP} L 1.03 -0.28 L 0.76 -0.2 L 0.52 -0.5 L 0.24 -0.28 L -0.04 -0.56 L -0.32 -0.28 L -0.58 -0.5 L -0.78 -0.2 L -1.03 -0.28 Z`,
  },
  // Parted in the middle, with a bun on top.
  bun: {
    back: dot(0, -1.2, 0.46),
    front: `${CAP} L 1.1 0.22 C 1.04 -0.22 0.62 -0.5 0.04 -0.68 C -0.54 -0.5 -1.02 -0.22 -1.1 0.22 Z`,
  },
  // A cloud of curls.
  curly: {
    back: [-175, -140, -105, -75, -40, -5]
      .map((deg) => dot(Math.cos((deg * Math.PI) / 180) * 1.1, Math.sin((deg * Math.PI) / 180) * 1.02, 0.42))
      .join(' '),
    front: `${CAP} L 1.0 -0.42 L -1.0 -0.42 Z ${dot(-0.68, -0.42, 0.3)} ${dot(-0.23, -0.5, 0.3)} ${dot(0.23, -0.5, 0.3)} ${dot(0.68, -0.42, 0.3)}`,
  },
  // Two round puffs.
  puffs: {
    back: dot(-1.0, -0.84, 0.58) + dot(1.0, -0.84, 0.58),
    front: `${CAP} C 1.0 -0.4 0.55 -0.62 0 -0.62 C -0.55 -0.62 -1.0 -0.4 -1.13 0 Z`,
  },
  // Brushed up into a tuft.
  quiff: {
    back: 'M -0.66 -0.8 C -0.8 -1.5 0.05 -1.66 0.66 -1.32 C 0.4 -1.26 0.3 -1.08 0.42 -0.84 Z',
    front: `${CAP} C 1.05 -0.3 0.9 -0.48 0.62 -0.52 C 0.2 -0.36 -0.35 -0.4 -0.72 -0.6 C -0.92 -0.42 -1.05 -0.22 -1.13 0 Z`,
  },
}

/** Where the features of the face sit on a head of size 1. Shared by the canvas and the portraits. */
export const FACE = {
  eyeX: 0.4,
  eyeY: 0.17,
  eyeRx: 0.15,
  eyeRy: 0.21,
  cheekX: 0.64,
  cheekY: 0.47,
  mouthY: 0.44,
  mouthR: 0.13,
}
