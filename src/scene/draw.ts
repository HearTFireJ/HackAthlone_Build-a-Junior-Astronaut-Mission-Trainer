// Everything that is painted on the canvas: the ground, the base, the crew, the rover.
// These functions only draw. They never change the game.

import { CREW, type ModuleId } from '../game/content.ts'
import {
  BEDS,
  CORRIDORS,
  DISH,
  HAB,
  MED_BEDS,
  PANELS,
  PLANT_BEDS,
  ROAD,
  ROOMS,
  SCOPE,
  SITE,
  type Facing,
  type PlaceId,
  type Pt,
  type Rect,
} from './layout.ts'

type Ctx = CanvasRenderingContext2D

/** What the base looks like right now. Worked out from the game state by the scene. */
export interface BaseView {
  on: Set<ModuleId>
  broken: Set<ModuleId>
  blocked: Set<ModuleId>
  /** How many solar panels there are, and how many of them are worn, dusty or dark. */
  panels: number
  panelsDead: number
  /** Radio telescope progress, from 0 to 1. */
  dish: number
  shield: boolean
  ice: boolean
  /** How badly a storm has hurt the plants today, from 0 to 1. */
  wilt: number
  /** How much food is in the store, for how full the plant beds look. */
  lush: number
}

const HULL = '#dfe4f1'
const EDGE = '#171c31'
const FLOOR = {
  hab: '#3d4a7c',
  life: '#34525f',
  farm: '#3b3327',
  lab: '#483c6e',
  garage: '#4a4f5d',
  corridor: '#5a6592',
}
const WALL = 10

const TAU = Math.PI * 2

function circle(ctx: Ctx, x: number, y: number, r: number) {
  ctx.beginPath()
  ctx.arc(x, y, Math.max(0, r), 0, TAU)
}
function box(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, Math.max(0, Math.min(r, w / 2, h / 2)))
}
function line(ctx: Ctx, a: Pt, b: Pt) {
  ctx.beginPath()
  ctx.moveTo(a.x, a.y)
  ctx.lineTo(b.x, b.y)
}

/** A dice roll that gives the same numbers every time, so the ground never changes. */
function dice(seed: number) {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function distToSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const along = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)))
  return Math.hypot(p.x - (a.x + along * dx), p.y - (a.y + along * dy))
}

/** The colour of every sign and label: the same paper as the windows around the picture. */
const PAPER = '#fff8ea'
const roomList = Object.values(ROOMS) as Rect[]

/** True where a crater would sit under a building, a corridor or the road. */
function builtOn(p: Pt, r: number): boolean {
  if (Math.hypot(p.x - HAB.x, p.y - HAB.y) < HAB.r + 30 + r) return true
  for (const room of roomList) {
    if (p.x > room.x - 34 - r && p.x < room.x + room.w + 34 + r && p.y > room.y - 34 - r && p.y < room.y + room.h + 34 + r) return true
  }
  if (p.x > 690 - r && p.x < 1150 + r && p.y > 60 - r && p.y < 260 + r) return true
  for (const c of [DISH, SCOPE, SITE]) if (Math.hypot(p.x - c.x, p.y - c.y) < c.r + 30 + r) return true
  for (const [a, b] of CORRIDORS) if (distToSegment(p, a, b) < 34 + r) return true
  for (let i = 0; i < ROAD.length - 1; i++) if (distToSegment(p, ROAD[i], ROAD[i + 1]) < 30 + r) return true
  // The paths people walk outside.
  const paths: [Pt, Pt][] = [
    [{ x: 800, y: 330 }, { x: 800, y: 240 }],
    [{ x: 882, y: 532 }, { x: 1010, y: 640 }],
    [{ x: 1010, y: 640 }, { x: 1128, y: 700 }],
  ]
  for (const [a, b] of paths) if (distToSegment(p, a, b) < 22 + r) return true
  // The landing pad.
  if (Math.hypot(p.x - PAD.x, p.y - PAD.y) < PAD.r + 26 + r) return true
  return false
}

/** Where the crew's lander stands. It is only scenery: it brought them here. */
const PAD = { x: 316, y: 716, r: 56 }

/**
 * The Moon's surface. It is painted once into a hidden picture and then copied to the
 * screen every frame, because it never changes.
 */
