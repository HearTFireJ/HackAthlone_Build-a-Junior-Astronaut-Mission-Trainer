// The living picture of the base: where everyone is right now, who is walking where,
// the rover, the sparks, the storm. It plays the day's film (see script.ts) and it
// answers "what is under the mouse?".
//
// It knows the rules only well enough to read the game state. It never changes it.

import { JOBS, MISSIONS, MODULES, MODULE_IDS, crewInfo, type ModuleId } from '../game/content.ts'
import { type GameState, type Plan, canRun, jobProblem, missionDone, poweredModules, powerAvailable, powerUsed, solarToday } from '../game/outpost.ts'
import { PAWN_SCALE, colourOf, drawBase, drawLabel, drawNameTags, drawPawn, drawRover, paintGround, tagPoint, tracePlace, type BaseView, type LabelDraw, type NameTag } from './draw.ts'
import {
  PLACES,
  ROAD,
  ROOMS,
  VIEW,
  WORLD,
  placeCentre,
  spotFor,
  walk,
  type Activity,
  type Facing,
  type NodeId,
  type PlaceId,
  type Pt,
  type Rect,
  type Spot,
  type Step,
} from './layout.ts'
import { hudOf, type Cue, type Hud, type Tone } from './script.ts'

type Ctx = CanvasRenderingContext2D

/** What the mouse is pointing at. */
export type Pick = { kind: 'pawn'; id: string } | { kind: 'switch'; module: ModuleId } | { kind: 'place'; id: PlaceId }

interface Actor {
  id: string
  x: number
  y: number
  face: Facing
  steps: Step[]
  speed: number
  spot: Spot
  activity: Activity
  repairAt: ModuleId | 'panels'
  slot: number
  /** The last walking point they passed. */
  at: NodeId
  cameFromOutside: boolean
  suited: boolean
  /** Out with the rover: not drawn. */
  hidden: boolean
  arrived: boolean
  stepPhase: number
  flash: number
  workClock: number
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  age: number
  life: number
  r: number
  colour: string
  gravity: number
  star?: boolean
}

interface FloatText {
  x: number
  y: number
  text: string
  tone: Tone
  age: number
}

interface Planned {
  id: string
  act: Activity
  repairAt: ModuleId | 'panels'
  slot: number
}

const WALK = 175
const RUN = 330
const ROVER_SPEED = 300
const TONE_COLOUR: Record<Tone, string> = { plain: '#ffffff', good: '#8ff0b0', warn: '#ffc46b', bad: '#ff8a98' }

const ROAD_LENGTHS = ROAD.slice(1).map((p, index) => Math.hypot(p.x - ROAD[index].x, p.y - ROAD[index].y))
const ROAD_TOTAL = ROAD_LENGTHS.reduce((sum, length) => sum + length, 0)

function onRoad(dist: number): { x: number; y: number; angle: number } {
  let left = Math.max(0, Math.min(ROAD_TOTAL, dist))
  for (let i = 0; i < ROAD_LENGTHS.length; i++) {
    if (left <= ROAD_LENGTHS[i] || i === ROAD_LENGTHS.length - 1) {
      const a = ROAD[i]
      const b = ROAD[i + 1]
      const along = left / ROAD_LENGTHS[i]
      return { x: a.x + (b.x - a.x) * along, y: a.y + (b.y - a.y) * along, angle: Math.atan2(b.y - a.y, b.x - a.x) }
    }
    left -= ROAD_LENGTHS[i]
  }
  return { ...ROAD[0], angle: 0 }
}

export class World {
  mode: 'plan' | 'play' = 'plan'
  selected: string | null = null
  /** Places that light up as "you can send them here" while someone is picked. */
  targets = new Set<PlaceId>()
  hover: Pick | null = null
  speed = 1
  /** Only the test scripts change this: it makes the film run faster. */
  boost = 1
  paused = false
  /** Called for the cues the page has to know about: captions, the clock, numbers, the alert, the end. */
  onCue: (cue: Cue) => void = () => {}
  view = { scale: 1, ox: 0, oy: 0 }

  private game: GameState | null = null
  private plan: Plan | null = null
  private actors = new Map<string, Actor>()
  private rover = { dist: 0, state: 'parked' as 'parked' | 'leaving' | 'gone' | 'returning', rider: null as string | null, then: 'idle' as Activity, hurry: false }
  private particles: Particle[] = []
  private floats: FloatText[] = []
  private cues: Cue[] = []
  private clock = 0
  private time = 0
  private storm: { left: number; total: number; severe: boolean } | null = null
  private streaks: { x: number; y: number; length: number; speed: number }[] = []
  private flare = 0
  private shake = 0
  private wilt = 0
  private wiltGoal = 0
  private hud: Hud | null = null
  private switchAreas: { module: ModuleId; area: Rect }[] = []
  private ground: HTMLCanvasElement | null = null
  private groundKey = ''
  private ambient = 0

