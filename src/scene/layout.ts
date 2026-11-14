// Where everything stands in the picture of the base.
// All numbers are positions in the drawing, in "world units": the picture is 1600 wide
// and 900 high, and it is scaled to fit the window. Nothing here changes the rules.

import type { ModuleId } from '../game/content.ts'

export const WORLD = { w: 1600, h: 900 }
/** The part of the picture that must always be in view. */
export const VIEW = { x: 205, y: 52, w: 1250, h: 866 }

export interface Pt {
  x: number
  y: number
}
export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** Every part of the base that can be pointed at. */
export type PlaceId = 'habitat' | 'farm' | 'life' | 'lab' | 'garage' | 'panels' | 'site' | 'comms' | 'scope'

export const HAB = { x: 800, y: 450, r: 125 }
export const ROOMS = {
  life: { x: 290, y: 380, w: 180, h: 140 },
  farm: { x: 1075, y: 370, w: 260, h: 160 },
  lab: { x: 430, y: 645, w: 200, h: 135 },
  garage: { x: 745, y: 668, w: 205, h: 137 },
} as const satisfies Record<string, Rect>
export type RoomId = keyof typeof ROOMS

export const PANELS = { x: 722, y: 108, w: 48, h: 86, gap: 10 }
export const DISH = { x: 300, y: 195, r: 62 }
export const SCOPE = { x: 1295, y: 190, r: 56 }
export const SITE = { x: 1250, y: 690, r: 98 }

/** Tubes people walk through between the rooms, as pairs of points. */
export const CORRIDORS: [Pt, Pt][] = [
  [{ x: 470, y: 450 }, { x: 680, y: 450 }],
  [{ x: 920, y: 450 }, { x: 1075, y: 450 }],
  [{ x: 716, y: 534 }, { x: 618, y: 650 }],
  [{ x: 800, y: 570 }, { x: 800, y: 668 }],
]

/** The rover's way out of the base. It ends far off the right edge of the picture. */
export const ROAD: Pt[] = [
  { x: 890, y: 740 },
  { x: 1000, y: 740 },
  { x: 1070, y: 815 },
  { x: 1140, y: 850 },
  { x: 1720, y: 850 },
]

// ---------------------------------------------------------------- walking

// The points people walk between. "out" means out on the surface: a spacesuit is needed.
const NODES = {
  hab: { x: 800, y: 450 },
  habN: { x: 800, y: 338 },
  n1: { x: 800, y: 250, out: true },
  nw1: { x: 690, y: 128, out: true },
  dishPad: { x: 432, y: 132, out: true },
  scopePad: { x: 1215, y: 255, out: true },
  habE: { x: 915, y: 450 },
  farmDoor: { x: 1085, y: 450 },
  farm: { x: 1120, y: 450 },
  habW: { x: 685, y: 450 },
  lifeDoor: { x: 462, y: 450 },
  life: { x: 425, y: 455 },
  habSW: { x: 718, y: 532 },
  labDoor: { x: 618, y: 652 },
  lab: { x: 585, y: 695 },
  habS: { x: 800, y: 562 },
  garDoor: { x: 800, y: 676 },
  garage: { x: 800, y: 730 },
  habSE: { x: 882, y: 532 },
  se1: { x: 1010, y: 640, out: true },
  siteGate: { x: 1128, y: 700, out: true },
} as const satisfies Record<string, Pt & { out?: boolean }>
export type NodeId = keyof typeof NODES

const EDGES: [NodeId, NodeId][] = [
  ['hab', 'habN'], ['habN', 'n1'], ['n1', 'nw1'], ['nw1', 'dishPad'], ['n1', 'scopePad'],
  ['hab', 'habE'], ['habE', 'farmDoor'], ['farmDoor', 'farm'],
  ['hab', 'habW'], ['habW', 'lifeDoor'], ['lifeDoor', 'life'],
  ['hab', 'habSW'], ['habSW', 'labDoor'], ['labDoor', 'lab'],
  ['hab', 'habS'], ['habS', 'garDoor'], ['garDoor', 'garage'],
  ['hab', 'habSE'], ['habSE', 'se1'], ['se1', 'siteGate'],
]

/** One step of a walk: where to, and whether that stretch is out on the surface. */
export interface Step extends Pt {
  out: boolean
  /** The walking point this step ends on, if it ends on one. */
  node?: NodeId
}

function nodeStep(id: NodeId): Step {
  const node: Pt & { out?: boolean } = NODES[id]
  return { x: node.x, y: node.y, out: node.out === true, node: id }
}