export function paintGround(ctx: Ctx, width: number, height: number, scale: number, ox: number, oy: number) {
  const light = ctx.createLinearGradient(0, 0, width, height)
  light.addColorStop(0, '#9a9eac')
  light.addColorStop(0.5, '#7d8191')
  light.addColorStop(1, '#585c6d')
  ctx.fillStyle = light
  ctx.fillRect(0, 0, width, height)

  ctx.save()
  ctx.translate(ox, oy)
  ctx.scale(scale, scale)
  const random = dice(20261114)

  // Fine dust and pebbles.
  for (let i = 0; i < 2600; i++) {
    const x = -900 + random() * 3400
    const y = -600 + random() * 2100
    const r = 0.8 + random() * 2.2
    ctx.fillStyle = random() < 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(10,12,25,0.09)'
    circle(ctx, x, y, r)
    ctx.fill()
  }

  // Craters. The Sun is low in the top left, so the near wall is in shadow and the far rim is lit.
  for (let i = 0; i < 150; i++) {
    const p = { x: -900 + random() * 3400, y: -600 + random() * 2100 }
    const r = 7 + random() * random() * 46
    if (builtOn(p, r)) continue
    ctx.fillStyle = 'rgba(255,255,255,0.09)'
    circle(ctx, p.x, p.y, r * 1.2)
    ctx.fill()
    const pit = ctx.createRadialGradient(p.x - r * 0.4, p.y - r * 0.4, r * 0.1, p.x, p.y, r)
    pit.addColorStop(0, 'rgba(18,20,34,0.78)')
    pit.addColorStop(0.65, 'rgba(38,41,58,0.55)')
    pit.addColorStop(1, 'rgba(96,100,118,0.2)')
    ctx.fillStyle = pit
    circle(ctx, p.x, p.y, r)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'
    ctx.lineWidth = Math.max(1.2, r * 0.09)
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.arc(p.x, p.y, r, -0.2 * Math.PI, 0.7 * Math.PI)
    ctx.stroke()
  }

  // Wheel tracks along the rover's road.
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (const [width_, colour, dash] of [
    [34, 'rgba(60,63,78,0.5)', []],
    [3, 'rgba(25,27,40,0.5)', [10, 9]],
  ] as [number, string, number[]][]) {
    for (const side of width_ === 3 ? [-10, 10] : [0]) {
      ctx.strokeStyle = colour
      ctx.lineWidth = width_
      ctx.setLineDash(dash)
      ctx.beginPath()
      ROAD.forEach((p, index) => (index === 0 ? ctx.moveTo(p.x + 60, p.y + side) : ctx.lineTo(p.x, p.y + side)))
      ctx.stroke()
    }
  }
  ctx.setLineDash([])

  // Footpaths worn into the dust.
  ctx.strokeStyle = 'rgba(40,43,58,0.35)'
  ctx.lineWidth = 16
  for (const path of [
    [{ x: 800, y: 320 }, { x: 800, y: 240 }, { x: 990, y: 240 }],
    [{ x: 800, y: 240 }, { x: 765, y: 240 }],
    [{ x: 888, y: 540 }, { x: 1010, y: 640 }, { x: 1128, y: 700 }],
    [{ x: 800, y: 250 }, { x: 690, y: 128 }, { x: 432, y: 132 }, { x: 392, y: 182 }],
    [{ x: 990, y: 240 }, { x: 1215, y: 255 }],
  ]) {
    ctx.beginPath()
    path.forEach((p, index) => (index === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
    ctx.stroke()
  }

  // Rocks, lit from the top left like everything else.
  for (let i = 0; i < 70; i++) {
    const p = { x: -700 + random() * 3000, y: -400 + random() * 1700 }
    const r = 3 + random() * 7
    if (builtOn(p, r + 6)) continue
    ctx.fillStyle = 'rgba(10,12,28,0.3)'
    ctx.beginPath()
    ctx.ellipse(p.x + r * 0.6, p.y + r * 0.7, r * 1.1, r * 0.6, 0.5, 0, TAU)
    ctx.fill()
    ctx.fillStyle = '#8b8fa0'
    ctx.beginPath()
    ctx.ellipse(p.x, p.y, r, r * 0.78, random() * 3, 0, TAU)
    ctx.fill()
    ctx.strokeStyle = 'rgba(23,28,49,0.55)'
    ctx.lineWidth = 1.2
    ctx.stroke()
    ctx.fillStyle = 'rgba(255,255,255,0.35)'
    ctx.beginPath()
    ctx.ellipse(p.x - r * 0.3, p.y - r * 0.3, r * 0.45, r * 0.3, 0.6, 0, TAU)
    ctx.fill()
  }

  // The landing pad, with the lander that brought the crew.
  ctx.strokeStyle = 'rgba(40,43,58,0.35)'
  ctx.lineWidth = 16
  ctx.beginPath()
  ctx.moveTo(PAD.x + PAD.r - 4, PAD.y)
  ctx.lineTo(432, 716)
  ctx.stroke()
  circle(ctx, PAD.x, PAD.y, PAD.r)
  ctx.fillStyle = '#5b5f70'
  ctx.fill()
  ctx.strokeStyle = '#e9c34f'
  ctx.lineWidth = 3
  ctx.setLineDash([12, 9])
  circle(ctx, PAD.x, PAD.y, PAD.r - 7)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.fillStyle = 'rgba(10,12,28,0.32)'
  circle(ctx, PAD.x + 12, PAD.y + 14, 30)
  ctx.fill()
  // Four legs with round feet.
  ctx.strokeStyle = '#3a3f55'
  ctx.lineWidth = 5
  ctx.lineCap = 'round'
  for (const a of [0.785, 2.356, 3.927, 5.498]) {
    ctx.beginPath()
    ctx.moveTo(PAD.x + Math.cos(a) * 18, PAD.y + Math.sin(a) * 18)
    ctx.lineTo(PAD.x + Math.cos(a) * 38, PAD.y + Math.sin(a) * 38)
    ctx.stroke()
    circle(ctx, PAD.x + Math.cos(a) * 38, PAD.y + Math.sin(a) * 38, 6)
    ctx.fillStyle = '#c9cfdf'
    ctx.fill()
    ctx.strokeStyle = '#3a3f55'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.lineWidth = 5
  }
  // The body, wrapped in gold foil, with a round hatch on top.
  ctx.beginPath()
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + 0.39
    if (i === 0) ctx.moveTo(PAD.x + Math.cos(a) * 27, PAD.y + Math.sin(a) * 27)
    else ctx.lineTo(PAD.x + Math.cos(a) * 27, PAD.y + Math.sin(a) * 27)
  }
  ctx.closePath()
  const foil = ctx.createLinearGradient(PAD.x - 27, PAD.y - 27, PAD.x + 27, PAD.y + 27)
  foil.addColorStop(0, '#f6dd92')
  foil.addColorStop(1, '#b98e3a')
  ctx.fillStyle = foil
  ctx.fill()
  ctx.strokeStyle = '#3a2f18'
  ctx.lineWidth = 2.5
  ctx.stroke()
  circle(ctx, PAD.x, PAD.y, 13)
  ctx.fillStyle = '#e8ecf6'
  ctx.fill()
  ctx.strokeStyle = '#3a3f55'
  ctx.lineWidth = 2
  ctx.stroke()
  circle(ctx, PAD.x, PAD.y, 6)
  ctx.fillStyle = '#2b3a66'
  ctx.fill()
  ctx.fillStyle = 'rgba(160,210,255,0.8)'
  circle(ctx, PAD.x - 2, PAD.y - 2, 2)
  ctx.fill()

  // A mission flag by the airlock, and small lamps along the paths.
  ctx.strokeStyle = '#e8ecf6'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(850, 300)
  ctx.lineTo(850, 262)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(851, 263)
  ctx.lineTo(880, 271)
  ctx.lineTo(851, 281)
  ctx.closePath()
  ctx.fillStyle = '#ffd166'
  ctx.fill()
  ctx.strokeStyle = '#3a2f18'
  ctx.lineWidth = 1.5
  ctx.stroke()
  ctx.fillStyle = 'rgba(10,12,28,0.3)'
  ctx.beginPath()
  ctx.ellipse(858, 304, 10, 3, 0.3, 0, TAU)
  ctx.fill()
  for (const [x, y] of [[770, 268], [1002, 258], [962, 606], [1084, 672], [404, 716]]) {
    const light = ctx.createRadialGradient(x, y, 1, x, y, 22)
    light.addColorStop(0, 'rgba(255,224,150,0.45)')
    light.addColorStop(1, 'rgba(255,224,150,0)')
    ctx.fillStyle = light
    ctx.fillRect(x - 22, y - 22, 44, 44)
    circle(ctx, x, y, 4)
    ctx.fillStyle = '#ffe9a8'
    ctx.fill()
    ctx.strokeStyle = '#3a3f55'
    ctx.lineWidth = 1.5
    ctx.stroke()
  }

  // A signpost where the road leaves the picture.
  ctx.fillStyle = '#2a2f45'
  ctx.fillRect(1497, 792, 5, 34)
  box(ctx, 1432, 770, 136, 30, 6)
  ctx.fillStyle = '#f1e2a8'
  ctx.fill()
  ctx.strokeStyle = '#2a2f45'
  ctx.lineWidth = 2.5
  ctx.stroke()
  ctx.fillStyle = '#2a2f45'
  ctx.font = '700 15px "Nunito Variable", "Segoe UI", system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('Dark crater →', 1500, 786)
  ctx.restore()
}

// ---------------------------------------------------------------- the base

/** Traces the outline of a place, so it can be lit up when the player points at it. */
export function tracePlace(ctx: Ctx, id: PlaceId, grow: number) {
  switch (id) {
    case 'habitat':
      circle(ctx, HAB.x, HAB.y, HAB.r + grow)
      break
    case 'panels':
      box(ctx, 712 - grow, 100 - grow, 420 + 2 * grow, 104 + 2 * grow, 14)
      break
    case 'site':
      circle(ctx, SITE.x, SITE.y, SITE.r + grow)
      break
    case 'comms':
      circle(ctx, DISH.x, DISH.y, DISH.r + grow)
      break
    case 'scope':
      circle(ctx, SCOPE.x, SCOPE.y, SCOPE.r + grow)
      break
    default: {
      const r = ROOMS[id]
      box(ctx, r.x - grow, r.y - grow, r.w + 2 * grow, r.h + 2 * grow, 20 + grow)
    }
  }
}

function hulls(ctx: Ctx, grow: number, colour: string) {
  ctx.fillStyle = colour
  ctx.strokeStyle = colour
  ctx.lineCap = 'butt'
  ctx.lineWidth = 42 + 2 * grow
  for (const [a, b] of CORRIDORS) {
    line(ctx, a, b)
    ctx.stroke()
  }
  for (const r of roomList) {
    box(ctx, r.x - grow, r.y - grow, r.w + 2 * grow, r.h + 2 * grow, 20 + grow)
    ctx.fill()
  }
  circle(ctx, HAB.x, HAB.y, HAB.r + grow)
  ctx.fill()
  // The two airlocks: little porches where people put their suits on.
  circle(ctx, 800, 324, 24 + grow)
  ctx.fill()
  circle(ctx, 890, 540, 24 + grow)
  ctx.fill()
}

function floor(ctx: Ctx, r: Rect, colour: string) {
  box(ctx, r.x + WALL, r.y + WALL, r.w - 2 * WALL, r.h - 2 * WALL, 12)
  ctx.fillStyle = colour
  ctx.fill()
  // Floor tiles, and a soft shadow where the walls keep the light off.
  ctx.save()
  ctx.clip()
  ctx.strokeStyle = 'rgba(255,255,255,0.05)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  for (let x = r.x + WALL + 22; x < r.x + r.w - WALL; x += 22) {
    ctx.moveTo(x, r.y)
    ctx.lineTo(x, r.y + r.h)
  }
  for (let y = r.y + WALL + 22; y < r.y + r.h - WALL; y += 22) {
    ctx.moveTo(r.x, y)
    ctx.lineTo(r.x + r.w, y)
  }
  ctx.stroke()
  const shadow = ctx.createLinearGradient(0, r.y + WALL, 0, r.y + WALL + 16)
  shadow.addColorStop(0, 'rgba(6,8,22,0.34)')
  shadow.addColorStop(1, 'rgba(6,8,22,0)')
  ctx.fillStyle = shadow
  ctx.fillRect(r.x, r.y + WALL, r.w, 16)
  const side = ctx.createLinearGradient(r.x + WALL, 0, r.x + WALL + 12, 0)
  side.addColorStop(0, 'rgba(6,8,22,0.26)')
  side.addColorStop(1, 'rgba(6,8,22,0)')
  ctx.fillStyle = side
  ctx.fillRect(r.x + WALL, r.y, 12, r.h)
  ctx.restore()
}

/** A small crate, used here and there. */
function crate(ctx: Ctx, x: number, y: number, w: number, h: number, colour = '#c8a45a') {
  box(ctx, x, y, w, h, 3)
  ctx.fillStyle = colour
  ctx.fill()
  ctx.strokeStyle = EDGE
  ctx.lineWidth = 1.8
  ctx.stroke()
  ctx.strokeStyle = 'rgba(23,28,49,0.35)'
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.moveTo(x + 2, y + h / 2)
  ctx.lineTo(x + w - 2, y + h / 2)
  ctx.stroke()
}

/** Dims a room that has no power. */
function dark(ctx: Ctx, r: Rect) {
  box(ctx, r.x + WALL, r.y + WALL, r.w - 2 * WALL, r.h - 2 * WALL, 12)
  ctx.fillStyle = 'rgba(6,8,20,0.46)'
  ctx.fill()
}