  // ---------------------------------------------------------------- what the page tells the world

  /** Gives the world the latest game and plan. Called on every change. */
  setGame(game: GameState, plan: Plan) {
    if (game !== this.game) {
      this.hud = hudOf(game)
      for (const id of [...this.actors.keys()]) if (!game.crew.some((a) => a.id === id)) this.actors.delete(id)
    }
    this.game = game
    this.plan = plan
    for (const astronaut of game.crew) if (!this.actors.has(astronaut.id)) this.actors.set(astronaut.id, this.newActor(astronaut.id))
  }

  /** A new morning: everyone at home is standing in the crew quarters, ready for orders. */
  startDay() {
    const game = this.game
    if (!game) return
    this.mode = 'plan'
    this.cues = []
    this.paused = false
    this.storm = null
    this.wilt = 0
    this.wiltGoal = 0
    this.hud = hudOf(game)
    const anyoneAway = game.crew.some((a) => a.away)
    this.rover = { dist: anyoneAway ? ROAD_TOTAL : 0, state: anyoneAway ? 'gone' : 'parked', rider: null, then: 'idle', hurry: false }
    let place = 0
    for (const astronaut of game.crew) {
      const actor = this.actors.get(astronaut.id)
      if (!actor) continue
      actor.hidden = !!astronaut.away
      actor.steps = []
      actor.flash = 0
      if (astronaut.away) continue
      const home = spotFor('idle', place++)
      actor.activity = 'idle'
      actor.slot = place - 1
      actor.spot = home
      actor.x = home.x
      actor.y = home.y
      actor.face = home.face
      actor.at = 'hab'
      actor.suited = false
      actor.arrived = true
      actor.stepPhase = 0
    }
  }

  /** Starts playing a film of the day (or the next part of it). */
  play(cues: Cue[]) {
    this.mode = 'play'
    this.cues = [...cues].sort((a, b) => a.t - b.t)
    this.clock = 0
    this.paused = false
  }

  get playing(): boolean {
    return this.mode === 'play' && this.cues.length > 0
  }

  private newActor(id: string): Actor {
    const home = spotFor('idle', this.actors.size)
    return {
      id,
      x: home.x,
      y: home.y,
      face: home.face,
      steps: [],
      speed: WALK,
      spot: home,
      activity: 'idle',
      repairAt: 'panels',
      slot: this.actors.size,
      at: 'hab',
      cameFromOutside: false,
      suited: false,
      hidden: false,
      arrived: true,
      stepPhase: 0,
      flash: 0,
      workClock: 0,
    }
  }

  // ---------------------------------------------------------------- time passes

  update(dt: number) {
    this.time += dt
    this.flare = Math.max(0, this.flare - dt)
    this.shake = Math.max(0, this.shake - dt * 1.6)
    if (this.paused) return
    const step = this.mode === 'play' ? dt * this.speed * this.boost : dt

    if (this.mode === 'play') {
      this.clock += step
      while (this.cues.length > 0 && this.cues[0].t <= this.clock) {
        const cue = this.cues.shift()!
        this.run(cue)
        if (this.paused) break
      }
    }

    for (const actor of this.actors.values()) this.moveActor(actor, step)
    this.moveRover(step)
    this.wilt += (this.wiltGoal - this.wilt) * Math.min(1, step * 2)

    if (this.storm) {
      this.storm.left -= step
      if (this.storm.left <= 0) this.storm = null
    }
    this.emitAmbient(step)

    for (const p of this.particles) {
      p.age += step
      p.vy += p.gravity * step
      p.x += p.vx * step
      p.y += p.vy * step
    }
    this.particles = this.particles.filter((p) => p.age < p.life)
    for (const f of this.floats) f.age += step
    this.floats = this.floats.filter((f) => f.age < 2.4)
  }