/** The shortest way from one walking point to another (the map is tiny, so a simple search). */
function nodePath(from: NodeId, to: NodeId): NodeId[] {
  if (from === to) return [from]
  const cameFrom = new Map<NodeId, NodeId>()
  const queue: NodeId[] = [from]
  while (queue.length > 0) {
    const here = queue.shift()!
    for (const [a, b] of EDGES) {
      const next = a === here ? b : b === here ? a : null
      if (!next || next === from || cameFrom.has(next)) continue
      cameFrom.set(next, here)
      if (next === to) {
        const path: NodeId[] = [to]
        while (path[0] !== from) path.unshift(cameFrom.get(path[0])!)
        return path
      }
      queue.push(next)
    }
  }
  return [from, to]
}

// ---------------------------------------------------------------- where people stand

/** What an astronaut is doing on the spot where they stand. */
export type Activity = 'idle' | 'garden' | 'lab' | 'build' | 'repair' | 'rest' | 'sickbay' | 'call' | 'board'

export type Facing = 'up' | 'down' | 'left' | 'right'

export interface Spot extends Pt {
  /** The walking point this spot hangs off. */
  node: NodeId
  out: boolean
  face: Facing
  /** Lying on a bed: 'v' head at the top, 'h' head at the left. */
  lie?: 'v' | 'h'
  /** Where the thing they are working on is, for sparks and water drops. */
  work?: Pt
}

const spot = (x: number, y: number, node: NodeId, face: Facing, extra: Partial<Spot> = {}): Spot => ({
  x,
  y,
  node,
  face,
  out: (NODES[node] as { out?: boolean }).out === true,
  ...extra,
})

// The beds are as long as the people are tall, and they just fit under the round wall.
export const BEDS: Pt[] = [{ x: 743, y: 397 }, { x: 781, y: 392 }, { x: 819, y: 392 }, { x: 857, y: 397 }]
export const MED_BEDS: Pt[] = [{ x: 868, y: 447 }, { x: 868, y: 482 }]
// Four beds along each long wall, all inside the walls, with an aisle down the middle.
const PLANT_COLUMNS = [1117, 1176, 1235, 1294]
export const PLANT_BEDS: Pt[] = PLANT_COLUMNS.flatMap((x) => [{ x, y: 402 }, { x, y: 498 }])

const SPOTS: Record<Exclude<Activity, 'repair'>, Spot[]> = {
  idle: [
    spot(800, 530, 'hab', 'down'),
    spot(754, 523, 'hab', 'down'),
    spot(846, 523, 'hab', 'down'),
    spot(710, 504, 'hab', 'down'),
    spot(884, 524, 'hab', 'down'),
  ],
  rest: BEDS.map((bed) => spot(bed.x, bed.y, 'hab', 'down', { lie: 'v' })),
  sickbay: MED_BEDS.map((bed) => spot(bed.x, bed.y, 'hab', 'down', { lie: 'h' })),
  call: [spot(748, 440, 'hab', 'left', { work: { x: 722, y: 440 } }), spot(748, 474, 'hab', 'left', { work: { x: 722, y: 474 } })],
  garden: [
    spot(1117, 474, 'farm', 'up', { work: { x: 1117, y: 410 } }),
    spot(1176, 474, 'farm', 'down', { work: { x: 1176, y: 492 } }),
    spot(1235, 474, 'farm', 'up', { work: { x: 1235, y: 410 } }),
    spot(1294, 474, 'farm', 'down', { work: { x: 1294, y: 492 } }),
  ],
  lab: [
    spot(490, 728, 'lab', 'down', { work: { x: 490, y: 756 } }),
    spot(545, 728, 'lab', 'down', { work: { x: 545, y: 756 } }),
    spot(476, 690, 'lab', 'left', { work: { x: 450, y: 690 } }),
    spot(596, 734, 'lab', 'down', { work: { x: 596, y: 758 } }),
  ],
  build: [
    spot(1146, 742, 'siteGate', 'right', { work: { x: 1180, y: 722 } }),
    spot(1148, 646, 'siteGate', 'right', { work: { x: 1182, y: 660 } }),
    spot(1196, 800, 'siteGate', 'up', { work: { x: 1212, y: 766 } }),
    spot(1202, 590, 'siteGate', 'down', { work: { x: 1216, y: 618 } }),
  ],
  board: [spot(842, 748, 'garage', 'right')],
}