export function drawBase(ctx: Ctx, base: BaseView, t: number) {
  const lit = (module: ModuleId) => base.on.has(module)

  // Long shadows: the Sun sits low in the top left.
  ctx.save()
  ctx.translate(16, 20)
  hulls(ctx, 2, 'rgba(10,12,28,0.3)')
  ctx.fillStyle = 'rgba(10,12,28,0.3)'
  for (let i = 0; i < base.panels; i++) {
    box(ctx, PANELS.x + i * (PANELS.w + PANELS.gap), PANELS.y, PANELS.w, PANELS.h, 4)
    ctx.fill()
  }
  circle(ctx, DISH.x, DISH.y, 50)
  ctx.fill()
  circle(ctx, SCOPE.x, SCOPE.y, 42)
  ctx.fill()
  ctx.restore()

  // The Moon-soil shield: once it is built, soil is heaped up around every room of the base.
  if (base.shield) {
    hulls(ctx, 27, '#5fd38d')
    hulls(ctx, 24, '#6f7a5f')
    hulls(ctx, 17, '#9aa588')
    hulls(ctx, 10, '#b9c2a4')
  }

  // A warm glow around every room that is switched on.
  ctx.save()
  ctx.shadowColor = 'rgba(255,214,120,0.95)'
  ctx.shadowBlur = 26
  ctx.fillStyle = EDGE
  for (const id of ['life', 'farm', 'lab', 'garage'] as const) {
    if (!lit(id)) continue
    const r = ROOMS[id]
    box(ctx, r.x, r.y, r.w, r.h, 20)
    ctx.fill()
  }
  ctx.restore()

  hulls(ctx, 4, EDGE)
  hulls(ctx, 0, HULL)

  // Floors. The corridor floors run a little way into the rooms, which makes the doorways.
  floor(ctx, ROOMS.life, FLOOR.life)
  floor(ctx, ROOMS.farm, FLOOR.farm)
  floor(ctx, ROOMS.lab, FLOOR.lab)
  floor(ctx, ROOMS.garage, FLOOR.garage)
  const habFloor = ctx.createRadialGradient(HAB.x, HAB.y, 10, HAB.x, HAB.y, HAB.r)
  habFloor.addColorStop(0, '#4a5890')
  habFloor.addColorStop(1, FLOOR.hab)
  ctx.fillStyle = habFloor
  circle(ctx, HAB.x, HAB.y, HAB.r - WALL)
  ctx.fill()
  ctx.fillStyle = '#c7a94e'
  circle(ctx, 800, 324, 15)
  ctx.fill()
  circle(ctx, 890, 540, 15)
  ctx.fill()
  ctx.strokeStyle = FLOOR.corridor
  ctx.lineWidth = 24
  ctx.lineCap = 'butt'
  for (const [a, b] of CORRIDORS) {
    const length = Math.hypot(b.x - a.x, b.y - a.y)
    const ux = ((b.x - a.x) / length) * 16
    const uy = ((b.y - a.y) / length) * 16
    line(ctx, { x: a.x - ux, y: a.y - uy }, { x: b.x + ux, y: b.y + uy })
    ctx.stroke()
  }
  // Airlock doorways and the rover's big door.
  ctx.fillStyle = '#c7a94e'
  ctx.fillRect(789, 332, 22, 14)
  ctx.save()
  ctx.translate(884, 534)
  ctx.rotate(Math.PI / 4)
  ctx.fillRect(-11, -6, 22, 14)
  ctx.restore()
  const g = ROOMS.garage
  ctx.fillStyle = FLOOR.garage
  ctx.fillRect(g.x + g.w - WALL - 2, 712, WALL + 8, 58)
  ctx.fillStyle = '#e9c34f'
  ctx.fillRect(g.x + g.w + 1, 712, 4, 58)

  habitat(ctx, t)
  lifeSupport(ctx, lit('life'), t)
  greenhouse(ctx, lit('farm'), base, t)
  lab(ctx, lit('lab'), t)
  garage(ctx, lit('garage'), t)

  for (const id of ['life', 'farm', 'lab', 'garage'] as const) if (!lit(id)) dark(ctx, ROOMS[id])

  solarPanels(ctx, base, t)
  radioDish(ctx, lit('comms'), t)
  sunTelescope(ctx, lit('scope'), t)
  buildSite(ctx, base.dish, t)

  // Trouble marks.
  for (const module of base.broken) trouble(ctx, module, '🔧', '#ff6b7a', t)
  for (const module of base.blocked) if (!base.broken.has(module)) trouble(ctx, module, '⛔', '#ffb454', t)
}

function modulePoint(module: ModuleId): Pt {
  if (module === 'comms') return { x: DISH.x, y: DISH.y }
  if (module === 'scope') return { x: SCOPE.x, y: SCOPE.y }
  const r = ROOMS[module]
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 }
}

function trouble(ctx: Ctx, module: ModuleId, icon: string, colour: string, t: number) {
  const p = modulePoint(module)
  const pulse = 1 + Math.sin(t * 5) * 0.08
  ctx.save()
  ctx.translate(p.x, p.y)
  ctx.scale(pulse, pulse)
  circle(ctx, 0, 0, 26)
  ctx.fillStyle = 'rgba(12,14,30,0.85)'
  ctx.fill()
  ctx.strokeStyle = colour
  ctx.lineWidth = 4
  ctx.stroke()
  ctx.font = '26px "Segoe UI Emoji", "Segoe UI", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#fff'
  ctx.fillText(icon, 0, 2)
  ctx.restore()
}

function habitat(ctx: Ctx, t: number) {
  // Floor rings, like a round room is tiled.
  ctx.strokeStyle = 'rgba(255,255,255,0.06)'
  ctx.lineWidth = 1.5
  for (const r of [58, 88]) {
    circle(ctx, HAB.x, HAB.y, r)
    ctx.stroke()
  }
  // A soft shadow under the wall at the top.
  ctx.save()
  circle(ctx, HAB.x, HAB.y, HAB.r - WALL)
  ctx.clip()
  const shadow = ctx.createLinearGradient(0, HAB.y - HAB.r + WALL, 0, HAB.y - HAB.r + WALL + 22)
  shadow.addColorStop(0, 'rgba(6,8,22,0.4)')
  shadow.addColorStop(1, 'rgba(6,8,22,0)')
  ctx.fillStyle = shadow
  ctx.fillRect(HAB.x - HAB.r, HAB.y - HAB.r, HAB.r * 2, 40)
  ctx.restore()

  // A round rug in the middle, where the crew gathers, with the table they eat at.
  circle(ctx, HAB.x, HAB.y + 34, 46)
  ctx.fillStyle = '#5a69a6'
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.22)'
  ctx.lineWidth = 3
  ctx.setLineDash([7, 6])
  circle(ctx, HAB.x, HAB.y + 34, 39)
  ctx.stroke()
  ctx.setLineDash([])
  circle(ctx, HAB.x, HAB.y + 26, 19)
  ctx.fillStyle = '#e6d3ad'
  ctx.fill()
  ctx.strokeStyle = EDGE
  ctx.lineWidth = 2
  ctx.stroke()
  for (const [dx, dy, colour] of [[-8, -5, '#ffffff'], [8, -4, '#ffffff'], [-3, 8, '#ffd166'], [9, 7, '#8fd3ff']] as [number, number, string][]) {
    circle(ctx, HAB.x + dx, HAB.y + 26 + dy, 3.8)
    ctx.fillStyle = colour
    ctx.fill()
    ctx.strokeStyle = 'rgba(23,28,49,0.6)'
    ctx.lineWidth = 1
    ctx.stroke()
  }

  // Beds, each with its own blanket.
  const blankets = ['#8fd3b0', '#f2b872', '#8fb8f2', '#d6a3f0']
  BEDS.forEach((bed, index) => {
    box(ctx, bed.x - 15, bed.y - 26, 30, 51, 6)
    ctx.fillStyle = '#b9c2e6'
    ctx.fill()
    ctx.strokeStyle = EDGE
    ctx.lineWidth = 2
    ctx.stroke()
    box(ctx, bed.x - 12, bed.y - 6, 24, 28, 5)
    ctx.fillStyle = blankets[index % blankets.length]
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.35)'
    ctx.fillRect(bed.x - 12, bed.y - 6, 24, 5)
    box(ctx, bed.x - 10, bed.y - 23, 20, 13, 5)
    ctx.fillStyle = '#ffffff'
    ctx.fill()
    ctx.strokeStyle = 'rgba(23,28,49,0.3)'
    ctx.lineWidth = 1
    ctx.stroke()
  })
  // Sick bay beds, with a red cross.
  for (const bed of MED_BEDS) {
    box(ctx, bed.x - 24, bed.y - 13, 48, 26, 6)
    ctx.fillStyle = '#f4f7ff'
    ctx.fill()
    ctx.strokeStyle = EDGE
    ctx.lineWidth = 2
    ctx.stroke()
    box(ctx, bed.x - 21, bed.y - 9, 13, 18, 4)
    ctx.fillStyle = '#dfe6fb'
    ctx.fill()
    ctx.fillStyle = '#ff5d6c'
    ctx.fillRect(bed.x + 10, bed.y - 2, 10, 4)
    ctx.fillRect(bed.x + 13, bed.y - 5, 4, 10)
  }
  // The radio desk for calling home, with two screens.
  box(ctx, 702, 424, 22, 66, 5)
  ctx.fillStyle = '#232a48'
  ctx.fill()
  ctx.strokeStyle = EDGE
  ctx.lineWidth = 2
  ctx.stroke()
  const glow = 0.6 + Math.sin(t * 3) * 0.2
  ctx.fillStyle = `rgba(120,220,255,${glow})`
  box(ctx, 706, 431, 10, 18, 2)
  ctx.fill()
  box(ctx, 706, 465, 10, 18, 2)
  ctx.fill()
  // A plant in a pot, and a shelf of lockers by the airlock.
  circle(ctx, 884, 396, 8)
  ctx.fillStyle = '#c9743f'
  ctx.fill()
  ctx.strokeStyle = EDGE
  ctx.lineWidth = 1.6
  ctx.stroke()
  for (const [dx, dy] of [[-5, -5], [5, -4], [0, -9], [-1, 0]]) {
    circle(ctx, 884 + dx, 396 + dy, 5)
    ctx.fillStyle = '#5fc27a'
    ctx.fill()
  }
}