  private moveActor(actor: Actor, step: number) {
    actor.flash = Math.max(0, actor.flash - step)
    if (actor.hidden) return
    if (actor.steps.length === 0) {
      if (this.mode === 'play' && actor.arrived) this.work(actor, step)
      return
    }
    let budget = actor.speed * step
    actor.stepPhase += step * (actor.speed / WALK) * 11
    while (budget > 0 && actor.steps.length > 0) {
      const target = actor.steps[0]
      const dx = target.x - actor.x
      const dy = target.y - actor.y
      const distance = Math.hypot(dx, dy)
      actor.suited = target.out || actor.cameFromOutside
      if (distance > 0.5) actor.face = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up'
      if (distance <= budget) {
        actor.x = target.x
        actor.y = target.y
        budget -= distance
        actor.cameFromOutside = target.out
        if (target.node) actor.at = target.node
        actor.steps.shift()
      } else {
        actor.x += (dx / distance) * budget
        actor.y += (dy / distance) * budget
        budget = 0
      }
    }
    if (actor.steps.length === 0) {
      actor.arrived = true
      actor.stepPhase = 0
      actor.face = actor.spot.face
      actor.at = actor.spot.node
      actor.suited = actor.spot.out
      actor.cameFromOutside = actor.spot.out
      actor.workClock = 0
      if (actor.activity === 'board') {
        actor.hidden = true
        this.rover.state = 'leaving'
        this.rover.rider = actor.id
      }
    }
  }

  /** Sparks, water drops and little signs that show someone is busy. */
  private work(actor: Actor, step: number) {
    const before = actor.workClock
    actor.workClock += step
    const every = (seconds: number) => Math.floor(before / seconds) !== Math.floor(actor.workClock / seconds)
    const at = actor.spot.work ?? { x: actor.x, y: actor.y - 30 }
    switch (actor.activity) {
      case 'garden':
        if (every(0.1)) {
          this.particles.push({ x: actor.x + (at.x - actor.x) * 0.3 + rand(-4, 4), y: actor.y - 20 + (at.y - actor.y) * 0.3, vx: (at.x - actor.x) * 0.8 + rand(-14, 14), vy: (at.y - actor.y + 20) * 0.9 - 10, age: 0, life: 0.55, r: 2.2, colour: '#8fd8ff', gravity: 60 })
        }
        break
      case 'lab':
        if (every(0.28)) {
          this.particles.push({ x: at.x + rand(-8, 8), y: at.y - 6, vx: rand(-6, 6), vy: -24, age: 0, life: 1.1, r: rand(2, 4), colour: pick(['#8cf0c0', '#b79cff', '#6cb8ff']), gravity: 0 })
        }
        break
      case 'build':
      case 'repair':
        if (every(0.32)) {
          for (let i = 0; i < 6; i++) {
            this.particles.push({ x: at.x, y: at.y, vx: rand(-90, 90), vy: rand(-110, 20), age: 0, life: rand(0.2, 0.45), r: 1.8, colour: pick(['#fff3b0', '#ffd166', '#ffffff']), gravity: 260 })
          }
        }
        break
      case 'rest':
        if (every(1.3)) this.floats.push({ x: actor.x + 12, y: actor.y - 30, text: 'z', tone: 'plain', age: 1.1 })
        break
      case 'sickbay':
        if (every(1.5)) this.floats.push({ x: actor.x, y: actor.y - 26, text: '✚', tone: 'good', age: 1.1 })
        break
      case 'call':
        if (every(1.2)) this.floats.push({ x: at.x + 8, y: at.y - 18, text: pick(['♥', '🌍', '♥']), tone: 'bad', age: 1.1 })
        break
      default:
        break
    }
  }

  private moveRover(step: number) {
    const rover = this.rover
    if (rover.state === 'leaving') {
      rover.dist += ROVER_SPEED * step
      if (rover.dist >= ROAD_TOTAL) rover.state = 'gone'
    } else if (rover.state === 'returning') {
      rover.dist -= ROVER_SPEED * step
      if (rover.dist <= 0) {
        rover.dist = 0
        rover.state = 'parked'
        const rider = rover.rider ? this.actors.get(rover.rider) : null
        rover.rider = null
        if (rider) {
          const door = spotFor('board', 0)
          rider.hidden = false
          rider.x = door.x
          rider.y = door.y
          rider.at = 'garage'
          rider.steps = []
          rider.arrived = true
          rider.suited = false
          rider.cameFromOutside = false
          rider.activity = 'board'
          this.send(rider, rover.then, 'panels', rover.hurry)
        }
      }
    }
    if ((rover.state === 'leaving' || rover.state === 'returning') && Math.random() < step * 30) {
      const p = onRoad(rover.dist)
      if (p.x > ROOMS.garage.x + ROOMS.garage.w) {
        this.particles.push({ x: p.x + rand(-10, 10), y: p.y + rand(-6, 14), vx: rand(-20, 20), vy: rand(-26, -6), age: 0, life: 0.9, r: rand(3, 7), colour: 'rgba(200,196,188,0.5)', gravity: 0 })
      }
    }
  }

