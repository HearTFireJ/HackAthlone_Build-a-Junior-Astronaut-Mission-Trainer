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
  shelter: '#5b4f3d',
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
  return false
}

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
  ctx.font = '700 15px "Segoe UI", system-ui, sans-serif'
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

  // The storm shelter is buried under a heap of Moon soil.
  const s = ROOMS.shelter
  const heap = ctx.createRadialGradient(s.x + s.w / 2 - 20, s.y + s.h / 2 - 20, 20, s.x + s.w / 2, s.y + s.h / 2, 120)
  heap.addColorStop(0, base.shield ? '#b9c7a2' : '#a59a86')
  heap.addColorStop(1, base.shield ? '#6f8163' : '#6f675b')
  ctx.fillStyle = heap
  box(ctx, s.x - 26, s.y - 24, s.w + 52, s.h + 48, 46)
  ctx.fill()
  ctx.strokeStyle = base.shield ? '#5fd38d' : 'rgba(30,26,20,0.55)'
  ctx.lineWidth = base.shield ? 4 : 2.5
  ctx.stroke()

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
  floor(ctx, ROOMS.shelter, FLOOR.shelter)
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
  shelter(ctx)

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
  // A round rug in the middle, where the crew gathers.
  circle(ctx, HAB.x, HAB.y + 34, 46)
  ctx.fillStyle = '#56659f'
  ctx.fill()
  circle(ctx, HAB.x, HAB.y + 34, 34)
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'
  ctx.lineWidth = 3
  ctx.stroke()

  // Beds.
  for (const bed of BEDS) {
    box(ctx, bed.x - 14, bed.y - 24, 28, 48, 6)
    ctx.fillStyle = '#c9d2f2'
    ctx.fill()
    ctx.strokeStyle = EDGE
    ctx.lineWidth = 2
    ctx.stroke()
    box(ctx, bed.x - 10, bed.y - 21, 20, 12, 4)
    ctx.fillStyle = '#ffffff'
    ctx.fill()
  }
  // Sick bay beds, with a red cross.
  for (const bed of MED_BEDS) {
    box(ctx, bed.x - 24, bed.y - 13, 48, 26, 6)
    ctx.fillStyle = '#f4f7ff'
    ctx.fill()
    ctx.strokeStyle = EDGE
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.fillStyle = '#ff5d6c'
    ctx.fillRect(bed.x + 10, bed.y - 2, 10, 4)
    ctx.fillRect(bed.x + 13, bed.y - 5, 4, 10)
  }
  // The radio desk for calling home.
  box(ctx, 702, 424, 22, 66, 5)
  ctx.fillStyle = '#232a48'
  ctx.fill()
  ctx.strokeStyle = EDGE
  ctx.lineWidth = 2
  ctx.stroke()
  const glow = 0.6 + Math.sin(t * 3) * 0.2
  ctx.fillStyle = `rgba(120,220,255,${glow})`
  ctx.fillRect(706, 432, 9, 16)
  ctx.fillRect(706, 466, 9, 16)
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
}

function greenhouse(ctx: Ctx, on: boolean, base: BaseView, t: number) {
  const healthy = 1 - base.wilt
  PLANT_BEDS.forEach((bed, index) => {
    box(ctx, bed.x - 26, bed.y - 18, 52, 36, 6)
    ctx.fillStyle = '#5d4329'
    ctx.fill()
    ctx.strokeStyle = '#2b1e12'
    ctx.lineWidth = 2
    ctx.stroke()
    // Six plants in each bed. They sway a little, and they droop after a storm.
    for (let i = 0; i < 6; i++) {
      const px = bed.x - 16 + (i % 3) * 16
      const py = bed.y - 8 + Math.floor(i / 3) * 16
      const sway = on ? Math.sin(t * 1.6 + index + i) * 0.8 : 0
      const size = (5.2 + ((index * 7 + i * 3) % 4) * 0.5) * (0.55 + 0.45 * base.lush) * (0.7 + 0.3 * healthy)
      const green = on ? [88, 200, 110] : [70, 120, 84]
      const sick = [150, 132, 70]
      const mix = green.map((value, k) => Math.round(value * healthy + sick[k] * (1 - healthy)))
      ctx.fillStyle = `rgb(${mix.join(',')})`
      circle(ctx, px + sway, py, size)
      ctx.fill()
      ctx.fillStyle = 'rgba(255,255,255,0.22)'
      circle(ctx, px + sway - size * 0.3, py - size * 0.3, size * 0.4)
      ctx.fill()
    }
  })
  if (on) {
    // Grow-lights: a pink glow over the beds.
    ctx.fillStyle = 'rgba(255,110,210,0.13)'
    for (const bed of PLANT_BEDS) {
      box(ctx, bed.x - 30, bed.y - 22, 60, 44, 8)
      ctx.fill()
    }
  }
}