function lifeSupport(ctx: Ctx, on: boolean, t: number) {
  // Two air tanks.
  for (const y of [418, 482]) {
    circle(ctx, 334, y, 25)
    const tank = ctx.createRadialGradient(326, y - 8, 3, 334, y, 25)
    tank.addColorStop(0, '#f2fbff')
    tank.addColorStop(1, '#7fa7bb')
    ctx.fillStyle = tank
    ctx.fill()
    ctx.strokeStyle = EDGE
    ctx.lineWidth = 2.5
    ctx.stroke()
    circle(ctx, 334, y, 8)
    ctx.fillStyle = '#4b6b7c'
    ctx.fill()
  }
  // Pipes to the fan.
  ctx.strokeStyle = '#9fb9c6'
  ctx.lineWidth = 6
  ctx.beginPath()
  ctx.moveTo(359, 418)
  ctx.lineTo(398, 418)
  ctx.moveTo(359, 482)
  ctx.lineTo(376, 482)
  ctx.lineTo(376, 418)
  ctx.stroke()
  // The fan that pushes fresh air into the corridor. It spins when the machine is on.
  circle(ctx, 410, 418, 22)
  ctx.fillStyle = '#22303c'
  ctx.fill()
  ctx.strokeStyle = EDGE
  ctx.lineWidth = 2.5
  ctx.stroke()
  ctx.save()
  ctx.translate(410, 418)
  ctx.rotate(on ? t * 7 : 0.4)
  ctx.fillStyle = on ? '#bfe9ff' : '#6b7c88'
  for (let i = 0; i < 4; i++) {
    ctx.rotate(Math.PI / 2)
    ctx.beginPath()
    ctx.ellipse(10, 0, 9, 4, 0.3, 0, TAU)
    ctx.fill()
  }
  ctx.restore()
  // A small light: green when running.
  circle(ctx, 444, 400, 5)
  ctx.fillStyle = on ? '#5fd38d' : '#7a2f3a'
  ctx.fill()
  // Bubbles in the tanks while the machine works.
  if (on) {
    ctx.fillStyle = 'rgba(255,255,255,0.75)'
    for (const [y, phase] of [[418, 0], [482, 1.7]]) {
      for (let i = 0; i < 3; i++) {
        const rise = ((t * 0.6 + phase + i * 0.33) % 1) * 30
        circle(ctx, 322 + i * 10, y + 14 - rise, 2 + (i % 2))
        ctx.fill()
      }
    }
  }
  // The control desk: a screen with bars, and two dials.
  box(ctx, 386, 462, 66, 38, 6)
  ctx.fillStyle = '#22303c'
  ctx.fill()
  ctx.strokeStyle = EDGE
  ctx.lineWidth = 2
  ctx.stroke()
  box(ctx, 392, 468, 30, 18, 3)
  ctx.fillStyle = on ? '#0f3a33' : '#1a2228'
  ctx.fill()
  if (on) {
    ctx.fillStyle = '#7ef0c0'
    for (let i = 0; i < 5; i++) {
      const h = 4 + Math.abs(Math.sin(t * 2 + i * 1.3)) * 10
      ctx.fillRect(395 + i * 5.2, 484 - h, 3.4, h)
    }
  }
  for (const [x, turn] of [[432, 0.6], [444, -0.9]]) {
    circle(ctx, x, 477, 5.5)
    ctx.fillStyle = '#e8eef4'
    ctx.fill()
    ctx.strokeStyle = EDGE
    ctx.lineWidth = 1.5
    ctx.stroke()
    const a = on ? turn + Math.sin(t * 1.5 + x) * 0.5 : -2.2
    ctx.strokeStyle = '#ff5d6c'
    ctx.beginPath()
    ctx.moveTo(x, 477)
    ctx.lineTo(x + Math.cos(a) * 4, 477 + Math.sin(a) * 4)
    ctx.stroke()
  }
  ctx.fillStyle = '#8a97a3'
  ctx.fillRect(392, 490, 54, 4)
}

function greenhouse(ctx: Ctx, on: boolean, base: BaseView, t: number) {
  const healthy = 1 - base.wilt
  const r = ROOMS.farm
  // A path of lighter tiles down the aisle.
  ctx.fillStyle = 'rgba(255,255,255,0.07)'
  ctx.fillRect(r.x + WALL + 4, 432, r.w - 2 * WALL - 8, 36)
  PLANT_BEDS.forEach((bed, index) => {
    // The planter: a wooden box of dark soil.
    box(ctx, bed.x - 25, bed.y - 17, 50, 34, 6)
    ctx.fillStyle = '#8a6238'
    ctx.fill()
    ctx.strokeStyle = '#2b1e12'
    ctx.lineWidth = 2
    ctx.stroke()
    box(ctx, bed.x - 21, bed.y - 13, 42, 26, 4)
    ctx.fillStyle = '#3d2a18'
    ctx.fill()
    // Six plants in each bed. They sway a little, and they droop after a storm.
    for (let i = 0; i < 6; i++) {
      const px = bed.x - 14 + (i % 3) * 14
      const py = bed.y - 6 + Math.floor(i / 3) * 12
      const sway = on ? Math.sin(t * 1.6 + index + i) * 0.9 : 0
      const size = (4.6 + ((index * 7 + i * 3) % 4) * 0.45) * (0.55 + 0.45 * base.lush) * (0.7 + 0.3 * healthy)
      const green = on ? [84, 196, 104] : [66, 118, 82]
      const sick = [150, 132, 70]
      const mix = green.map((value, k) => Math.round(value * healthy + sick[k] * (1 - healthy)))
      const leaf = `rgb(${mix.join(',')})`
      const dark = `rgb(${mix.map((value) => Math.round(value * 0.72)).join(',')})`
      // Four leaves around a middle.
      for (let k = 0; k < 4; k++) {
        const a = (k * Math.PI) / 2 + 0.6 + index
        ctx.beginPath()
        ctx.ellipse(px + sway + Math.cos(a) * size * 0.55, py + Math.sin(a) * size * 0.55, size * 0.7, size * 0.42, a, 0, TAU)
        ctx.fillStyle = k % 2 ? leaf : dark
        ctx.fill()
      }
      // Now and then a ripe tomato, when the plants are doing well.
      if (healthy > 0.6 && base.lush > 0.45 && (index * 5 + i * 3) % 4 === 0) {
        circle(ctx, px + sway + 1, py + 1, size * 0.36)
        ctx.fillStyle = '#ff6a55'
        ctx.fill()
      } else {
        circle(ctx, px + sway, py, size * 0.22)
        ctx.fillStyle = 'rgba(255,255,255,0.25)'
        ctx.fill()
      }
    }
  })
  // A watering can and a sack of seeds at the end of the aisle.
  box(ctx, r.x + r.w - WALL - 26, 441, 15, 13, 4)
  ctx.fillStyle = '#6cb8ff'
  ctx.fill()
  ctx.strokeStyle = EDGE
  ctx.lineWidth = 1.6
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(r.x + r.w - WALL - 26, 446)
  ctx.lineTo(r.x + r.w - WALL - 35, 441)
  ctx.stroke()
  crate(ctx, r.x + r.w - WALL - 28, 458, 18, 10, '#d9c38a')
  if (on) {
    // Grow-lights: a pink glow over the beds, from a lamp bar above each row.
    ctx.fillStyle = 'rgba(255,110,210,0.12)'
    for (const bed of PLANT_BEDS) {
      box(ctx, bed.x - 27, bed.y - 19, 54, 38, 8)
      ctx.fill()
    }
    ctx.fillStyle = `rgba(255,150,225,${0.75 + Math.sin(t * 2) * 0.1})`
    ctx.fillRect(r.x + WALL + 6, r.y + WALL + 1, r.w - 2 * WALL - 12, 3)
    ctx.fillRect(r.x + WALL + 6, r.y + r.h - WALL - 4, r.w - 2 * WALL - 12, 3)
  }
}