  private emitAmbient(step: number) {
    const game = this.game
    const plan = this.plan
    if (!game || !plan) return
    const before = this.ambient
    this.ambient += step
    const every = (seconds: number) => Math.floor(before / seconds) !== Math.floor(this.ambient / seconds)
    const on = poweredModules(game, plan)
    if (on.includes('life') && every(0.22)) {
      // Fresh air flowing down the corridor to the crew quarters.
      this.particles.push({ x: 436, y: 450 + rand(-6, 6), vx: rand(80, 120), vy: rand(-4, 4), age: 0, life: 2.3, r: rand(2, 4), colour: 'rgba(190,235,255,0.55)', gravity: 0 })
    }
    for (const module of game.broken) {
      if (every(0.18)) {
        const p = placeCentre(module)
        this.particles.push({ x: p.x + rand(-14, 14), y: p.y - 20, vx: rand(-8, 8), vy: rand(-34, -18), age: 0, life: 1.4, r: rand(5, 10), colour: 'rgba(40,42,52,0.45)', gravity: 0 })
      }
    }
  }

  // ---------------------------------------------------------------- the film

  private run(cue: Cue) {
    switch (cue.kind) {
      case 'go': {
        const actor = this.actors.get(cue.who)
        if (actor && !actor.hidden) this.send(actor, cue.act, cue.repairAt ?? 'panels', cue.hurry === true)
        break
      }
      case 'rover-in': {
        const actor = this.actors.get(cue.who)
        if (!actor) break
        if (!actor.hidden) {
          // Had not left yet: just walk.
          this.send(actor, cue.act, 'panels', cue.hurry === true)
          break
        }
        this.rover.state = 'returning'
        this.rover.rider = cue.who
        this.rover.then = cue.act
        this.rover.hurry = cue.hurry === true
        break
      }
      case 'float': {
        if (typeof cue.at === 'string') {
          const p = placeCentre(cue.at)
          this.float(p.x, p.y - 30, cue.text, cue.tone)
        } else {
          const actor = this.actors.get(cue.at.who)
          if (!actor) break
          if (actor.hidden) this.float(1470, 800, `${crewInfo(actor.id).name}: ${cue.text}`, cue.tone)
          else this.float(actor.x, actor.y - 62 * PAWN_SCALE - 22, cue.text, cue.tone)
        }
        break
      }
      case 'hit': {
        const actor = this.actors.get(cue.who)
        if (actor) actor.flash = 1.2
        break
      }
      case 'flare':
        this.flare = 1.6
        break
      case 'storm':
        this.storm = { left: cue.seconds, total: cue.seconds, severe: cue.severe }
        this.streaks = Array.from({ length: cue.severe ? 220 : 150 }, () => ({ x: Math.random(), y: Math.random(), length: rand(30, 90), speed: rand(0.7, 1.3) }))
        break
      case 'fx':
        this.effect(cue.fx, cue.place)
        break
      case 'hud':
        if (this.hud) this.hud = { ...this.hud, ...cue.patch }
        this.onCue(cue)
        break
      case 'alert':
        this.paused = true
        this.onCue(cue)
        break
      default:
        this.onCue(cue)
    }
  }

  /** Something to see when an event happens. */
  effect(fx: 'wilt' | 'celebrate' | 'shake' | 'smoke' | 'dust' | 'confetti' | 'lander', place?: PlaceId) {
    const p = placeCentre(place ?? 'habitat')
    switch (fx) {
      case 'wilt':
        this.wiltGoal = 1
        break
      case 'shake':
        this.shake = 1
        break
      case 'celebrate':
        for (let i = 0; i < 46; i++) {
          const angle = Math.random() * Math.PI * 2
          const speed = rand(60, 240)
          this.particles.push({ x: p.x, y: p.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 60, age: 0, life: rand(0.8, 1.6), r: rand(4, 8), colour: pick(['#ffd166', '#fff3b0', '#8ff0b0', '#b79cff']), gravity: 160, star: true })
        }
        break
      case 'confetti':
        for (let i = 0; i < 60; i++) {
          this.particles.push({ x: p.x + rand(-70, 70), y: p.y + rand(-70, 20), vx: rand(-40, 40), vy: rand(-120, -20), age: 0, life: rand(1.2, 2.2), r: rand(3, 5), colour: pick(['#ff7b8a', '#ffd166', '#6cb8ff', '#8ff0b0', '#d58cff']), gravity: 140 })
        }
        break
      case 'smoke':
        this.shake = Math.max(this.shake, 0.7)
        for (let i = 0; i < 40; i++) {
          this.particles.push({ x: p.x + rand(-30, 30), y: p.y + rand(-20, 20), vx: rand(-40, 40), vy: rand(-80, -20), age: 0, life: rand(1, 2.4), r: rand(6, 16), colour: 'rgba(60,62,74,0.5)', gravity: 0 })
        }
        for (let i = 0; i < 24; i++) {
          this.particles.push({ x: p.x, y: p.y, vx: rand(-220, 220), vy: rand(-220, 120), age: 0, life: rand(0.3, 0.7), r: 2.4, colour: pick(['#fff3b0', '#ffb454', '#ffffff']), gravity: 300 })
        }
        break
      case 'dust':
        for (let i = 0; i < 90; i++) {
          this.particles.push({ x: p.x + rand(-260, 260), y: p.y + rand(-70, 90), vx: rand(20, 90), vy: rand(-12, 12), age: -rand(0, 0.8), life: rand(1.6, 3), r: rand(8, 22), colour: 'rgba(196,186,166,0.32)', gravity: 0 })
        }
        break
      case 'lander':
        for (let i = 0; i < 50; i++) {
          this.particles.push({ x: 1090 + rand(-30, 30), y: 250 + rand(-10, 20), vx: rand(-120, 120), vy: rand(-10, 60), age: -rand(0, 0.5), life: rand(0.8, 1.8), r: rand(6, 14), colour: 'rgba(210,206,198,0.45)', gravity: 0 })
        }
        break
    }
  }