/** Where a repair happens: at the broken module, or at the solar panels. */
const REPAIR_SPOTS: Record<ModuleId | 'panels', Spot[]> = {
  panels: [
    spot(770, 236, 'n1', 'up', { work: { x: 770, y: 196 } }),
    spot(840, 236, 'n1', 'up', { work: { x: 840, y: 196 } }),
    spot(910, 236, 'n1', 'up', { work: { x: 910, y: 196 } }),
    spot(980, 236, 'n1', 'up', { work: { x: 980, y: 196 } }),
  ],
  life: [spot(425, 480, 'life', 'left', { work: { x: 398, y: 470 } })],
  farm: [spot(1146, 474, 'farm', 'up', { work: { x: 1146, y: 420 } })],
  comms: [spot(388, 190, 'dishPad', 'left', { work: { x: 362, y: 194 } })],
  scope: [spot(1232, 232, 'scopePad', 'right', { work: { x: 1258, y: 214 } })],
  lab: [spot(600, 716, 'lab', 'down', { work: { x: 600, y: 750 } })],
  garage: [spot(790, 766, 'garage', 'right', { work: { x: 812, y: 772 } })],
}

/**
 * The spot for the n-th person doing this activity. If more people do it than there
 * are spots, the extra ones stand just beside the last spot.
 */
export function spotFor(activity: Activity, index: number, repairAt: ModuleId | 'panels' = 'panels'): Spot {
  const list = activity === 'repair' ? REPAIR_SPOTS[repairAt] : SPOTS[activity]
  if (index < list.length) return list[index]
  const last = list[list.length - 1]
  const extra = index - list.length + 1
  return { ...last, x: last.x + 24 * extra, y: last.y + 10 * extra, lie: undefined }
}

/**
 * The walk to a spot, as a list of steps, for someone who last passed the walking point
 * "from". If they are already on their way to "heading" and the new walk goes the same
 * way, they do not turn back first.
 */
export function walk(from: NodeId, to: Spot, heading: NodeId | null = null): Step[] {
  const end: Step = { x: to.x, y: to.y, out: to.out }
  if (from === to.node && !heading) return [end]
  const nodes = nodePath(from, to.node)
  if (heading && nodes[1] === heading) nodes.shift()
  return [...nodes.map(nodeStep), end]
}

// ---------------------------------------------------------------- pointing at things

export interface PlaceShape {
  id: PlaceId
  module: ModuleId | null
  name: string
  /** Where the name tag goes. */
  label: Pt
  contains: (p: Pt) => boolean
}

const inRect = (r: Rect, grow = 0) => (p: Pt) =>
  p.x >= r.x - grow && p.x <= r.x + r.w + grow && p.y >= r.y - grow && p.y <= r.y + r.h + grow
const inCircle = (c: Pt & { r: number }, grow = 0) => (p: Pt) => Math.hypot(p.x - c.x, p.y - c.y) <= c.r + grow

export const PLACES: PlaceShape[] = [
  { id: 'habitat', module: null, name: 'Crew quarters', label: { x: 800, y: 306 }, contains: inCircle(HAB) },
  { id: 'farm', module: 'farm', name: 'Greenhouse', label: { x: 1205, y: 552 }, contains: inRect(ROOMS.farm) },
  { id: 'life', module: 'life', name: 'Life Support', label: { x: 380, y: 542 }, contains: inRect(ROOMS.life) },
  { id: 'lab', module: 'lab', name: 'Lab', label: { x: 530, y: 802 }, contains: inRect(ROOMS.lab) },
  { id: 'garage', module: 'garage', name: 'Rover Bay', label: { x: 848, y: 826 }, contains: inRect(ROOMS.garage) },
  { id: 'panels', module: null, name: 'Solar panels', label: { x: 920, y: 82 }, contains: inRect({ x: 712, y: 100, w: 420, h: 150 }) },
  { id: 'site', module: null, name: 'Radio telescope', label: { x: 1250, y: 812 }, contains: inCircle(SITE, 14) },
  { id: 'comms', module: 'comms', name: 'Radio Dish', label: { x: 300, y: 282 }, contains: inCircle(DISH, 8) },
  { id: 'scope', module: 'scope', name: 'Sun Telescope', label: { x: 1295, y: 270 }, contains: inCircle(SCOPE, 8) },
]

export function placeOfModule(module: ModuleId): PlaceId {
  return module
}

/** The middle of a place, for things that pop up over it. */
export function placeCentre(id: PlaceId): Pt {
  switch (id) {
    case 'habitat':
      return { x: HAB.x, y: HAB.y }
    case 'panels':
      return { x: 920, y: 150 }
    case 'site':
      return { x: SITE.x, y: SITE.y }
    case 'comms':
      return { x: DISH.x, y: DISH.y }
    case 'scope':
      return { x: SCOPE.x, y: SCOPE.y }
    default: {
      const r = ROOMS[id]
      return { x: r.x + r.w / 2, y: r.y + r.h / 2 }
    }
  }
}