function lab(ctx: Ctx, on: boolean, t: number) {
  // A mat where people stand to work.
  box(ctx, 470, 700, 142, 40, 8)
  ctx.fillStyle = 'rgba(255,255,255,0.06)'
  ctx.fill()
  // A shelf of sample jars along the top wall.
  box(ctx, 486, 659, 126, 15, 4)
  ctx.fillStyle = '#c9cce0'
  ctx.fill()
  ctx.strokeStyle = EDGE
  ctx.lineWidth = 2
  ctx.stroke()
  ;(['#8cf0c0', '#ffd166', '#b79cff', '#6cb8ff', '#ff9aa8', '#8cf0c0', '#ffd166'] as string[]).forEach((colour, i) => {
    box(ctx, 492 + i * 17, 662, 9, 9, 2)
    ctx.fillStyle = on ? colour : '#7a7e96'
    ctx.fill()
    ctx.strokeStyle = 'rgba(23,28,49,0.55)'
    ctx.lineWidth = 1
    ctx.stroke()
  })
  // A long bench at the bottom and a short one on the left.
  ctx.fillStyle = '#d9dcec'
  ctx.strokeStyle = EDGE
  ctx.lineWidth = 2
  box(ctx, 448, 746, 164, 22, 5)
  ctx.fill()
  ctx.stroke()
  box(ctx, 442, 664, 20, 56, 5)
  ctx.fill()
  ctx.stroke()
  // A screen with a wiggly line, which glows when the Lab has power.
  box(ctx, 474, 749, 36, 16, 3)
  ctx.fillStyle = on ? '#123a38' : '#3a3f55'
  ctx.fill()
  ctx.strokeStyle = EDGE
  ctx.lineWidth = 1.5
  ctx.stroke()
  if (on) {
    ctx.strokeStyle = '#7ef0c0'
    ctx.lineWidth = 1.6
    ctx.beginPath()
    for (let i = 0; i <= 10; i++) {
      const x = 477 + i * 3
      const y = 757 + Math.sin(t * 3 + i * 0.9) * 4
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
  // A microscope.
  circle(ctx, 524, 757, 7)
  ctx.fillStyle = '#5b6282'
  ctx.fill()
  ctx.strokeStyle = EDGE
  ctx.lineWidth = 1.5
  ctx.stroke()
  circle(ctx, 524, 757, 3)
  ctx.fillStyle = '#cfe6ff'
  ctx.fill()
  // Flasks that bubble.
  for (const [x, colour] of [[548, '#8cf0c0'], [568, '#b79cff'], [592, '#6cb8ff']] as [number, string][]) {
    circle(ctx, x, 757, 7)
    ctx.fillStyle = on ? colour : '#6c7088'
    ctx.fill()
    ctx.strokeStyle = EDGE
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.fillStyle = 'rgba(255,255,255,0.7)'
    circle(ctx, x - 2 + (on ? Math.sin(t * 4 + x) * 1.5 : 0), 755, 1.6)
    ctx.fill()
  }
  // Moon soil to study, and the bricks pressed from it.
  box(ctx, 444, 672, 16, 16, 3)
  ctx.fillStyle = '#9a9384'
  ctx.fill()
  ctx.strokeStyle = 'rgba(23,28,49,0.5)'
  ctx.lineWidth = 1
  ctx.stroke()
  for (const y of [694, 703, 712]) {
    box(ctx, 445, y, 14, 7, 1.5)
    ctx.fillStyle = '#b8b09f'
    ctx.fill()
    ctx.stroke()
  }
}

function garage(ctx: Ctx, on: boolean, t: number) {
  // Yellow and black stripes on the floor by the big door.
  ctx.save()
  box(ctx, 918, 712, 20, 58, 3)
  ctx.clip()
  ctx.fillStyle = '#e9c34f'
  ctx.fillRect(918, 712, 20, 58)
  ctx.strokeStyle = '#2b2f3f'
  ctx.lineWidth = 5
  for (let y = 700; y < 790; y += 13) {
    ctx.beginPath()
    ctx.moveTo(914, y + 12)
    ctx.lineTo(942, y)
    ctx.stroke()
  }
  ctx.restore()
  // Parking marks for the rover.
  ctx.strokeStyle = 'rgba(233,195,79,0.7)'
  ctx.lineWidth = 3
  ctx.setLineDash([8, 6])
  box(ctx, 846, 716, 70, 50, 6)
  ctx.stroke()
  ctx.setLineDash([])
  // The charger. Its light blinks while it has power.
  box(ctx, 760, 684, 26, 30, 5)
  ctx.fillStyle = '#2b3350'
  ctx.fill()
  ctx.strokeStyle = EDGE
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.font = '700 20px "Segoe UI", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = on ? (Math.sin(t * 5) > -0.3 ? '#ffd166' : '#a8853a') : '#5a6076'
  ctx.fillText('⚡', 773, 700)
  // A cable from the charger to the parking place.
  ctx.strokeStyle = on ? '#ffd166' : '#5a6076'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(786, 700)
  ctx.quadraticCurveTo(820, 690, 848, 726)
  ctx.stroke()
  // A board of tools on the top wall.
  box(ctx, 800, 681, 92, 13, 4)
  ctx.fillStyle = '#6f7893'
  ctx.fill()
  ctx.strokeStyle = EDGE
  ctx.lineWidth = 1.8
  ctx.stroke()
  ctx.strokeStyle = '#e8ecf6'
  ctx.lineWidth = 2.4
  ctx.lineCap = 'round'
  for (const x of [810, 824, 838, 852, 866, 880]) {
    ctx.beginPath()
    ctx.moveTo(x, 684)
    ctx.lineTo(x, 691)
    ctx.stroke()
  }
  // A spare wheel, a tool chest and two crates.
  circle(ctx, 776, 746, 12)
  ctx.fillStyle = '#23263a'
  ctx.fill()
  ctx.strokeStyle = EDGE
  ctx.lineWidth = 2
  ctx.stroke()
  circle(ctx, 776, 746, 5)
  ctx.fillStyle = '#aab3ca'
  ctx.fill()
  box(ctx, 760, 770, 44, 16, 4)
  ctx.fillStyle = '#d2504a'
  ctx.fill()
  ctx.strokeStyle = EDGE
  ctx.stroke()
  ctx.fillStyle = '#f4f6fc'
  ctx.fillRect(776, 776, 12, 3)
  crate(ctx, 812, 772, 16, 14)
  crate(ctx, 830, 776, 13, 10, '#b7c0d8')
}

function solarPanels(ctx: Ctx, base: BaseView, t: number) {
  for (let i = 0; i < base.panels; i++) {
    const x = PANELS.x + i * (PANELS.w + PANELS.gap)
    const dead = i >= base.panels - base.panelsDead
    box(ctx, x - 2, PANELS.y - 2, PANELS.w + 4, PANELS.h + 4, 5)
    ctx.fillStyle = EDGE
    ctx.fill()
    const face = ctx.createLinearGradient(x, PANELS.y, x + PANELS.w, PANELS.y + PANELS.h)
    if (dead) {
      face.addColorStop(0, '#7b7d86')
      face.addColorStop(1, '#55575f')
    } else {
      face.addColorStop(0, '#5aa2ff')
      face.addColorStop(1, '#1d4fa6')
    }
    box(ctx, x, PANELS.y, PANELS.w, PANELS.h, 3)
    ctx.fillStyle = face
    ctx.fill()
    ctx.strokeStyle = dead ? 'rgba(30,32,40,0.5)' : 'rgba(210,232,255,0.5)'
    ctx.lineWidth = 1.2
    ctx.beginPath()
    for (let c = 1; c < 3; c++) {
      ctx.moveTo(x + (PANELS.w * c) / 3, PANELS.y)
      ctx.lineTo(x + (PANELS.w * c) / 3, PANELS.y + PANELS.h)
    }
    for (let r = 1; r < 5; r++) {
      ctx.moveTo(x, PANELS.y + (PANELS.h * r) / 5)
      ctx.lineTo(x + PANELS.w, PANELS.y + (PANELS.h * r) / 5)
    }
    ctx.stroke()
    if (dead) {
      // Dust on a panel that is not working.
      ctx.fillStyle = 'rgba(190,180,160,0.5)'
      for (let k = 0; k < 7; k++) {
        circle(ctx, x + 8 + ((k * 17) % 34), PANELS.y + 10 + ((k * 29) % 66), 4 + (k % 3))
        ctx.fill()
      }
    } else {
      // Sunlight glinting across the glass.
      const glint = ((t * 0.22 + i * 0.17) % 1.6) * (PANELS.h + 60) - 30
      ctx.save()
      box(ctx, x, PANELS.y, PANELS.w, PANELS.h, 3)
      ctx.clip()
      ctx.fillStyle = 'rgba(255,255,255,0.28)'
      ctx.beginPath()
      ctx.moveTo(x - 10, PANELS.y + glint)
      ctx.lineTo(x + PANELS.w + 10, PANELS.y + glint - 26)
      ctx.lineTo(x + PANELS.w + 10, PANELS.y + glint - 12)
      ctx.lineTo(x - 10, PANELS.y + glint + 14)
      ctx.fill()
      ctx.restore()
    }
  }
}

function radioDish(ctx: Ctx, on: boolean, t: number) {
  // A flat pad, with the dish on top.
  circle(ctx, DISH.x, DISH.y, 56)
  ctx.fillStyle = '#666a79'
  ctx.fill()
  ctx.strokeStyle = EDGE
  ctx.lineWidth = 3
  ctx.stroke()
  if (on) {
    // Radio waves going out.
    for (let i = 0; i < 3; i++) {
      const phase = (t * 0.6 + i / 3) % 1
      ctx.strokeStyle = `rgba(120,200,255,${0.55 * (1 - phase)})`
      ctx.lineWidth = 3
      circle(ctx, DISH.x, DISH.y, 48 + phase * 46)
      ctx.stroke()
    }
  }
  const bowl = ctx.createRadialGradient(DISH.x - 12, DISH.y - 12, 4, DISH.x, DISH.y, 46)
  bowl.addColorStop(0, on ? '#ffffff' : '#c3c7d6')
  bowl.addColorStop(1, on ? '#aeb8d4' : '#7c8094')
  circle(ctx, DISH.x, DISH.y, 44)
  ctx.fillStyle = bowl
  ctx.fill()
  ctx.strokeStyle = EDGE
  ctx.lineWidth = 3
  ctx.stroke()
  ctx.strokeStyle = 'rgba(23,28,49,0.35)'
  ctx.lineWidth = 1.5
  circle(ctx, DISH.x, DISH.y, 30)
  ctx.stroke()
  circle(ctx, DISH.x, DISH.y, 16)
  ctx.stroke()
  // The arm that holds the receiver. It turns slowly while the radio is on.
  ctx.save()
  ctx.translate(DISH.x, DISH.y)
  ctx.rotate(on ? t * 0.5 : 0.8)
  ctx.strokeStyle = EDGE
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(-40, 0)
  ctx.lineTo(40, 0)
  ctx.stroke()
  circle(ctx, 0, 0, 7)
  ctx.fillStyle = on ? '#ffd166' : '#5a6076'
  ctx.fill()
  ctx.stroke()
  ctx.restore()
}

function sunTelescope(ctx: Ctx, on: boolean, t: number) {
  circle(ctx, SCOPE.x, SCOPE.y, 50)
  ctx.fillStyle = '#666a79'
  ctx.fill()
  ctx.strokeStyle = EDGE
  ctx.lineWidth = 3
  ctx.stroke()
  // A small dome with a golden tube that always points at the Sun (top left).
  const dome = ctx.createRadialGradient(SCOPE.x - 10, SCOPE.y - 12, 4, SCOPE.x, SCOPE.y, 38)
  dome.addColorStop(0, '#ffffff')
  dome.addColorStop(1, '#a9b2cc')
  circle(ctx, SCOPE.x, SCOPE.y, 36)
  ctx.fillStyle = dome
  ctx.fill()
  ctx.stroke()
  ctx.save()
  ctx.translate(SCOPE.x, SCOPE.y)
  ctx.rotate(-Math.PI * 0.75)
  box(ctx, -4, -10, 56, 20, 6)
  ctx.fillStyle = on ? '#f0c14a' : '#8d8160'
  ctx.fill()
  ctx.stroke()
  circle(ctx, 52, 0, 11)
  ctx.fillStyle = on ? `rgba(255,${200 + Math.round(Math.sin(t * 3) * 40)},120,1)` : '#3b3f52'
  ctx.fill()
  ctx.stroke()
  ctx.restore()
}

function buildSite(ctx: Ctx, progress: number, t: number) {
  // The ground is cleared and marked out.
  circle(ctx, SITE.x, SITE.y, SITE.r)
  ctx.fillStyle = 'rgba(70,74,90,0.55)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(241,226,168,0.75)'
  ctx.lineWidth = 3
  ctx.setLineDash([12, 9])
  ctx.stroke()
  ctx.setLineDash([])

  // The dish goes up one slice at a time, like a pie.
  const slices = 12
  const built = Math.min(1, progress) * slices
  for (let i = 0; i < slices; i++) {
    const amount = Math.max(0, Math.min(1, built - i))
    const from = -Math.PI / 2 + (i * TAU) / slices
    const to = from + TAU / slices
    ctx.beginPath()
    ctx.moveTo(SITE.x, SITE.y)
    ctx.arc(SITE.x, SITE.y, 84, from, to)
    ctx.closePath()
    if (amount > 0) {
      ctx.fillStyle = `rgba(${i % 2 ? '232,236,248' : '214,220,238'},${0.35 + 0.65 * amount})`
      ctx.fill()
      ctx.strokeStyle = EDGE
      ctx.lineWidth = 2
      ctx.stroke()
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,0.16)'
      ctx.lineWidth = 1.5
      ctx.stroke()
    }
  }
  // The middle tower. When the telescope is finished its light comes on.
  circle(ctx, SITE.x, SITE.y, 15)
  ctx.fillStyle = progress >= 1 ? '#b79cff' : '#8891ab'
  ctx.fill()
  ctx.strokeStyle = EDGE
  ctx.lineWidth = 2.5
  ctx.stroke()
  if (progress >= 1) {
    for (let i = 0; i < 2; i++) {
      const phase = (t * 0.5 + i / 2) % 1
      ctx.strokeStyle = `rgba(183,156,255,${0.6 * (1 - phase)})`
      ctx.lineWidth = 3
      circle(ctx, SITE.x, SITE.y, 18 + phase * 70)
      ctx.stroke()
    }
  } else {
    // Crates of parts waiting beside the site.
    for (const [x, y] of [[1338, 752], [1356, 734], [1330, 620]]) {
      box(ctx, x - 9, y - 9, 18, 18, 3)
      ctx.fillStyle = '#c8a45a'
      ctx.fill()
      ctx.strokeStyle = EDGE
      ctx.lineWidth = 2
      ctx.stroke()
    }
  }
}

// ---------------------------------------------------------------- the crew

/** How each astronaut looks. Made up for the game. */
const LOOKS: Record<string, { skin: string; hair: string; style: 'long' | 'short' | 'bun' | 'curly' }> = {
  aoife: { skin: '#f3c9a8', hair: '#c9512f', style: 'long' },
  cian: { skin: '#c98f62', hair: '#24212b', style: 'short' },
  niamh: { skin: '#f0d0b4', hair: '#6b4326', style: 'bun' },
  oisin: { skin: '#e9bd94', hair: '#e6c35c', style: 'curly' },
}
const DEFAULT_LOOK = { skin: '#e9bd94', hair: '#4a3a2c', style: 'short' as const }

export function lookOf(id: string) {
  return LOOKS[id] ?? DEFAULT_LOOK
}
export function colourOf(id: string): string {
  return CREW.find((member) => member.id === id)?.colour ?? '#ffffff'
}

export interface PawnDraw {
  id: string
  x: number
  y: number
  face: Facing
  /** Grows while walking; 0 when standing still. */
  step: number
  suited: boolean
  lie?: 'v' | 'h'
  alpha?: number
  /** Above 0 just after being hit by the storm. */
  flash?: number
  selected?: boolean
  hover?: boolean
  /** At work: the hands are busy. */
  busy?: boolean
}

/** A darker (below 0) or lighter (above 0) shade of a colour written like "#5fd38d". */
function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16)
  const mix = (c: number) => Math.round(amount < 0 ? c * (1 + amount) : c + (255 - c) * amount)
  return `rgb(${mix((n >> 16) & 255)},${mix((n >> 8) & 255)},${mix(n & 255)})`
}