  private float(x: number, y: number, text: string, tone: Tone) {
    // Two signs over the same head do not sit on top of each other.
    let lift = 0
    for (const other of this.floats) if (Math.abs(other.x - x) < 60 && Math.abs(other.y - y) < 12 && other.age < 1) lift += 24
    this.floats.push({ x, y: y - lift, text, tone, age: 0 })
  }

  private send(actor: Actor, act: Activity, repairAt: ModuleId | 'panels', hurry: boolean) {
    if (actor.activity === act && actor.repairAt === repairAt && actor.steps.length === 0 && actor.arrived && act !== 'board') return
    const taken = new Set<number>()
    for (const other of this.actors.values()) {
      if (other !== actor && !other.hidden && other.activity === act && (act !== 'repair' || other.repairAt === repairAt)) taken.add(other.slot)
    }
    let slot = 0
    while (taken.has(slot)) slot++
    const to = spotFor(act, slot, repairAt)
    const heading = actor.steps[0]?.node ?? null
    actor.steps = walk(actor.at, to, actor.steps.length > 0 ? heading : null)
    actor.activity = act
    actor.repairAt = repairAt
    actor.slot = slot
    actor.spot = to
    actor.arrived = false
    actor.speed = hurry ? RUN : WALK
  }

  // ---------------------------------------------------------------- the plan, as the picture sees it

  /** What everyone at the base is set to do today, with the spot they will stand on. */
  private planned(): Planned[] {
    const game = this.game
    const plan = this.plan
    if (!game || !plan) return []
    const counts = new Map<string, number>()
    const broken = [...game.broken]
    const list: Planned[] = []
    for (const astronaut of game.crew) {
      if (astronaut.away) continue
      let job = plan.jobs[astronaut.id] ?? { kind: 'rest' as const }
      if (jobProblem(game, plan, astronaut.id, job)) job = { kind: astronaut.health <= 1 ? 'sickbay' : 'rest' }
      const act: Activity = job.kind === 'trip' ? 'board' : job.kind
      const repairAt = act === 'repair' ? (broken.shift() ?? 'panels') : 'panels'
      const key = act === 'repair' ? `repair-${repairAt}` : act
      const slot = counts.get(key) ?? 0
      counts.set(key, slot + 1)
      list.push({ id: astronaut.id, act, repairAt, slot })
    }
    return list
  }

  private baseView(): BaseView {
    const game = this.game!
    const plan = this.plan!
    const hud = this.hud ?? hudOf(game)
    const on = poweredModules(game, plan)
    return {
      on: new Set(on),
      broken: new Set(game.broken),
      blocked: new Set(MODULE_IDS.filter((module) => !canRun(game, module))),
      panels: game.solar,
      panelsDead: this.mode === 'play' ? hud.panelsDead : game.solar - solarToday(game),
      dish: hud.missions.dish / MISSIONS.dish.goal,
      shield: missionDone(hud.missions, 'shield'),
      ice: missionDone(hud.missions, 'ice'),
      wilt: this.wilt,
      lush: Math.max(0.25, Math.min(1, hud.food / 12)),
    }
  }

