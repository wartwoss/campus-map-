import { describe, expect, it } from 'vitest'
import { estimateStoreys, facadePlacements, MODULE_HEIGHT, wallModuleCount } from './modular'

const rect: [number, number][] = [
  [0, 0],
  [20, 0],
  [20, 10],
  [0, 10],
]

describe('facadePlacements', () => {
  it('places one wall or window module per 2 m of edge per storey', () => {
    const placements = facadePlacements(rect, { storeys: 3, storeyHeight: 3.4, entranceEdge: 0 })
    const walls = placements.filter((p) => p.kind !== 'column')
    // Perimeter 60 m => 30 modules per storey => 90 wall modules.
    expect(walls.length).toBe(90)
    expect(walls.length).toBe(wallModuleCount(rect, 3))
  })

  it('adds one column per vertex per storey', () => {
    const placements = facadePlacements(rect, { storeys: 3, storeyHeight: 3.4 })
    expect(placements.filter((p) => p.kind === 'column').length).toBe(4 * 3)
  })

  it('puts exactly one doorway at ground level on the entrance edge', () => {
    const placements = facadePlacements(rect, { storeys: 4, storeyHeight: 3.4, entranceEdge: 0 })
    const doorways = placements.filter((p) => p.kind === 'doorway')
    expect(doorways.length).toBe(1)
    expect(doorways[0].y).toBe(0)
    // Entrance edge runs along x from 0 to 20 at z = 0.
    expect(doorways[0].z).toBeCloseTo(0, 6)
    expect(doorways[0].x).toBeGreaterThan(0)
    expect(doorways[0].x).toBeLessThan(20)
  })

  it('keeps every module on the footprint outline', () => {
    const placements = facadePlacements(rect, { storeys: 2, storeyHeight: 3.4 })
    for (const p of placements.filter((q) => q.kind !== 'column')) {
      const onEdge = Math.abs(p.x) < 1e-6 || Math.abs(p.x - 20) < 1e-6 || Math.abs(p.z) < 1e-6 || Math.abs(p.z - 10) < 1e-6
      expect(onEdge, `module at ${p.x},${p.z}`).toBe(true)
    }
  })

  it('scales storeys to the requested height', () => {
    const placements = facadePlacements(rect, { storeys: 5, storeyHeight: 4.8 })
    const tops = [...new Set(placements.map((p) => Math.round(p.y * 1000) / 1000))].sort((a, b) => a - b)
    expect(tops).toEqual([0, 4.8, 9.6, 14.4, 19.2])
    expect(placements[0].scaleY).toBeCloseTo(4.8 / MODULE_HEIGHT, 6)
  })

  it('orients modules along their edge', () => {
    const placements = facadePlacements(rect, { storeys: 1, storeyHeight: 3.4 })
    const alongX = placements.find((p) => p.kind !== 'column' && p.z === 0)!
    // An edge running along +x has local +Z along +x: rotY = atan2(1, 0) = PI/2.
    expect(alongX.rotY).toBeCloseTo(Math.PI / 2, 6)
  })
})

describe('estimateStoreys', () => {
  it('converts a building height to whole storeys', () => {
    expect(estimateStoreys(10)).toBe(3)
    expect(estimateStoreys(17)).toBe(5)
    expect(estimateStoreys(1)).toBe(1)
  })
})
