/**
 * Floor-plan geometry helpers. Used by the SVG indoor renderer, by the data
 * validation tests, and by any future importer of official floor plans.
 *
 * Coordinates are floor-local metres, y grows downward (south).
 */

export type Point = [number, number]

export interface PlanRoom {
  id: string
  name: string
  type: string
  place?: string | null
  polygon: Point[]
}

export type DoorKind = 'door' | 'opening' | 'entrance' | 'lift' | 'stair'

export interface PlanDoor {
  id: string
  between: string[]
  at: Point
  width: number
  kind: DoorKind
}

export interface PlanFloor {
  name: string
  size: { width: number; depth: number }
  rooms: PlanRoom[]
  doors: PlanDoor[]
}

export function polygonArea(points: Point[]): number {
  let area = 0
  for (let i = 0; i < points.length; i++) {
    const [x0, y0] = points[i]
    const [x1, y1] = points[(i + 1) % points.length]
    area += x0 * y1 - x1 * y0
  }
  return Math.abs(area) / 2
}

export function pointInPolygon(x: number, y: number, polygon: Point[]): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]
    const [xj, yj] = polygon[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

export function distanceToSegment(px: number, py: number, a: Point, b: Point): number {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const len2 = dx * dx + dy * dy || 1e-9
  const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / len2))
  return Math.hypot(px - (a[0] + dx * t), py - (a[1] + dy * t))
}

/** Distance from a point to the nearest edge of a polygon. */
export function distanceToPolygonEdges(x: number, y: number, polygon: Point[]): number {
  let best = Infinity
  for (let i = 0; i < polygon.length; i++) {
    best = Math.min(best, distanceToSegment(x, y, polygon[i], polygon[(i + 1) % polygon.length]))
  }
  return best
}

export function polygonCentroid(polygon: Point[]): Point {
  let a = 0
  let cx = 0
  let cy = 0
  for (let i = 0; i < polygon.length; i++) {
    const [x0, y0] = polygon[i]
    const [x1, y1] = polygon[(i + 1) % polygon.length]
    const cross = x0 * y1 - x1 * y0
    a += cross
    cx += (x0 + x1) * cross
    cy += (y0 + y1) * cross
  }
  a /= 2
  return [cx / (6 * a), cy / (6 * a)]
}

/**
 * Validate one floor plan. Returns human-readable problems; an empty array
 * means the plan is usable. Checks:
 *  - rooms tile the floor outline exactly (no gaps, no overlaps),
 *  - each door sits on the wall shared by its two rooms (or on the outline),
 *  - every room can be reached from the entrance through doors/openings.
 */
export function validateFloorPlan(floor: PlanFloor, step = 0.25): string[] {
  const errors: string[] = []
  const { width, depth } = floor.size
  const outline: Point[] = [
    [0, 0],
    [width, 0],
    [width, depth],
    [0, depth],
  ]
  const roomById = new Map(floor.rooms.map((r) => [r.id, r]))

  if (roomById.size !== floor.rooms.length) errors.push(`${floor.name}: duplicate room ids`)

  // Tiling: sample the outline on a grid. Each sample must be inside
  // exactly one room, and a sample inside a room must lie inside the outline.
  let gaps = 0
  let overlaps = 0
  for (let x = step / 2; x < width; x += step) {
    for (let y = step / 2; y < depth; y += step) {
      let count = 0
      for (const room of floor.rooms) {
        if (pointInPolygon(x, y, room.polygon)) count++
      }
      if (count === 0) gaps++
      if (count > 1) overlaps++
    }
  }
  if (gaps > 0) errors.push(`${floor.name}: ${gaps} sample points are not covered by any room`)
  if (overlaps > 0) errors.push(`${floor.name}: ${overlaps} sample points are inside more than one room`)

  for (const room of floor.rooms) {
    const outside = room.polygon.filter(([x, y]) => x < -1e-6 || y < -1e-6 || x > width + 1e-6 || y > depth + 1e-6)
    if (outside.length > 0) errors.push(`${floor.name}: room ${room.id} extends beyond the outline`)
  }

  // Doors: the opening must lie on the wall between its rooms.
  for (const door of floor.doors) {
    if (door.width <= 0) errors.push(`${floor.name}: door ${door.id} has no width`)
    const [px, py] = door.at
    if (door.between.length === 0) {
      errors.push(`${floor.name}: door ${door.id} is not attached to a room`)
      continue
    }
    if (door.kind === 'entrance') {
      if (distanceToPolygonEdges(px, py, outline) > 0.05) errors.push(`${floor.name}: entrance ${door.id} is not on the outline`)
    }
    for (const roomId of door.between) {
      const room = roomById.get(roomId)
      if (!room) {
        errors.push(`${floor.name}: door ${door.id} references unknown room ${roomId}`)
        continue
      }
      if (distanceToPolygonEdges(px, py, room.polygon) > 0.05) {
        errors.push(`${floor.name}: door ${door.id} is not on the wall of ${roomId}`)
      }
    }
    if (door.between.length === 2) {
      const [a, b] = door.between.map((id) => roomById.get(id))
      if (a && b) {
        // A door between two rooms must sit on the wall both rooms share.
        const onBoth = distanceToPolygonEdges(px, py, a.polygon) < 0.05 && distanceToPolygonEdges(px, py, b.polygon) < 0.05
        if (!onBoth) errors.push(`${floor.name}: door ${door.id} is not on the shared wall of ${door.between.join(' and ')}`)
      }
    }
  }

  // Reachability through doors and openings. Ground floors start at the
  // building entrance; upper floors start at their stair or lift access.
  const access = floor.doors.find((d) => d.kind === 'entrance') ?? floor.doors.find((d) => d.kind === 'lift' || d.kind === 'stair')
  if (!access) {
    errors.push(`${floor.name}: no entrance, stair or lift access`)
    return errors
  }
  const passable = floor.doors.filter((d) => d.between.length === 2)
  const seen = new Set<string>([access.between[0]])
  const queue = [access.between[0]]
  while (queue.length > 0) {
    const current = queue.shift()!
    for (const door of passable) {
      const [a, b] = door.between
      const next = a === current ? b : b === current ? a : null
      if (next && !seen.has(next)) {
        seen.add(next)
        queue.push(next)
      }
    }
  }
  const unreachable = floor.rooms.filter((r) => !seen.has(r.id)).map((r) => r.id)
  if (unreachable.length > 0) errors.push(`${floor.name}: rooms unreachable from the entrance: ${unreachable.join(', ')}`)

  return errors
}
