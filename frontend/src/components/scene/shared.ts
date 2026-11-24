import * as THREE from 'three'
import type { BuildingData, FloorData, Room } from '../../types'

export interface SceneColors {
  ground: string
  lawn: string
  path: string
  pathLine: string
  building: string
  buildingLine: string
  buildingRoof: string
  tree: string
  inactive: string
  primary: string
  accent: string
  surface: string
  surface2: string
  lineStrong: string
  route: string
  outside: string
}

export const FLOOR_GAP = 4.2

export function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

export function readSceneColors(): SceneColors {
  return {
    ground: cssVar('--map-ground'),
    lawn: cssVar('--map-lawn'),
    path: cssVar('--map-path'),
    pathLine: cssVar('--map-path-line'),
    building: cssVar('--map-building'),
    buildingLine: cssVar('--map-building-line'),
    buildingRoof: cssVar('--map-building-roof'),
    tree: cssVar('--map-tree'),
    inactive: cssVar('--map-inactive'),
    primary: cssVar('--primary'),
    accent: cssVar('--accent'),
    surface: cssVar('--surface'),
    surface2: cssVar('--surface-2'),
    lineStrong: cssVar('--line-strong'),
    route: cssVar('--route-line'),
    outside: cssVar('--map-outside'),
  }
}

/**
 * Build a THREE.Shape from a footprint in campus coordinates (x east, y
 * south). The shape uses (x, -y) so that after rotateX(-PI/2) the polygon
 * lands in the XZ plane with z = y.
 */
export function shapeFromPoints(points: [number, number][]): THREE.Shape {
  const shape = new THREE.Shape()
  points.forEach(([x, y], index) => {
    if (index === 0) shape.moveTo(x, -y)
    else shape.lineTo(x, -y)
  })
  shape.closePath()
  return shape
}

/** Extruded geometry for a polygon, sitting on the XZ plane with z = y. */
export function extrudedGeometry(
  points: [number, number][],
  depth: number,
  offset?: { x: number; y: number },
): THREE.ExtrudeGeometry {
  const geometry = new THREE.ExtrudeGeometry(shapeFromPoints(points), {
    depth,
    bevelEnabled: false,
  })
  geometry.rotateX(-Math.PI / 2)
  if (offset) {
    geometry.translate(offset.x, 0, offset.y)
  }
  return geometry
}

/** Flat geometry for a polygon on the ground plane. */
export function flatGeometry(points: [number, number][]): THREE.ShapeGeometry {
  const geometry = new THREE.ShapeGeometry(shapeFromPoints(points))
  geometry.rotateX(-Math.PI / 2)
  return geometry
}

export function polygonBounds(points: [number, number][]) {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const [x, y] of points) {
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
  }
  return { minX, minY, maxX, maxY }
}

export function polygonCenter(points: [number, number][]): [number, number] {
  const bounds = polygonBounds(points)
  return [(bounds.minX + bounds.maxX) / 2, (bounds.minY + bounds.maxY) / 2]
}

/** World position of a floor-local point. */
export function floorToWorld(
  floor: Pick<FloorData, 'origin' | 'level'>,
  x: number,
  y: number,
): [number, number, number] {
  return [floor.origin.x + x, floor.level * FLOOR_GAP, floor.origin.y + y]
}

/** Center of a building footprint in world coordinates. */
export function buildingWorldCenter(building: BuildingData): [number, number] {
  return polygonCenter(building.footprint)
}

/** Room outline helper shared with the seed generator conventions. */
export function isCorridor(room: Room): boolean {
  return room.name.toLowerCase().includes('corridor')
}
