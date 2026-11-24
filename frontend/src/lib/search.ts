import type { PlaceData } from '../types'

/**
 * Pure search used by the search bar. Matches names, aliases and
 * descriptions, case-insensitive.
 */
export function searchPlaces(places: PlaceData[], term: string): PlaceData[] {
  const needle = term.trim().toLowerCase()
  if (needle.length === 0) return []

  return places
    .filter((place) => {
      const haystacks = [
        place.name,
        ...(place.aliases ?? []),
        place.description ?? '',
      ]
      return haystacks.some((value) => value.toLowerCase().includes(needle))
    })
    .slice(0, 12)
}

export function placeContext(
  place: PlaceData,
  buildingNames: Map<number, string>,
  floorNames: Map<number, string>,
): string {
  if (place.building_id !== null && place.floor_id !== null) {
    const building = buildingNames.get(place.building_id) ?? 'Building'
    const floor = floorNames.get(place.floor_id)
    return floor ? `${building}, ${floor}` : building
  }
  return 'Campus grounds'
}
