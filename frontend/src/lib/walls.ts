/**
 * Wall geometry derived from room outlines and door positions.
 *
 * Rooms are only polygons; walls are the edges they share or border the
 * outline with. Collinear edges are merged so a wall shared by two rooms is
 * built once, then every door cuts an opening in the wall it sits on. Walls
 * are returned as centreline pieces; the renderer gives them thickness.
 *
 * Coordinates are floor-local metres (x east, y south).
 */
import { distanceToSegment, type Point } from './floorplan'

export interface WallPiece {
  a: Point
  b: Point
}

interface WallRun {
  a: Point
  b: Point
}

interface AxisLine {
  horizontal: boolean
  coord: number
  spans: [number, number][]
}

const EPS = 1e-6
const SNAP = 1e-3
const ON_WALL = 0.05

function snap(value: number): number {
  return Math.round(value / SNAP) * SNAP
}

/** Sort and merge overlapping or touching intervals. */
export function mergeSpans(spans: [number, number][]): [number, number][] {
  const sorted = [...spans].sort((x, y) => x[0] - y[0])
  const merged: [number, number][] = []
  for (const [lo, hi] of sorted) {
    const last = merged[merged.length - 1]
    if (last && lo <= last[1] + EPS) last[1] = Math.max(last[1], hi)
    else merged.push([lo, hi])
  }
  return merged
}

/**
 * Collect every distinct wall run from room outlines. Axis-aligned edges are
 * grouped by their line and merged; any other edge is kept once.
 */
export function collectWallRuns(rooms: { polygon: Point[] }[]): WallRun[] {
  const axisLines = new Map<string, AxisLine>()
  const diagonals = new Map<string, WallRun>()

  const addSpan = (horizontal: boolean, coord: number, lo: number, hi: number) => {
    const key = `${horizontal ? 'h' : 'v'}:${snap(coord)}`
    let line = axisLines.get(key)
    if (!line) {
      line = { horizontal, coord, spans: [] }
      axisLines.set(key, line)
    }
    line.spans.push([lo, hi])
  }

  for (const room of rooms) {
    const polygon = room.polygon
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i]
      const b = polygon[(i + 1) % polygon.length]
      const dx = b[0] - a[0]
      const dy = b[1] - a[1]
      if (Math.hypot(dx, dy) < EPS) continue

      if (Math.abs(dy) < EPS) {
        addSpan(true, a[1], Math.min(a[0], b[0]), Math.max(a[0], b[0]))
      } else if (Math.abs(dx) < EPS) {
        addSpan(false, a[0], Math.min(a[1], b[1]), Math.max(a[1], b[1]))
      } else {
        const ka = `${snap(a[0])},${snap(a[1])}`
        const kb = `${snap(b[0])},${snap(b[1])}`
        const key = [ka, kb].sort().join('|')
        if (!diagonals.has(key)) diagonals.set(key, { a, b })
      }
    }
  }

  const runs: WallRun[] = [...diagonals.values()]
  for (const line of axisLines.values()) {
    for (const [lo, hi] of mergeSpans(line.spans)) {
      runs.push(
        line.horizontal
          ? { a: [lo, line.coord], b: [hi, line.coord] }
          : { a: [line.coord, lo], b: [line.coord, hi] },
      )
    }
  }
  return runs
}

interface DoorCut {
  at: Point
  width: number
}

/**
 * Cut door openings out of one wall run and return the remaining pieces.
 * Pieces that end at a run corner are extended by half the wall thickness so
 * corners close; ends beside an opening stay flush with the opening.
 */
function splitRun(run: WallRun, doors: DoorCut[], thickness: number): WallPiece[] {
  const [ax, ay] = run.a
  const [bx, by] = run.b
  const length = Math.hypot(bx - ax, by - ay)
  if (length < EPS) return []
  const ux = (bx - ax) / length
  const uy = (by - ay) / length

  const cuts: [number, number][] = []
  for (const door of doors) {
    if (!(door.width > 0)) continue
    if (distanceToSegment(door.at[0], door.at[1], run.a, run.b) > ON_WALL) continue
    const t = (door.at[0] - ax) * ux + (door.at[1] - ay) * uy
    cuts.push([Math.max(0, t - door.width / 2), Math.min(length, t + door.width / 2)])
  }

  const gaps = mergeSpans(cuts)
  const segments: [number, number][] = []
  let cursor = 0
  for (const [lo, hi] of gaps) {
    if (lo > cursor + EPS) segments.push([cursor, lo])
    cursor = Math.max(cursor, hi)
  }
  if (cursor < length - EPS) segments.push([cursor, length])

  const half = thickness / 2
  const pieces: WallPiece[] = []
  for (const [s, e] of segments) {
    if (e - s < EPS) continue
    const extendStart = s <= EPS ? half : 0
    const extendEnd = e >= length - EPS ? half : 0
    const start = s - extendStart
    const end = e + extendEnd
    pieces.push({
      a: [ax + ux * start, ay + uy * start],
      b: [ax + ux * end, ay + uy * end],
    })
  }
  return pieces
}

/** Wall centreline pieces for one floor, with door openings cut out. */
export function buildWallPieces(
  floor: { rooms: { polygon: Point[] }[]; doors: DoorCut[] },
  thickness = 0.3,
): WallPiece[] {
  const pieces: WallPiece[] = []
  for (const run of collectWallRuns(floor.rooms)) {
    pieces.push(...splitRun(run, floor.doors, thickness))
  }
  return pieces
}
