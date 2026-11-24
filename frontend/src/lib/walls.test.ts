import { describe, expect, it } from 'vitest'
import { distanceToSegment, type Point } from './floorplan'
import { buildWallPieces, collectWallRuns, mergeSpans, type WallPiece } from './walls'

const twoRooms = [
  { id: 'a', polygon: [[0, 0], [10, 0], [10, 10], [0, 10]] as Point[] },
  { id: 'b', polygon: [[10, 0], [20, 0], [20, 10], [10, 10]] as Point[] },
]

function length(piece: WallPiece): number {
  return Math.hypot(piece.b[0] - piece.a[0], piece.b[1] - piece.a[1])
}

describe('mergeSpans', () => {
  it('merges overlapping and touching intervals', () => {
    expect(mergeSpans([[5, 8], [0, 3], [3, 5], [10, 12]])).toEqual([
      [0, 8],
      [10, 12],
    ])
  })
})

describe('collectWallRuns', () => {
  it('builds a shared wall once', () => {
    // Outline: 4 sides, plus the shared x=10 wall that both rooms border.
    expect(collectWallRuns(twoRooms)).toHaveLength(5)
  })

  it('merges a shared wall even when the rooms edges differ in length', () => {
    const rooms = [
      { polygon: [[0, 0], [10, 0], [10, 10], [0, 10]] as Point[] },
      { polygon: [[10, 0], [20, 0], [20, 4], [10, 4]] as Point[] },
      { polygon: [[10, 4], [20, 4], [20, 10], [10, 10]] as Point[] },
    ]
    const runs = collectWallRuns(rooms)
    const divider = runs.filter((r) => r.a[0] === 10 && r.b[0] === 10)
    // The x=10 divider is one run from the top to the bottom wall.
    expect(divider).toHaveLength(1)
  })
})

describe('buildWallPieces', () => {
  it('produces closed outline walls without openings', () => {
    const pieces = buildWallPieces({ rooms: twoRooms, doors: [] }, 0.3)
    expect(pieces).toHaveLength(5)
    const total = pieces.reduce((sum, p) => sum + length(p), 0)
    // Centreline runs total 20+20+10+10+10 = 70 m. Each run is extended by
    // half a wall (0.15 m) at both ends, so 5 pieces add 1.5 m.
    expect(total).toBeCloseTo(71.5, 6)
  })

  it('cuts a door opening out of the shared wall', () => {
    const pieces = buildWallPieces(
      { rooms: twoRooms, doors: [{ at: [10, 5], width: 1 }] },
      0.3,
    )
    // The divider splits in two; everything else is unchanged.
    expect(pieces).toHaveLength(6)
    const divider = pieces.filter((p) => p.a[0] === 10 && p.b[0] === 10)
    expect(divider).toHaveLength(2)
    for (const piece of divider) {
      expect(distanceToSegment(10, 5, piece.a, piece.b)).toBeGreaterThan(0.4)
    }
  })


})