type Look = ReturnType<typeof lookOf>

/** The face: eyes that blink, rosy cheeks and a small smile. `r` is the size of the head. */
function faceOn(ctx: Ctx, id: string, x: number, y: number, r: number, face: Facing, t: number, asleep: boolean) {
  if (face === 'up') return
  const side = face === 'left' ? -1 : face === 'right' ? 1 : 0
  const cx = x + side * r * 0.3
  const seed = id.charCodeAt(0) * 0.37
  const blink = asleep || (t + seed) % 3.7 < 0.13
  ctx.fillStyle = 'rgba(255,110,125,0.4)'
  for (const dx of side === 0 ? [-r * 0.58, r * 0.58] : [-side * r * 0.12]) {
    circle(ctx, cx + dx, y + r * 0.42, r * 0.17)
    ctx.fill()
  }
  ctx.lineCap = 'round'
  ctx.strokeStyle = EDGE
  for (const dx of side === 0 ? [-r * 0.36, r * 0.36] : [side * r * 0.22]) {
    if (blink) {
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(cx + dx, y + r * 0.06, r * 0.14, 0.15 * Math.PI, 0.85 * Math.PI)
      ctx.stroke()
    } else {
      ctx.fillStyle = EDGE
      ctx.beginPath()
      ctx.ellipse(cx + dx, y + r * 0.12, r * 0.13, r * 0.18, 0, 0, TAU)
      ctx.fill()
      ctx.fillStyle = '#ffffff'
      circle(ctx, cx + dx - r * 0.04, y + r * 0.05, r * 0.055)
      ctx.fill()
    }
  }
  ctx.lineWidth = 1.4
  ctx.beginPath()
  ctx.arc(cx + side * r * 0.12, y + r * 0.34, r * 0.2, 0.18 * Math.PI, 0.82 * Math.PI)
  ctx.stroke()
}

/** Hair that hangs behind the head: it is painted before the face. */
function hairBehind(ctx: Ctx, look: Look, x: number, y: number, r: number, face: Facing) {
  ctx.fillStyle = look.hair
  ctx.strokeStyle = EDGE
  ctx.lineWidth = 1.6
  if (look.style === 'long' && face === 'up') {
    // Seen from behind, long hair is one curtain down the back.
    box(ctx, x - r - 2, y - 5, 2 * r + 4, r + 13, 9)
    ctx.fill()
    ctx.stroke()
  } else if (look.style === 'long') {
    // Seen from the front it is two locks, one each side of the face.
    // Joined up under the chin, they looked like a beard.
    const wide = r * 0.5
    for (const side of [-1, 1]) {
      box(ctx, side < 0 ? x - r - 2.5 : x + r + 2.5 - wide, y - 5, wide, r + 12, wide / 2)
      ctx.fill()
      ctx.stroke()
    }
  }
  if (look.style === 'bun') {
    circle(ctx, x, y - r - 3, r * 0.42)
    ctx.fill()
    ctx.stroke()
  }
  if (look.style === 'curly') {
    for (const a of [-2.75, -2.2, -1.57, -0.94, -0.39]) {
      circle(ctx, x + Math.cos(a) * (r + 1), y + Math.sin(a) * (r + 1), r * 0.38)
      ctx.fill()
      ctx.stroke()
    }
  }
}

/** The hair on top of the head, with a fringe. Looking sideways shows more of the back of it. */
function hairOnTop(ctx: Ctx, look: Look, x: number, y: number, r: number, face: Facing) {
  ctx.fillStyle = look.hair
  if (face === 'up') {
    circle(ctx, x, y, r)
    ctx.fill()
    return
  }
  const side = face === 'left' ? -1 : face === 'right' ? 1 : 0
  const R = r + 0.8
  const from = Math.PI - (side > 0 ? 0.5 : 0.1)
  const to = TAU + (side < 0 ? 0.5 : 0.1)
  ctx.beginPath()
  ctx.arc(x, y, R, from, to)
  ctx.quadraticCurveTo(x + r * 0.55, y - r * 0.42, x + side * r * 0.22, y - r * 0.4)
  ctx.quadraticCurveTo(x - r * 0.5, y - r * 0.62, x + Math.cos(from) * R, y + Math.sin(from) * R)
  ctx.closePath()
  ctx.fill()
  // A soft shine on the hair.
  ctx.strokeStyle = 'rgba(255,255,255,0.28)'
  ctx.lineWidth = 2
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.arc(x, y, r * 0.68, Math.PI * 1.2, Math.PI * 1.48)
  ctx.stroke()
}

/** A head with nothing on it. */
function bareHead(ctx: Ctx, id: string, x: number, y: number, r: number, face: Facing, t: number, asleep: boolean) {
  const look = lookOf(id)
  hairBehind(ctx, look, x, y, r, face)
  circle(ctx, x, y, r)
  ctx.fillStyle = look.skin
  ctx.fill()
  ctx.strokeStyle = EDGE
  ctx.lineWidth = 2
  ctx.stroke()
  hairOnTop(ctx, look, x, y, r, face)
  if (look.style === 'curly' && face !== 'up') {
    ctx.fillStyle = look.hair
    for (const dx of [-0.55, -0.1, 0.4]) {
      circle(ctx, x + dx * r, y - r * 0.62, r * 0.3)
      ctx.fill()
    }
  }
  faceOn(ctx, id, x, y, r, face, t, asleep)
}

