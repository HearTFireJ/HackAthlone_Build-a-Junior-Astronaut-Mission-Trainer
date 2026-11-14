import { useEffect, useRef } from 'react'
import type { GameState, Plan } from '../game/outpost.ts'
import type { PlaceId } from './layout.ts'
import type { Cue } from './script.ts'
import { type Pick, World } from './world.ts'

export type SceneEffect = { key: number; fx: Parameters<World['effect']>[0]; place?: PlaceId }

interface Props {
  game: GameState
  plan: Plan
  /** Goes up by one every morning: everyone is put back in the crew quarters. */
  dayKey: number
  /** The film of the day. Giving a new list starts playing it. */
  script: Cue[] | null
  speed: number
  selected: string | null
  targets: PlaceId[]
  effect: SceneEffect | null
  onPick: (pick: Pick | null) => void
  /** Called when the mouse moves onto something else (or onto nothing). */
  onHover: (pick: Pick | null) => void
  onCue: (cue: Cue) => void
  /** Where the picked astronaut is on the canvas, so a menu can open beside them. */
  onAnchor: (at: Anchor | null) => void
}

/** A point on the canvas, and how big the canvas is, all in screen pixels. */
export interface Anchor {
  x: number
  y: number
  /** The left edge of the crew quarters. */
  roomLeft: number
  width: number
  height: number
}

/**
 * The picture of the base. React only owns the <canvas>; everything inside it is drawn
 * sixty times a second by the World, which is plain TypeScript. That keeps the moving
 * picture fast, and keeps it apart from the rules.
 */
export function Scene({ game, plan, dayKey, script, speed, selected, targets, effect, onPick, onHover, onCue, onAnchor }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)
  // An invisible box laid out by the stylesheet: the part of the picture nothing floats over.
  const safe = useRef<HTMLDivElement>(null)
  const anchorCall = useRef(onAnchor)
  const lastAnchor = useRef('')
  // What the mouse was over last time, as a short word, so the page only hears about changes.
  const lastHover = useRef('')
  const hoverChanged = (pick: Pick | null) => {
    const key = pick ? `${pick.kind}:${pick.kind === 'switch' ? pick.module : pick.id}` : ''
    if (key === lastHover.current) return
    lastHover.current = key
    onHover(pick)
  }
  // The world lives outside React's state: it changes sixty times a second.
  const holder = useRef<World | null>(null)
  const getWorld = () => (holder.current ??= new World())

  // Hand the latest game to the world. The order of these effects matters: the game first.
  useEffect(() => {
    getWorld().setGame(game, plan)
  }, [game, plan])
  useEffect(() => {
    getWorld().startDay()
  }, [dayKey])
  useEffect(() => {
    if (script) getWorld().play(script)
  }, [script])
  useEffect(() => {
    const world = getWorld()
    world.speed = speed
    world.selected = selected
    world.targets = new Set(targets)
    world.onCue = onCue
    anchorCall.current = onAnchor
  })
  useEffect(() => {
    if (effect) getWorld().effect(effect.fx, effect.place)
  }, [effect])

  // The drawing loop.
  useEffect(() => {
    const element = canvas.current
    const ctx = element?.getContext('2d')
    if (!element || !ctx) return
    const world = getWorld()
    let frame = 0
    let last = performance.now()
    const tick = (now: number) => {
      // If the tab was hidden for a while, do not jump ahead: carry on from where we were.
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const width = element.clientWidth
      const height = element.clientHeight
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      if (width > 0 && height > 0) {
        const w = Math.round(width * dpr)
        const h = Math.round(height * dpr)
        if (element.width !== w || element.height !== h) {
          element.width = w
          element.height = h
        }
        world.update(dt)
        const box = safe.current
        world.draw(ctx, width, height, dpr, box ? { x: box.offsetLeft, y: box.offsetTop, w: box.offsetWidth, h: box.offsetHeight } : undefined)
        // Tell the page where the picked astronaut is, but only when that changes.
        const at = world.selected ? world.anchorOf(world.selected) : null
        const key = at ? `${Math.round(at.x)},${Math.round(at.y)},${width},${height}` : ''
        if (key !== lastAnchor.current) {
          lastAnchor.current = key
          anchorCall.current(at ? { ...at, width, height } : null)
        }
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    // A handle for the test scripts (they speed the film up).
    ;(window as unknown as { __world?: World }).__world = world
    return () => cancelAnimationFrame(frame)
  }, [])

  const pickAt = (event: { clientX: number; clientY: number }) => {
    const box = canvas.current?.getBoundingClientRect()
    return box ? getWorld().pick(event.clientX - box.left, event.clientY - box.top) : null
  }

  return (
    <>
    <canvas
      ref={canvas}
      className="scene"
      aria-label="The Moon base, seen from above"
      onPointerMove={(event) => {
        const pick = pickAt(event)
        const world = getWorld()
        world.hover = pick
        hoverChanged(pick)
        const clickable = world.mode === 'plan' && pick !== null
        event.currentTarget.style.cursor = clickable ? 'pointer' : 'default'
      }}
      onPointerLeave={() => {
        getWorld().hover = null
        hoverChanged(null)
      }}
      onClick={(event) => onPick(pickAt(event))}
    />
    <div ref={safe} className="scene-safe" aria-hidden="true" />
    </>
  )
}
