/**
 * Pure placement math for modular building facades (Kenney Building Kit).
 *
 * Modules are 2 m wide and 2.4 m tall in their own files. A footprint edge is
 * split into n modules of equal length, and each module is repeated per
 * storey. Storey height is applied by scaling the module's Y axis.
 *
 * World frame: x east, y up, z south (campus y).
 */

export type Point = [number, number]

export type ModuleKind = 'wall' | 'window' | 'doorway' | 'column'

export interface Placement {
  kind: ModuleKind
  x: number
  y: number
  z: number
  /** Rotation about Y, so that the module's local +Z runs along the edge. */
  rotY: number
  /** Scale along the module's local Z (edge direction). */
  scaleZ: number
  /** Scale along Y (storey height / module height). */
  scaleY: number
}

export const MODULE_WIDTH = 2
export const MODULE_HEIGHT = 2.4

export interface FacadeOptions {
  storeys: number
  storeyHeight: number
  /** Index of the footprint edge that carries the main entrance, if any. */
  entranceEdge?: number
  /** One module in N is a window; the rest are plain wall. */
  windowEvery?: number
}

export function facadePlacements(footprint: Point[], options: FacadeOptions): Placement[] {
  const { storeys, storeyHeight, entranceEdge = -1, windowEvery = 3 } = options
  const scaleY = storeyHeight / MODULE_HEIGHT
  const placements: Placement[] = []

  // Walls along each edge.
  for (let i = 0; i < footprint.length; i++) {
    const [x0, z0] = footprint[i]
    const [x1, z1] = footprint[(i + 1) % footprint.length]
    const dx = x1 - x0
    const dz = z1 - z0
    const length = Math.hypot(dx, dz)
    if (length < MODULE_WIDTH * 0.5) continue

    const count = Math.max(1, Math.round(length / MODULE_WIDTH))
    const segment = length / count
    const rotY = Math.atan2(dx, dz)
    const ux = dx / length
    const uz = dz / length
    const middle = Math.floor(count / 2)

    for (let j = 0; j < count; j++) {
      const t = (j + 0.5) * segment
      const px = x0 + ux * t
      const pz = z0 + uz * t

      for (let k = 0; k < storeys; k++) {
        let kind: ModuleKind
        if (k === 0 && i === entranceEdge && j === middle) kind = 'doorway'
        else if ((j + k * 2 + i) % windowEvery === 0) kind = 'window'
        else kind = 'wall'

        placements.push({
          kind,
          x: px,
          y: k * storeyHeight,
          z: pz,
          rotY,
          scaleZ: segment / MODULE_WIDTH,
          scaleY,
        })
      }
    }
  }

  // Corner columns at every vertex, for each storey.
  for (const [x, z] of footprint) {
    for (let k = 0; k < storeys; k++) {
      placements.push({ kind: 'column', x, y: k * storeyHeight, z, rotY: 0, scaleZ: 1, scaleY })
    }
  }

  return placements
}

/** Column-free wall count, used by tests and by the storey estimate. */
export function wallModuleCount(footprint: Point[], storeys: number): number {
  let total = 0
  for (let i = 0; i < footprint.length; i++) {
    const [x0, z0] = footprint[i]
    const [x1, z1] = footprint[(i + 1) % footprint.length]
    const length = Math.hypot(x1 - x0, z1 - z0)
    if (length < MODULE_WIDTH * 0.5) continue
    total += Math.max(1, Math.round(length / MODULE_WIDTH)) * storeys
  }
  return total
}

/** Storeys for a building that has no mapped floors: about 3.4 m per level. */
export function estimateStoreys(visualHeight: number): number {
  return Math.max(1, Math.round(visualHeight / 3.4))
}