  private labels(): LabelDraw[] {
    const game = this.game!
    const plan = this.plan!
    const on = poweredModules(game, plan)
    const spare = powerAvailable(game) - powerUsed(game, plan)
    const hud = this.hud ?? hudOf(game)
    return PLACES.map((place) => {
      const label: LabelDraw = { id: place.id, name: place.name, at: place.label }
      if (place.module) {
        const module = place.module
        const running = on.includes(module)
        const cannot = !canRun(game, module) || (!running && MODULES[module].power > spare)
        label.switch = { cost: MODULES[module].power, state: running ? 'on' : cannot ? 'cannot' : 'off' }
        label.hot = this.hover?.kind === 'switch' && this.hover.module === module
        if (game.broken.includes(module)) label.note = 'Broken: needs a repair'
        else if (!canRun(game, module)) label.note = 'Cannot run today'
        else if (!running && MODULES[module].power > spare && this.mode === 'plan') label.note = 'Not enough power left'
      }
      if (place.id === 'panels') label.note = `⚡ ${solarToday(game)} power today${game.battery > 0 ? ` + 🔋 ${game.battery} saved` : ''}`
      if (place.id === 'site') label.note = missionDone(hud.missions, 'dish') ? 'Listening to space!' : `${Math.min(hud.missions.dish, MISSIONS.dish.goal)} of ${MISSIONS.dish.goal} built`
      if (place.id === 'shelter' && missionDone(hud.missions, 'shield')) label.note = 'Moon-soil shield built'
      return label
    })
  }

  // ---------------------------------------------------------------- pointing

  toWorld(x: number, y: number): Pt {
    return { x: (x - this.view.ox) / this.view.scale, y: (y - this.view.oy) / this.view.scale }
  }
  toScreen(p: Pt): Pt {
    return { x: p.x * this.view.scale + this.view.ox, y: p.y * this.view.scale + this.view.oy }
  }

  /** What is under this point of the canvas (in screen pixels)? */
  pick(x: number, y: number): Pick | null {
    const p = this.toWorld(x, y)
    // How far the point is from the middle of a figure, or null if it is not on the figure.
    const reach = (at: Pt, lying: boolean): number | null => {
      const middle = lying ? at : { x: at.x, y: at.y - 30 * PAWN_SCALE }
      const dx = Math.abs(p.x - middle.x)
      const dy = Math.abs(p.y - middle.y)
      const inside = lying ? dx < 30 * PAWN_SCALE && dy < 30 * PAWN_SCALE : dx < 22 * PAWN_SCALE && dy < 40 * PAWN_SCALE
      return inside ? Math.hypot(dx, dy) : null
    }
    if (this.mode === 'plan') {
      // When figures overlap, the click goes to the one whose middle is nearest.
      let best: { id: string; far: number } | null = null
      const offer = (id: string, far: number | null) => {
        if (far !== null && (!best || far < best.far)) best = { id, far }
      }
      for (const actor of this.actors.values()) if (!actor.hidden) offer(actor.id, reach(actor, false))
      for (const planned of this.planned()) {
        if (planned.act === 'idle' || planned.act === 'rest') continue
        const at = spotFor(planned.act, planned.slot, planned.repairAt)
        offer(planned.id, reach(at, !!at.lie))
      }
      if (best) return { kind: 'pawn', id: (best as { id: string }).id }
      for (const { module, area } of this.switchAreas) {
        if (p.x >= area.x && p.x <= area.x + area.w && p.y >= area.y && p.y <= area.y + area.h) return { kind: 'switch', module }
      }
    }
    for (const place of PLACES) if (place.contains(p)) return { kind: 'place', id: place.id }
    return null
  }

  // ---------------------------------------------------------------- painting