function lab(ctx: Ctx, on: boolean, t: number) {
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
  // A screen that glows when the Lab has power.
  box(ctx, 478, 749, 28, 15, 3)
  ctx.fillStyle = on ? `rgba(130,240,200,${0.7 + Math.sin(t * 4) * 0.2})` : '#3a3f55'
  ctx.fill()
  // Flasks.
  for (const [x, colour] of [[540, '#8cf0c0'], [562, '#b79cff'], [592, '#6cb8ff']] as [number, string][]) {
    circle(ctx, x, 757, 7)
    ctx.fillStyle = on ? colour : '#6c7088'
    ctx.fill()
    ctx.strokeStyle = EDGE
    ctx.lineWidth = 1.5
    ctx.stroke()
  }
  // A box of Moon soil to study.
  box(ctx, 444, 676, 16, 16, 3)
  ctx.fillStyle = '#9a9384'
  ctx.fill()
}

function garage(ctx: Ctx, on: boolean, t: number) {
  // Parking marks for the rover.
  ctx.strokeStyle = 'rgba(233,195,79,0.7)'
  ctx.lineWidth = 3
  ctx.setLineDash([8, 6])
  box(ctx, 852, 716, 80, 50, 6)
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
  ctx.quadraticCurveTo(820, 690, 852, 726)
  ctx.stroke()
  // Tools on the wall.
  box(ctx, 760, 772, 60, 14, 4)
  ctx.fillStyle = '#8891ab'
  ctx.fill()
}

function shelter(ctx: Ctx) {
  // Two benches and a box of supplies. Nothing else fits.
  ctx.fillStyle = '#8a7a5f'
  ctx.strokeStyle = '#2b2419'
  ctx.lineWidth = 2
  box(ctx, 500, 187, 136, 9, 3)
  ctx.fill()
  ctx.stroke()
  // A box of food and water, in case the storm lasts.
  box(ctx, 610, 198, 24, 18, 3)
  ctx.fillStyle = '#c8a45a'
  ctx.fill()
  ctx.stroke()
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
}

function head(ctx: Ctx, id: string, x: number, y: number, face: Facing, suited: boolean, t: number, asleep = false) {
  const look = lookOf(id)
  if (suited) {
    circle(ctx, x, y, 15)
    ctx.fillStyle = '#f4f6fc'
    ctx.fill()
    ctx.strokeStyle = EDGE
    ctx.lineWidth = 2.2
    ctx.stroke()
    if (face !== 'up') {
      // The dark glass of the helmet, with a glint.
      const shift = face === 'left' ? -5 : face === 'right' ? 5 : 0
      ctx.beginPath()
      ctx.ellipse(x + shift, y + 1.5, face === 'down' ? 10 : 7.5, 7.5, 0, 0, TAU)
      ctx.fillStyle = '#1c2748'
      ctx.fill()
      ctx.fillStyle = 'rgba(160,210,255,0.75)'
      ctx.beginPath()
      ctx.ellipse(x + shift - 3, y - 1.5, 3, 1.8, -0.5, 0, TAU)
      ctx.fill()
    }
    return
  }
  // Hair first, then the face on top of it.
  ctx.fillStyle = look.hair
  if (look.style === 'long' && face !== 'up') {
    box(ctx, x - 13.5, y - 2, 27, 17, 6)
    ctx.fill()
  }
  circle(ctx, x, y, 13.5)
  ctx.fill()
  if (look.style === 'long' && face === 'up') {
    box(ctx, x - 13.5, y - 2, 27, 19, 7)
    ctx.fill()
  }
  if (look.style === 'bun') {
    circle(ctx, x, y - 14, 6)
    ctx.fill()
  }
  if (look.style === 'curly') {
    for (const [dx, dy] of [[-10, -8], [-4, -13], [4, -13], [10, -8]]) {
      circle(ctx, x + dx, y + dy, 5)
      ctx.fill()
    }
  }
  ctx.strokeStyle = EDGE
  ctx.lineWidth = 1.2
  if (face === 'up') return
  const shift = face === 'left' ? -3.5 : face === 'right' ? 3.5 : 0
  circle(ctx, x + shift, y + 3, 10.5)
  ctx.fillStyle = look.skin
  ctx.fill()
  // Eyes. They blink now and then, and stay shut in bed.
  const seed = id.charCodeAt(0) * 0.37
  const blink = asleep || (t + seed) % 3.7 < 0.13
  ctx.fillStyle = EDGE
  ctx.strokeStyle = EDGE
  ctx.lineWidth = 1.6
  const eyes = face === 'down' ? [-4, 4] : [face === 'left' ? -7 : 7]
  for (const dx of eyes) {
    if (blink) {
      ctx.beginPath()
      ctx.moveTo(x + dx - 2, y + 3.5)
      ctx.lineTo(x + dx + 2, y + 3.5)
      ctx.stroke()
    } else {
      circle(ctx, x + dx, y + 3, 1.8)
      ctx.fill()
    }
  }
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
  ctx.font = '700 17px "Segoe UI", system-ui, sans-serif'
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
  ctx.font = '700 17px "Segoe UI", system-ui, sans-serif'
  const width = ctx.measureText(text).width + 24
  box(ctx, x - width / 2, y - 11, width, 22, 11)
  ctx.fillStyle = faint ? 'rgba(10,14,30,0.5)' : 'rgba(10,14,30,0.82)'
  ctx.fill()
  ctx.strokeStyle = colour
  ctx.lineWidth = 1.5
  if (faint) ctx.setLineDash([4, 3])
  ctx.stroke()
  ctx.setLineDash([])
  ctx.fillStyle = colour
  circle(ctx, x - width / 2 + 10, y, 4)
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x - width / 2 + 18, y + 0.5)
}

