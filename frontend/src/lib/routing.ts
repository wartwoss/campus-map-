import type { CampusData, NavEdgeData, NavNodeData, RouteResult, RouteStep } from '../types'
import { DOOR_SEGMENT, ELEVATOR_PENALTY, euclidean, STAIR_PENALTY } from './geo'

interface Adjacency {
  weights: Record<string, Record<string, number>>
  kinds: Record<string, NavEdgeData['kind']>
}

function buildAdjacency(data: CampusData, accessibleOnly: boolean): Adjacency {
  const nodes = new Map<string, NavNodeData>(data.graph.nodes.map((n) => [n.key, n]))
  const weights: Record<string, Record<string, number>> = {}
  const kinds: Record<string, NavEdgeData['kind']> = {}

  for (const edge of data.graph.edges) {
    if (accessibleOnly && !edge.accessible) continue
    const a = nodes.get(edge.from)
    const b = nodes.get(edge.to)
    if (!a || !b) continue

    const sameFrame = (a.floor_id === null) === (b.floor_id === null)
    let weight = edge.weight ?? (sameFrame ? euclidean(a, b) : DOOR_SEGMENT)

    if (edge.kind === 'stair') weight += STAIR_PENALTY
    if (edge.kind === 'elevator') weight += ELEVATOR_PENALTY

    ;(weights[edge.from] ??= {})[edge.to] = weight
    ;(weights[edge.to] ??= {})[edge.from] = weight
    kinds[`${edge.from}|${edge.to}`] = edge.kind
    kinds[`${edge.to}|${edge.from}`] = edge.kind
  }

  return { weights, kinds }
}

export function dijkstraPath(
  adjacency: Adjacency,
  start: string,
  goal: string,
): string[] | null {
  const dist: Record<string, number> = { [start]: 0 }
  const prev: Record<string, string> = {}
  const visited = new Set<string>()

  // Small demo graphs: a simple keyed priority selection is sufficient.
  let frontier: Record<string, number> = { [start]: 0 }

  while (Object.keys(frontier).length > 0) {
    const current = Object.entries(frontier).sort((x, y) => x[1] - y[1])[0][0]
    const currentDist = frontier[current]
    delete frontier[current]

    if (current === goal) break
    if (visited.has(current)) continue
    visited.add(current)

    for (const [neighbor, weight] of Object.entries(adjacency.weights[current] ?? {})) {
      if (visited.has(neighbor)) continue
      const candidate = currentDist + weight
      if (dist[neighbor] === undefined || candidate < dist[neighbor]) {
        dist[neighbor] = candidate
        prev[neighbor] = current
        frontier[neighbor] = candidate
      }
    }
  }

  if (dist[goal] === undefined) return null

  const path = [goal]
  let cursor = goal
  while (prev[cursor] !== undefined) {
    cursor = prev[cursor]
    path.unshift(cursor)
  }
  return path
}

/**
 * Client-side mirror of the backend Dijkstra router. Used when the demo runs
 * without the Laravel API (offline fixture mode) and covered by unit tests.
 */
export function computeRoute(
  data: CampusData,
  fromPlaceId: number,
  toPlaceId: number,
  accessibleOnly = false,
): RouteResult | null {
  const nodeByPlace = new Map<number, NavNodeData>()
  for (const node of data.graph.nodes) {
    if (node.place_id !== null && !nodeByPlace.has(node.place_id)) {
      nodeByPlace.set(node.place_id, node)
    }
  }

  const startNode = nodeByPlace.get(fromPlaceId)
  const endNode = nodeByPlace.get(toPlaceId)
  if (!startNode || !endNode) return null

  const from = data.places.find((p) => p.id === fromPlaceId)
  const to = data.places.find((p) => p.id === toPlaceId)
  if (!from || !to) return null

  const adjacency = buildAdjacency(data, accessibleOnly)
  const keys = dijkstraPath(adjacency, startNode.key, endNode.key)
  if (!keys) return null

  const nodesByKey = new Map(data.graph.nodes.map((n) => [n.key, n]))
  const sequence = keys.map((key) => nodesByKey.get(key)!)

  const floorsById = new Map<number, { level: number; name: string }>()
  for (const building of data.buildings) {
    for (const floor of building.floors) {
      floorsById.set(floor.id, { level: floor.level, name: floor.name })
    }
  }
  const buildingsById = new Map(data.buildings.map((b) => [b.id, b]))

  const steps: RouteStep[] = []
  let walkDistance = 0
  let walkTail: string | null = null

  const flushWalk = (toTail = false) => {
    if (walkDistance >= 0.5) {
      let text = `Walk ${Math.round(walkDistance)} m`
      if (toTail && walkTail) text += ` to ${walkTail}`
      else if (walkTail) text += ` toward ${walkTail}`
      steps.push({ action: 'walk', distance: Math.round(walkDistance), text })
    }
    walkDistance = 0
    walkTail = null
  }

  const lastIndex = sequence.length - 1

  for (let i = 1; i <= lastIndex; i++) {
    const prevNode = sequence[i - 1]
    const node = sequence[i]
    const kind = adjacency.kinds[`${prevNode.key}|${node.key}`] ?? 'path'
    const sameFrame = (prevNode.floor_id === null) === (node.floor_id === null)
    const segment = sameFrame
      ? euclidean(prevNode, node)
      : (adjacency.weights[prevNode.key]?.[node.key] ?? 0)
    const isLast = i === lastIndex
    const floorChange =
      prevNode.floor_id !== null &&
      node.floor_id !== null &&
      prevNode.floor_id !== node.floor_id

    if (node.type === 'entrance') {
      walkDistance += segment
      walkTail = node.name
      flushWalk()
      const building = node.building_id !== null ? buildingsById.get(node.building_id) : null
      steps.push({
        action: 'enter',
        text: `Enter ${building?.name ?? 'the building'}`,
        building_id: node.building_id,
      })
    } else if (floorChange) {
      flushWalk()
      const targetFloor = node.floor_id !== null ? floorsById.get(node.floor_id) : null
      const sourceFloor =
        prevNode.floor_id !== null ? floorsById.get(prevNode.floor_id) : null
      const direction = (targetFloor?.level ?? 0) >= (sourceFloor?.level ?? 0) ? 'up' : 'down'
      const via = kind === 'elevator' ? 'the elevator' : 'the stairs'
      steps.push({
        action: kind === 'elevator' ? 'elevator' : 'stairs',
        text: `Take ${via} ${direction} to ${targetFloor?.name ?? 'the next floor'}`,
        floor_id: node.floor_id,
      })
    } else {
      walkDistance += segment
      if (node.name) walkTail = node.name
    }

    if (isLast) flushWalk(true)
  }

  let total = 0
  for (let i = 1; i <= lastIndex; i++) {
    const prevNode = sequence[i - 1]
    const node = sequence[i]
    const sameFrame = (prevNode.floor_id === null) === (node.floor_id === null)
    total += sameFrame ? euclidean(prevNode, node) : (adjacency.weights[prevNode.key]?.[node.key] ?? 0)
  }

  return {
    from: { id: from.id, name: from.name, category: from.category },
    to: { id: to.id, name: to.name, category: to.category },
    total_distance: Math.round(total),
    estimated_minutes: Math.max(1, Math.round(total / 80)),
    nodes: sequence.map((n) => ({
      key: n.key,
      name: n.name,
      type: n.type,
      x: n.x,
      y: n.y,
      building_id: n.building_id,
      floor_id: n.floor_id,
      place_id: n.place_id,
    })),
    steps,
    accessible: accessibleOnly,
  }
}