  draw(ctx: Ctx, width: number, height: number, dpr: number) {
    if (!this.game || !this.plan) return
    // Fit the whole base into the window, with a little room around it.
    const scale = Math.min(width / VIEW.w, height / VIEW.h)
    const ox = (width - VIEW.w * scale) / 2 - VIEW.x * scale
    const oy = (height - VIEW.h * scale) / 2 - VIEW.y * scale
    this.view = { scale, ox, oy }

    const key = `${Math.round(width * dpr)}x${Math.round(height * dpr)}`
    if (!this.ground || this.groundKey !== key) {
      this.ground = document.createElement('canvas')
      this.ground.width = Math.round(width * dpr)
      this.ground.height = Math.round(height * dpr)
      const g = this.ground.getContext('2d')!
      g.scale(dpr, dpr)
      paintGround(g, width, height, scale, ox, oy)
      this.groundKey = key
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.drawImage(this.ground, 0, 0, width, height)
    this.sunlight(ctx, width, height)

    ctx.save()
    const shakeX = this.shake > 0 ? Math.sin(this.time * 70) * this.shake * 6 : 0
    const shakeY = this.shake > 0 ? Math.cos(this.time * 83) * this.shake * 5 : 0
    ctx.translate(ox + shakeX, oy + shakeY)
    ctx.scale(scale, scale)

    drawBase(ctx, this.baseView(), this.time)

    // Places that can be clicked right now.
    if (this.mode === 'plan') {
      const pulse = 0.55 + Math.sin(this.time * 5) * 0.35
      for (const id of this.targets) {
        tracePlace(ctx, id, 9)
        ctx.fillStyle = 'rgba(108,184,255,0.1)'
        ctx.fill()
        ctx.strokeStyle = `rgba(108,184,255,${pulse})`
        ctx.lineWidth = 5
        ctx.setLineDash([14, 9])
        ctx.stroke()
        ctx.setLineDash([])
      }
    }
    if (this.hover?.kind === 'place') {
      tracePlace(ctx, this.hover.id, 6)
      ctx.strokeStyle = 'rgba(255,255,255,0.75)'
      ctx.lineWidth = 3
      ctx.stroke()
    }

    // While the storm is on, the shelter's thick roof glows: it is stopping the particles.
    if (this.storm) {
      const s = ROOMS.shelter
      ctx.strokeStyle = `rgba(95,211,141,${0.5 + Math.sin(this.time * 9) * 0.3})`
      ctx.lineWidth = 6
      ctx.beginPath()
      ctx.roundRect(s.x - 30, s.y - 28, s.w + 60, s.h + 56, 50)
      ctx.stroke()
    }

    // Everyone and the rover, from the back of the picture to the front.
    const things: { y: number; paint: () => void }[] = []
    const tags: NameTag[] = []
    const hoverId = this.hover?.kind === 'pawn' ? this.hover.id : null
    if (this.mode === 'plan') {
      for (const planned of this.planned()) {
        // Resting is what everyone does unless told otherwise: no shadow figure for that.
        if (planned.act === 'idle' || planned.act === 'rest') continue
        const at = spotFor(planned.act, planned.slot, planned.repairAt)
        things.push({
          y: at.y - 1,
          paint: () => drawPawn(ctx, { id: planned.id, x: at.x, y: at.y, face: at.face, step: 0, suited: at.out, lie: at.lie, alpha: 0.5, hover: hoverId === planned.id }, this.time),
        })
        tags.push({ text: crewInfo(planned.id).name, colour: colourOf(planned.id), ...tagPoint({ x: at.x, y: at.y, lie: at.lie }), faint: true })
      }
    }
    for (const actor of this.actors.values()) {
      if (actor.hidden) continue
      const lying = actor.arrived && actor.steps.length === 0 ? actor.spot.lie : undefined
      things.push({
        y: actor.y,
        paint: () =>
          drawPawn(
            ctx,
            {
              id: actor.id,
              x: actor.x,
              y: actor.y,
              face: actor.face,
              step: actor.steps.length > 0 ? actor.stepPhase + 0.01 : 0,
              suited: actor.suited,
              lie: lying,
              flash: actor.flash,
              selected: this.mode === 'plan' && this.selected === actor.id,
              hover: hoverId === actor.id,
            },
            this.time,
          ),
      })
      tags.push({ text: crewInfo(actor.id).name, colour: colourOf(actor.id), ...tagPoint({ x: actor.x, y: actor.y, lie: lying }), faint: false })
    }
    if (this.rover.state !== 'gone') {
      const p = onRoad(this.rover.dist)
      const moving = this.rover.state === 'leaving' || this.rover.state === 'returning'
      things.push({ y: p.y + 6, paint: () => drawRover(ctx, p.x, p.y, this.rover.state === 'returning' ? p.angle + Math.PI : p.angle, moving, this.time) })
    }
    things.sort((a, b) => a.y - b.y)
    for (const thing of things) thing.paint()
    drawNameTags(ctx, tags)

    for (const p of this.particles) {
      if (p.age < 0) continue
      const fade = 1 - p.age / p.life
      ctx.globalAlpha = Math.max(0, Math.min(1, fade * 1.4))
      ctx.fillStyle = p.colour
      if (p.star) {
        ctx.font = `${Math.round(p.r * 3)}px "Segoe UI", sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('★', p.x, p.y)
      } else {
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    ctx.globalAlpha = 1

    // Name cards and switches.
    this.switchAreas = []
    for (const label of this.labels()) {
      const area = drawLabel(ctx, label)
      if (area && label.switch && PLACES.find((place) => place.id === label.id)?.module) {
        this.switchAreas.push({ module: PLACES.find((place) => place.id === label.id)!.module!, area })
      }
    }

    // Who is out with the rover.
    const game = this.game
    let row = 0
    for (const actor of this.actors.values()) {
      if (!actor.hidden || this.rover.state !== 'gone') continue
      const away = game.crew.find((a) => a.id === actor.id)?.away
      const text = `🚙 ${crewInfo(actor.id).name}${this.mode === 'plan' && away ? `: back in ${away.daysLeft} day${away.daysLeft === 1 ? '' : 's'}` : ' is out with the rover'}`
      ctx.font = '700 16px "Segoe UI", system-ui, sans-serif'
      const w = ctx.measureText(text).width + 22
      const x = WORLD.w - 18 - w
      const y = 728 - row * 30
      ctx.beginPath()
      ctx.roundRect(x, y - 13, w, 26, 13)
      ctx.fillStyle = 'rgba(10,14,30,0.82)'
      ctx.fill()
      ctx.strokeStyle = colourOf(actor.id)
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.fillStyle = '#fff'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillText(text, x + 11, y + 1)
      row++
    }

    // Signs that float up: "+2 🥕", "−1 ♥".
    for (const f of this.floats) {
      const alpha = f.age < 1.7 ? 1 : Math.max(0, 1 - (f.age - 1.7) / 0.7)
      ctx.globalAlpha = alpha
      ctx.font = '800 22px "Segoe UI", system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const y = f.y - f.age * 22
      ctx.lineWidth = 5
      ctx.lineJoin = 'round'
      ctx.strokeStyle = 'rgba(8,10,24,0.9)'
      ctx.strokeText(f.text, f.x, y)
      ctx.fillStyle = TONE_COLOUR[f.tone]
      ctx.fillText(f.text, f.x, y)
    }
    ctx.globalAlpha = 1
    ctx.restore()

    this.stormLayer(ctx, width, height)
  }

  /** The Sun sits just off the top left corner. A flare makes it blaze for a moment. */
  private sunlight(ctx: Ctx, width: number, height: number) {
    const reach = Math.max(width, height) * 0.62
    const boost = this.flare > 0 ? Math.min(1, this.flare) : 0
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, reach)
    glow.addColorStop(0, `rgba(255,244,205,${0.5 + boost * 0.4})`)
    glow.addColorStop(0.35, `rgba(255,236,190,${0.16 + boost * 0.3})`)
    glow.addColorStop(1, 'rgba(255,236,190,0)')
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, width, height)
    if (boost > 0) {
      const ring = (1.6 - this.flare) / 1.6
      ctx.strokeStyle = `rgba(255,250,220,${0.8 * (1 - ring)})`
      ctx.lineWidth = 10
      ctx.beginPath()
      ctx.arc(0, 0, ring * reach, 0, Math.PI / 2)
      ctx.stroke()
    }
  }

  /**
   * The storm: a rain of fast particles from the Sun's side. Real storm particles are
   * far too small to see. The game draws them so the player can watch the storm arrive.
   */
  private stormLayer(ctx: Ctx, width: number, height: number) {
    const storm = this.storm
    if (!storm) return
    const strength = Math.max(0, Math.min(1, (storm.total - storm.left) / 0.7, storm.left / 0.9))
    ctx.fillStyle = `rgba(${storm.severe ? '255,40,90' : '255,90,150'},${0.13 * strength + Math.sin(this.time * 14) * 0.02})`
    ctx.fillRect(0, 0, width, height)
    const span = width + height * 0.6
    ctx.lineCap = 'round'
    for (const [index, streak] of this.streaks.entries()) {
      const travel = (streak.x + this.time * 0.9 * streak.speed) % 1
      // Each streak runs from the top left to the bottom right.
      const startX = -height * 0.6 + streak.y * span
      const x = startX + travel * 0.6 * (height + 120)
      const y = travel * (height + 120) - 60
      ctx.strokeStyle = index % 3 === 0 ? `rgba(255,214,150,${0.75 * strength})` : `rgba(255,130,200,${0.7 * strength})`
      ctx.lineWidth = index % 5 === 0 ? 3 : 2
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x - streak.length * 0.6, y - streak.length)
      ctx.stroke()
    }
  }
}

function rand(low: number, high: number): number {
  return low + Math.random() * (high - low)
}
function pick<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)]
}

/** Which place a job is done at, for clicking a place to hand out a job. */
export function placeOfJob(job: keyof typeof JOBS): PlaceId {
  switch (job) {
    case 'garden':
      return 'farm'
    case 'lab':
      return 'lab'
    case 'build':
      return 'site'
    case 'repair':
      return 'panels'
    case 'trip':
      return 'garage'
    default:
      return 'habitat'
  }
}