export const PAWN_SCALE = 1.25

/** One astronaut, seen from above and a little from the front. (x, y) is where the feet are. */
export function drawPawn(ctx: Ctx, p: PawnDraw, t: number) {
  const colour = colourOf(p.id)
  const ghost = (p.alpha ?? 1) < 1
  ctx.save()
  // People are drawn a little larger than life, so they are easy to see and to click.
  ctx.translate(p.x, p.y)
  ctx.scale(PAWN_SCALE, PAWN_SCALE)
  ctx.translate(-p.x, -p.y)
  ctx.globalAlpha = p.alpha ?? 1

  if (p.lie) {
    // In bed: a head on the pillow and a blanket in their own colour.
    if (p.lie === 'v') {
      box(ctx, p.x - 12, p.y - 6, 24, 28, 6)
      ctx.fillStyle = colour
      ctx.fill()
      ctx.strokeStyle = EDGE
      ctx.lineWidth = 2
      ctx.stroke()
      head(ctx, p.id, p.x, p.y - 14, 'down', false, t, true)
    } else {
      box(ctx, p.x - 8, p.y - 11, 30, 22, 6)
      ctx.fillStyle = colour
      ctx.fill()
      ctx.strokeStyle = EDGE
      ctx.lineWidth = 2
      ctx.stroke()
      head(ctx, p.id, p.x - 15, p.y - 2, 'down', false, t, true)
    }
    ctx.restore()
    return
  }

  const walking = p.step > 0
  const seed = p.id.charCodeAt(0)
  const bob = walking ? -Math.abs(Math.sin(p.step)) * 3.5 : Math.sin(t * 2 + seed) * 0.7
  const shake = p.flash && p.flash > 0 ? Math.sin(t * 60) * 2.5 : 0
  const x = p.x + shake
  const y = p.y

  if (!ghost) {
    ctx.fillStyle = 'rgba(8,10,24,0.38)'
    ctx.beginPath()
    ctx.ellipse(x + 3, y + 2, 16, 6, 0, 0, TAU)
    ctx.fill()
  }
  if (p.selected || p.hover) {
    ctx.strokeStyle = p.selected ? '#6cb8ff' : 'rgba(255,255,255,0.7)'
    ctx.lineWidth = p.selected ? 4 : 2.5
    ctx.beginPath()
    ctx.ellipse(x, y + 1, 23 + (p.selected ? Math.sin(t * 6) * 2 : 0), 10, 0, 0, TAU)
    ctx.stroke()
  }

  // Feet take turns while walking.
  const swing = walking ? Math.sin(p.step) * 3.5 : 0
  ctx.fillStyle = p.suited ? '#9aa3bd' : '#232842'
  box(ctx, x - 11, y - 6 - Math.max(0, swing), 9, 7, 3)
  ctx.fill()
  box(ctx, x + 2, y - 6 - Math.max(0, -swing), 9, 7, 3)
  ctx.fill()

  // Body.
  const top = y - 35 + bob
  if (p.suited && p.face !== 'down') {
    // The life-support backpack.
    const bx = p.face === 'up' ? x - 11 : p.face === 'left' ? x + 6 : x - 20
    box(ctx, bx, top + 2, p.face === 'up' ? 22 : 14, 22, 4)
    ctx.fillStyle = '#aab3ca'
    ctx.fill()
    ctx.strokeStyle = EDGE
    ctx.lineWidth = 2
    ctx.stroke()
  }
  box(ctx, x - 14, top, 28, 31, 10)
  ctx.fillStyle = p.suited ? '#eef1f8' : colour
  ctx.fill()
  ctx.strokeStyle = EDGE
  ctx.lineWidth = 2.2
  ctx.stroke()
  if (p.suited) {
    // A band in their own colour, so everyone can tell who is who in a suit.
    ctx.fillStyle = colour
    ctx.fillRect(x - 13, top + 12, 26, 8)
    ctx.strokeStyle = EDGE
    ctx.lineWidth = 1
    ctx.strokeRect(x - 13, top + 12, 26, 8)
  } else {
    ctx.fillStyle = 'rgba(0,0,0,0.22)'
    ctx.fillRect(x - 13, top + 19, 26, 4)
    if (p.face === 'down') {
      ctx.fillStyle = 'rgba(255,255,255,0.5)'
      ctx.fillRect(x - 1.2, top + 4, 2.4, 14)
    }
  }

  head(ctx, p.id, x, top - 8, p.face, p.suited, t)

  if (p.flash && p.flash > 0) {
    ctx.fillStyle = `rgba(255,60,90,${Math.min(0.6, p.flash)})`
    box(ctx, x - 17, top - 24, 34, 60, 14)
    ctx.fill()
  }
  if (p.selected) {
    // A bouncing arrow over whoever is picked.
    const lift = Math.abs(Math.sin(t * 4)) * 6
    ctx.fillStyle = '#6cb8ff'
    ctx.beginPath()
    ctx.moveTo(x - 9, top - 62 - lift)
    ctx.lineTo(x + 9, top - 62 - lift)
    ctx.lineTo(x, top - 50 - lift)
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
  ctx.font = '700 17px "Segoe UI", system-ui, sans-serif'
  const nameWidth = ctx.measureText(label.name).width
  const switchText = label.switch ? `⚡${label.switch.cost} ${label.switch.state === 'on' ? 'ON' : 'OFF'}` : ''
  const switchWidth = label.switch ? ctx.measureText(switchText).width + 20 : 0
  const total = nameWidth + 24 + switchWidth
  const x = label.at.x - total / 2
  const y = label.at.y - 14
  box(ctx, x, y, total, 28, 14)
  ctx.fillStyle = 'rgba(10,14,30,0.8)'
  ctx.fill()
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  let area: Rect | null = null
  if (label.switch) {
    const on = label.switch.state === 'on'
    box(ctx, x + 2, y + 2, switchWidth, 24, 12)
    ctx.fillStyle = on ? '#ffd166' : label.hot ? '#33406e' : '#1c2440'
    ctx.fill()
    ctx.strokeStyle = on ? '#fff0c2' : label.switch.state === 'cannot' ? '#59607c' : '#8f9bd0'
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.fillStyle = on ? '#1c1400' : label.switch.state === 'cannot' ? '#7f87a6' : '#e3e8ff'
    ctx.fillText(switchText, x + 11, y + 15)
    area = { x: x - 4, y: y - 6, w: switchWidth + 10, h: 40 }
  }
  ctx.fillStyle = '#ffffff'
  ctx.fillText(label.name, x + switchWidth + 12, y + 15)
  if (label.note) {
    ctx.font = '600 14px "Segoe UI", system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillStyle = 'rgba(10,14,30,0.8)'
    const noteWidth = ctx.measureText(label.note).width + 16
    box(ctx, label.at.x - noteWidth / 2, y + 30, noteWidth, 20, 10)
    ctx.fill()
    ctx.fillStyle = '#ffe9b0'
    ctx.fillText(label.note, label.at.x, y + 41)
  }
  return area
}
