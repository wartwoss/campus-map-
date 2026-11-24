import { describe, expect, it } from 'vitest'
import source from '../data/two-building-campus.json'
import fixtures from '../data/fixtures'
import { pointInPolygon } from './floorplan'

describe('two-building Mankato campus extract', () => {
  it('contains exactly the engineering and medical buildings', () => {
    expect(fixtures.buildings.map((building) => building.name)).toEqual([
      'Engineering Building',
      'Medical School Building',
    ])
    expect(fixtures.buildings.every((building) => building.navigable)).toBe(true)
  })

  it('gives each building two source floor plans', () => {
    for (const building of fixtures.buildings) {
      expect(building.floors.map((floor) => floor.level)).toEqual([1, 2])
      for (const floor of building.floors) {
        expect(floor.plan_status).toBe('official')
        expect(floor.plan_image_url).toMatch(/^\/assets\/floorplans\/.+\.pdf$/)
        expect(floor.plan_source).toMatch(/^https:\/\/mankato\.mnsu\.edu\//)
        expect(floor.size.width).toBeGreaterThan(20)
        expect(floor.size.depth).toBeGreaterThan(20)
      }
    }
  })

  it('carries OpenStreetMap attribution and a mapped road plus walkways', () => {
    expect(source.attribution).toContain('OpenStreetMap contributors')
    expect(source.attribution).toContain('ODbL 1.0')
    const kinds = new Set(fixtures.campus.features.paths.map((path) => path.kind))
    expect(kinds.has('road')).toBe(true)
    expect(kinds.has('walkway')).toBe(true)
    expect(fixtures.campus.features.paths.every((path) => path.points.length >= 2 && path.width > 0)).toBe(true)
  })

  it('keeps both buildings inside the site boundary', () => {
    const ring = fixtures.campus.features.boundary.ring
    for (const building of fixtures.buildings) {
      const x = building.footprint.reduce((sum, point) => sum + point[0], 0) / building.footprint.length
      const y = building.footprint.reduce((sum, point) => sum + point[1], 0) / building.footprint.length
      expect(pointInPolygon(x, y, ring), building.name).toBe(true)
    }
  })
})
