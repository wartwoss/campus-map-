import { describe, expect, it } from 'vitest'
import campus from '../data/fixtures'
import { searchPlaces } from './search'

describe('searchPlaces on the two-building campus data', () => {
  it('finds the engineering building by name, case-insensitive', () => {
    expect(searchPlaces(campus.places, 'engineering').map((place) => place.name)).toContain(
      'Engineering Building',
    )
  })

  it('finds the medical school building by name', () => {
    expect(searchPlaces(campus.places, 'medical').map((place) => place.name)).toContain(
      'Medical School Building',
    )
  })

  it('finds a building from its source alias', () => {
    expect(searchPlaces(campus.places, 'trafton').map((place) => place.name)).toContain(
      'Engineering Building',
    )
  })

  it('returns nothing for an empty term', () => {
    expect(searchPlaces(campus.places, '   ')).toEqual([])
  })

  it('limits the number of results', () => {
    expect(searchPlaces(campus.places, 'e').length).toBeLessThanOrEqual(12)
  })
})
