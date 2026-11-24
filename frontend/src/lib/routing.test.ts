import { describe, expect, it } from 'vitest'
import campus from '../data/fixtures'
import { computeRoute } from './routing'

const placeId = (name: string): number => {
  const place = campus.places.find((item) => item.name === name)
  if (!place) throw new Error(`Missing two-building fixture place: ${name}`)
  return place.id
}

describe('computeRoute between the two campus buildings', () => {
  it('routes from the engineering building to the medical school building', () => {
    const route = computeRoute(campus, placeId('Engineering Building'), placeId('Medical School Building'))
    expect(route).not.toBeNull()
    expect(route!.nodes.length).toBeGreaterThan(2)
    expect(route!.steps.every((step) => step.action === 'walk')).toBe(true)
    expect(route!.total_distance).toBeGreaterThan(0)
  })

  it('honors the accessible-route option on the mapped outdoor network', () => {
    const route = computeRoute(campus, placeId('Engineering Building'), placeId('Medical School Building'), true)
    expect(route).not.toBeNull()
    expect(route!.accessible).toBe(true)
  })

  it('returns null when a place has no navigation node', () => {
    expect(computeRoute(campus, -1, placeId('Engineering Building'))).toBeNull()
  })
})