/** A helmet. The glass is clear enough to see who is inside. */
function helmet(ctx: Ctx, id: string, x: number, y: number, face: Facing, t: number) {
  const colour = colourOf(id)
  const side = face === 'left' ? -1 : face === 'right' ? 1 : 0
  // A little aerial with a red light.
  ctx.strokeStyle = EDGE
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(x + 11, y - 13)
  ctx.lineTo(x + 15, y - 23)
  ctx.stroke()
  circle(ctx, x + 15, y - 24, 2.6)
  ctx.fillStyle = Math.sin(t * 4) > 0 ? '#ff5d6c' : '#a23a48'
  ctx.fill()
  circle(ctx, x, y, 18)
  ctx.fillStyle = '#f6f8fd'
  ctx.fill()
  ctx.strokeStyle = EDGE
  ctx.lineWidth = 2.2
  ctx.stroke()
  if (face === 'up') {
    // From behind: a stripe in their own colour.
    ctx.fillStyle = colour
    box(ctx, x - 4, y - 16, 8, 20, 3)
    ctx.fill()
    return
  }
  const vx = x + side * 4
  ctx.save()
  ctx.beginPath()
  ctx.ellipse(vx, y + 1, side === 0 ? 13.5 : 11.5, 12.5, 0, 0, TAU)
  ctx.fillStyle = '#243257'
  ctx.fill()
  ctx.clip()
  // The face inside.
  const look = lookOf(id)
  circle(ctx, vx, y + 2.5, 10.5)
  ctx.fillStyle = look.skin
  ctx.fill()
  hairOnTop(ctx, look, vx, y + 2.5, 10.5, face)
  faceOn(ctx, id, vx, y + 2.5, 10.5, face, t, false)
  ctx.fillStyle = 'rgba(120,190,255,0.2)'
  ctx.fillRect(vx - 16, y - 14, 32, 30)
  ctx.restore()
  ctx.beginPath()
  ctx.ellipse(vx, y + 1, side === 0 ? 13.5 : 11.5, 12.5, 0, 0, TAU)
  ctx.strokeStyle = EDGE
  ctx.lineWidth = 1.8
  ctx.stroke()
  // The shine on the glass.
  ctx.strokeStyle = 'rgba(255,255,255,0.75)'
  ctx.lineWidth = 2.2
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.arc(vx, y + 1, 9.5, Math.PI * 1.12, Math.PI * 1.4)
  ctx.stroke()
}

export interface NameTag {
  text: string
  colour: string
  x: number
  y: number
  faint: boolean
}

/** Draws the name tags. A tag that would cover another one is moved up, like a little list. */
export function drawNameTags(ctx: Ctx, tags: NameTag[]) {
  ctx.font = '700 17px "Nunito Variable", "Segoe UI", system-ui, sans-serif'
  const placed: Rect[] = []
  for (const tag of [...tags].sort((a, b) => b.y - a.y)) {
    const width = ctx.measureText(tag.text).width + 24
    const area = { x: tag.x - width / 2, y: tag.y - 11, w: width, h: 22 }
    const hits = (other: Rect) => area.x < other.x + other.w + 2 && area.x + area.w + 2 > other.x && area.y < other.y + other.h + 1 && area.y + area.h + 1 > other.y
    for (let tries = 0; tries < 8 && placed.some(hits); tries++) area.y -= 23
    placed.push(area)
    nameTag(ctx, tag.text, tag.colour, tag.x, area.y + 11, tag.faint)
  }
}

function nameTag(ctx: Ctx, text: string, colour: string, x: number, y: number, faint: boolean) {
  ctx.font = '700 17px "Nunito Variable", "Segoe UI", system-ui, sans-serif'
  const width = ctx.measureText(text).width + 24
  box(ctx, x - width / 2, y - 11, width, 22, 11)
  ctx.fillStyle = faint ? 'rgba(255,248,234,0.6)' : PAPER
  ctx.fill()
  ctx.strokeStyle = EDGE
  ctx.lineWidth = 2
  if (faint) ctx.setLineDash([4, 3])
  ctx.stroke()
  ctx.setLineDash([])
  ctx.fillStyle = colour
  circle(ctx, x - width / 2 + 10, y, 4.5)
  ctx.fill()
  ctx.lineWidth = 1.2
  ctx.stroke()
  ctx.fillStyle = faint ? 'rgba(28,35,64,0.6)' : EDGE
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x - width / 2 + 18, y + 0.5)
}

export const PAWN_SCALE = 1.25

/** An arm: a short round limb from the shoulder to the hand. */
function arm(ctx: Ctx, sx: number, sy: number, hx: number, hy: number, sleeve: string, hand: string) {
  ctx.lineCap = 'round'
  ctx.strokeStyle = EDGE
  ctx.lineWidth = 10
  ctx.beginPath()
  ctx.moveTo(sx, sy)
  ctx.lineTo(hx, hy)
  ctx.stroke()
  ctx.strokeStyle = sleeve
  ctx.lineWidth = 6.4
  ctx.beginPath()
  ctx.moveTo(sx, sy)
  ctx.lineTo(hx, hy)
  ctx.stroke()
  circle(ctx, hx, hy, 3.9)
  ctx.fillStyle = hand
  ctx.fill()
  ctx.strokeStyle = EDGE
  ctx.lineWidth = 1.5
  ctx.stroke()
}

/**
 * One astronaut, seen from above and a little from the front. (x, y) is where the feet are.
 * A small cartoon figure: a big head with a face, a round body, short arms and legs.
 */
