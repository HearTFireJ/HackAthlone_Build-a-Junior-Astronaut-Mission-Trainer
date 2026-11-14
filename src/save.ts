// Keeps the game in the browser, so closing the tab by accident does not lose it.
// Saved each morning, before the day is played. Nothing leaves the player's computer.

import type { FactId } from './data/facts.ts'
import type { GameState, Plan } from './game/outpost.ts'
import type { Tone } from './scene/script.ts'

/** Change this number whenever the rules or the shape of a saved game change: old saves are then ignored. */
const VERSION = 3
const KEY = 'outpost-save'

export interface SavedGame {
  version: number
  scenarioId: string
  game: GameState
  plan: Plan
  facts: FactId[]
  guideSeen: number
  dayKey: number
  log: { day: number; text: string; tone: Tone }[]
}

export function saveGame(saved: Omit<SavedGame, 'version'>) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ version: VERSION, ...saved }))
  } catch {
    // Private browsing or a full disk: the game simply is not saved.
  }
}

export function clearGame() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // Nothing to clear.
  }
}

/** The saved game, or null if there is none or it does not look like one of ours. */
export function loadGame(): SavedGame | null {
  try {
    const text = localStorage.getItem(KEY)
    if (!text) return null
    const saved = JSON.parse(text) as Partial<SavedGame> | null
    if (!saved || saved.version !== VERSION) return null
    const game = saved.game
    if (!game || game.status !== 'playing' || typeof game.day !== 'number' || !Array.isArray(game.crew)) return null
    if (!saved.plan || !Array.isArray(saved.facts) || !Array.isArray(saved.log) || typeof saved.scenarioId !== 'string') return null
    return saved as SavedGame
  } catch {
    return null
  }
}
