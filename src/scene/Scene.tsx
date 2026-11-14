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
  onCue: (cue: Cue) => void
}

/**
 * The picture of the base. React only owns the <canvas>; everything inside it is drawn
 * sixty times a second by the World, which is plain TypeScript. That keeps the moving
 * picture fast, and keeps it apart from the rules.
 */
export function Scene({ game, plan, dayKey, script, speed, selected, targets, effect, onPick, onCue }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)
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
        world.draw(ctx, width, height, dpr)
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
    <canvas
      ref={canvas}
      className="scene"
      aria-label="The Moon base, seen from above"
      onPointerMove={(event) => {
        const pick = pickAt(event)
        const world = getWorld()
        world.hover = pick
        const clickable = world.mode === 'plan' && pick !== null
        event.currentTarget.style.cursor = clickable ? 'pointer' : 'default'
      }}
      onPointerLeave={() => {
        getWorld().hover = null
      }}
      onClick={(event) => onPick(pickAt(event))}
    />
  )
}