export function drawPawn(ctx: Ctx, p: PawnDraw, t: number) {
  const colour = colourOf(p.id)
  const look = lookOf(p.id)
  const ghost = (p.alpha ?? 1) < 1
  ctx.save()
  // People are drawn a little larger than life, so they are easy to see and to click.
  ctx.translate(p.x, p.y)
  ctx.scale(PAWN_SCALE, PAWN_SCALE)
  ctx.translate(-p.x, -p.y)
  ctx.globalAlpha = p.alpha ?? 1
  ctx.lineJoin = 'round'

  if (p.lie) {
    // In bed: a head on the pillow and a blanket in their own colour.
    if (p.lie === 'v') {
      box(ctx, p.x - 12, p.y - 6, 24, 28, 7)
      ctx.fillStyle = colour
      ctx.fill()
      ctx.strokeStyle = EDGE
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.fillStyle = 'rgba(255,255,255,0.3)'
      ctx.fillRect(p.x - 11, p.y - 5, 22, 5)
      bareHead(ctx, p.id, p.x, p.y - 15, 12.5, 'down', t, true)
    } else {
      box(ctx, p.x - 8, p.y - 11, 30, 22, 7)
      ctx.fillStyle = colour
      ctx.fill()
      ctx.strokeStyle = EDGE
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.fillStyle = 'rgba(255,255,255,0.3)'
      ctx.fillRect(p.x - 7, p.y - 10, 5, 20)
      bareHead(ctx, p.id, p.x - 16, p.y - 2, 12.5, 'down', t, true)
    }
    ctx.restore()
    return
  }

  const walking = p.step > 0
  const seed = p.id.charCodeAt(0)
  const bob = walking ? -Math.abs(Math.sin(p.step)) * 3 : Math.sin(t * 2 + seed) * 0.7
  const shake = p.flash && p.flash > 0 ? Math.sin(t * 60) * 2.5 : 0
  const x = p.x + shake
  const y = p.y
  const side = p.face === 'left' ? -1 : p.face === 'right' ? 1 : 0
  const swing = walking ? Math.sin(p.step) : 0
  const work = p.busy && !walking ? Math.sin(t * 9 + seed) : 0

  if (!ghost) {
    ctx.fillStyle = 'rgba(8,10,24,0.38)'
    ctx.beginPath()
    ctx.ellipse(x + 3, y + 2, 17, 6.5, 0, 0, TAU)
    ctx.fill()
  }
  if (p.selected || p.hover) {
    ctx.strokeStyle = p.selected ? '#6cb8ff' : 'rgba(255,255,255,0.7)'
    ctx.lineWidth = p.selected ? 4 : 2.5
    ctx.beginPath()
    ctx.ellipse(x, y + 1, 24 + (p.selected ? Math.sin(t * 6) * 2 : 0), 10, 0, 0, TAU)
    ctx.stroke()
  }

  const cloth = p.suited ? '#f1f3f9' : colour
  const clothDark = p.suited ? '#c5cbdb' : shade(colour, -0.3)
  const sleeve = p.suited ? '#e3e7f1' : shade(colour, -0.1)
  const hand = p.suited ? '#8f98b3' : look.skin
  const boot = p.suited ? '#8a93ad' : '#2a2f4a'

  // Legs and boots. The feet take turns while walking.
  for (const [dx, lift] of [[-6.5, Math.max(0, swing) * 4], [6.5, Math.max(0, -swing) * 4]]) {
    box(ctx, x + dx - 4.5, y - 14 - lift, 9, 10, 3)
    ctx.fillStyle = clothDark
    ctx.fill()
    ctx.strokeStyle = EDGE
    ctx.lineWidth = 1.6
    ctx.stroke()
    box(ctx, x + dx - 5.5 + side * 1.5, y - 6.5 - lift, 11, 7.5, 3.5)
    ctx.fillStyle = boot
    ctx.fill()
    ctx.stroke()
  }

  const top = y - 37 + bob
  const shoulder = top + 8

  if (p.suited && p.face !== 'down') {
    // The life-support backpack.
    if (side !== 0) {
      box(ctx, x - side * 21 - 6, top + 1, 13, 23, 4)
      ctx.fillStyle = '#aab3ca'
      ctx.fill()
      ctx.strokeStyle = EDGE
      ctx.lineWidth = 2
      ctx.stroke()
    }
  }

  // Seen from the front or the back, the arms hang at the sides, behind the body's edge.
  if (side === 0) {
    for (const dir of [-1, 1]) {
      const reach = work !== 0 ? 6 + work * dir * 3 : 0
      const sway = walking ? swing * dir * 3 : 0
      const up = p.face === 'up' && work !== 0
      arm(ctx, x + dir * 13.5, shoulder, x + dir * (15.5 - (work !== 0 ? 5 : 0)), shoulder + 13 - reach * (up ? 1.6 : 1) + sway, sleeve, hand)
    }
  }

  // Body.
  box(ctx, x - 13, top, 26, 27, 10)
  ctx.fillStyle = cloth
  ctx.fill()
  ctx.strokeStyle = EDGE
  ctx.lineWidth = 2.2
  ctx.stroke()
  // A little shading down one side makes it round.
  ctx.fillStyle = 'rgba(10,14,40,0.13)'
  box(ctx, x + 4, top + 2.5, 7.5, 22, 5)
  ctx.fill()
  if (p.suited) {
    // A band in their own colour, so everyone can tell who is who in a suit.
    ctx.fillStyle = colour
    ctx.fillRect(x - 12, top + 13, 24, 6)
    ctx.strokeStyle = EDGE
    ctx.lineWidth = 1
    ctx.strokeRect(x - 12, top + 13, 24, 6)
    if (p.face === 'down') {
      // The control box on the chest, with two small lights.
      box(ctx, x - 6.5, top + 4, 13, 7, 2)
      ctx.fillStyle = '#8f98b3'
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = '#5fd38d'
      circle(ctx, x - 3, top + 7.5, 1.4)
      ctx.fill()
      ctx.fillStyle = '#ffd166'
      circle(ctx, x + 2.5, top + 7.5, 1.4)
      ctx.fill()
    }
    if (p.face === 'up') {
      box(ctx, x - 11, top - 1, 22, 24, 5)
      ctx.fillStyle = '#aab3ca'
      ctx.fill()
      ctx.strokeStyle = EDGE
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.strokeStyle = 'rgba(23,28,49,0.45)'
      ctx.lineWidth = 1.5
      for (const dy of [6, 11, 16]) {
        ctx.beginPath()
        ctx.moveTo(x - 6, top + dy)
        ctx.lineTo(x + 6, top + dy)
        ctx.stroke()
      }
    }
  } else {
    // A belt, and from the front a collar, a zip and a badge.
    ctx.fillStyle = clothDark
    ctx.fillRect(x - 12, top + 18, 24, 3.6)
    if (p.face === 'down') {
      ctx.fillStyle = '#f6f8fd'
      ctx.beginPath()
      ctx.moveTo(x - 6, top + 1.2)
      ctx.lineTo(x, top + 8)
      ctx.lineTo(x + 6, top + 1.2)
      ctx.closePath()
      ctx.fill()
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(x, top + 8)
      ctx.lineTo(x, top + 18)
      ctx.stroke()
      circle(ctx, x - 6.5, top + 12, 2.6)
      ctx.fillStyle = '#ffffff'
      ctx.fill()
    }
  }

  // Seen from the side, one arm swings in front of the body.
  if (side !== 0) {
    const angle = work !== 0 ? -1.15 + work * 0.35 : swing * 0.75
    const hx = x + side * (2 + Math.sin(-angle) * 14)
    const hy = shoulder + Math.cos(angle) * 14
    arm(ctx, x + side * 2, shoulder, hx, hy, sleeve, hand)
  }

  const hy = top - 10
  if (p.suited) helmet(ctx, p.id, x, hy, p.face, t)
  else bareHead(ctx, p.id, x, hy, 15.5, p.face, t, false)

  if (p.flash && p.flash > 0) {
    ctx.fillStyle = `rgba(255,60,90,${Math.min(0.6, p.flash)})`
    box(ctx, x - 19, top - 30, 38, 68, 16)
    ctx.fill()
  }
  if (p.selected) {
    // A bouncing arrow over whoever is picked.
    const lift = Math.abs(Math.sin(t * 4)) * 6
    ctx.fillStyle = '#6cb8ff'
    ctx.beginPath()
    ctx.moveTo(x - 9, top - 64 - lift)
    ctx.lineTo(x + 9, top - 64 - lift)
    ctx.lineTo(x, top - 52 - lift)
    ctx.fill()
  }
  ctx.restore()
}

/** Where the name tag of a figure goes. */
export function tagPoint(p: { x: number; y: number; lie?: 'v' | 'h' }): Pt {
  return { x: p.x, y: p.y - (p.lie ? 44 : 74) * PAWN_SCALE }
}

/** The rover, pointing along its direction of travel. */
export function drawRover(ctx: Ctx, x: number, y: number, angle: number, moving: boolean, t: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.fillStyle = 'rgba(8,10,24,0.35)'
  ctx.beginPath()
  ctx.ellipse(8, 12, 36, 20, 0, 0, TAU)
  ctx.fill()
  ctx.rotate(angle)
  const jiggle = moving ? Math.sin(t * 30) * 0.6 : 0
  ctx.translate(0, jiggle)
  // Six wheels.
  ctx.fillStyle = '#20243a'
  for (const wx of [-20, 0, 20]) {
    box(ctx, wx - 8, -22, 16, 9, 3)
    ctx.fill()
    box(ctx, wx - 8, 13, 16, 9, 3)
    ctx.fill()
  }
  box(ctx, -30, -15, 60, 30, 9)
  ctx.fillStyle = '#eceff7'
  ctx.fill()
  ctx.strokeStyle = EDGE
  ctx.lineWidth = 2.5
  ctx.stroke()
  // A solar panel on the back and a window at the front.
  box(ctx, -25, -10, 26, 20, 3)
  ctx.fillStyle = '#3a6fd0'
  ctx.fill()
  ctx.strokeStyle = 'rgba(210,232,255,0.6)'
  ctx.lineWidth = 1
  ctx.stroke()
  box(ctx, 8, -11, 17, 22, 6)
  ctx.fillStyle = '#1c2748'
  ctx.fill()
  ctx.fillStyle = 'rgba(160,210,255,0.6)'
  ctx.fillRect(19, -7, 3, 8)
  ctx.fillStyle = '#ffb454'
  ctx.fillRect(3, -15, 4, 30)
  ctx.restore()
}

/** A small card under a module: its name, and a switch that shows what power it costs. */
export interface LabelDraw {
  id: PlaceId
  name: string
  at: Pt
  note?: string
  switch?: { cost: number; state: 'on' | 'off' | 'cannot' }
  hot?: boolean
}

/** Draws a label and returns the area of its switch, so a click on it can be found. */
export function drawLabel(ctx: Ctx, label: LabelDraw): Rect | null {
  ctx.font = '700 17px "Nunito Variable", "Segoe UI", system-ui, sans-serif'
  const nameWidth = ctx.measureText(label.name).width
  const switchText = label.switch ? `${label.switch.cost} ${label.switch.state === 'on' ? 'ON' : 'OFF'}` : ''
  // Room for the little bolt in front of the number.
  const BOLT = 15
  const switchWidth = label.switch ? ctx.measureText(switchText).width + 20 + BOLT : 0
  const total = nameWidth + 24 + switchWidth
  const x = label.at.x - total / 2
  const y = label.at.y - 14
  box(ctx, x, y, total, 28, 14)
  ctx.fillStyle = PAPER
  ctx.fill()
  ctx.strokeStyle = EDGE
  ctx.lineWidth = 2.2
  ctx.stroke()
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  let area: Rect | null = null
  if (label.switch) {
    const on = label.switch.state === 'on'
    const cannot = label.switch.state === 'cannot'
    box(ctx, x + 3, y + 3, switchWidth - 2, 22, 11)
    ctx.fillStyle = on ? '#ffc93c' : label.hot ? '#ffe9a8' : cannot ? '#e4dcc8' : '#ffffff'
    ctx.fill()
    ctx.strokeStyle = cannot ? '#a9a595' : EDGE
    ctx.lineWidth = 1.8
    ctx.stroke()
    // The bolt: the same one as in the top bar. Grey when the switch cannot be used.
    ctx.save()
    ctx.translate(x + 8, y + 6.5)
    ctx.scale(0.62, 0.62)
    ctx.beginPath()
    for (const [px, py] of [[13.5, 2], [5, 13.5], [11, 13.5], [9.5, 22], [19, 10], [12.8, 10]]) ctx.lineTo(px, py)
    ctx.closePath()
    ctx.fillStyle = on ? '#ffffff' : cannot ? '#c9c2ae' : '#ffc93c'
    ctx.fill()
    ctx.strokeStyle = cannot ? '#a9a595' : EDGE
    ctx.lineWidth = 2.4
    ctx.lineJoin = 'round'
    ctx.stroke()
    ctx.restore()
    ctx.fillStyle = cannot ? '#8a8676' : EDGE
    ctx.fillText(switchText, x + 11 + BOLT, y + 15)
    area = { x: x - 4, y: y - 6, w: switchWidth + 10, h: 40 }
  }
  ctx.fillStyle = EDGE
  ctx.fillText(label.name, x + switchWidth + 12, y + 15)
  if (label.note) {
    ctx.font = '700 14px "Nunito Variable", "Segoe UI", system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillStyle = '#ffe9a8'
    const noteWidth = ctx.measureText(label.note).width + 16
    box(ctx, label.at.x - noteWidth / 2, y + 31, noteWidth, 20, 10)
    ctx.fill()
    ctx.strokeStyle = EDGE
    ctx.lineWidth = 1.6
    ctx.stroke()
    ctx.fillStyle = EDGE
    ctx.fillText(label.note, label.at.x, y + 42)
  }
  return area
}
