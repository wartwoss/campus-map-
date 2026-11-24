export const STAIR_PENALTY = 6.0
export const ELEVATOR_PENALTY = 15.0
export const DOOR_SEGMENT = 8.0

export function euclidean(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  return Math.round(Math.hypot(a.x - b.x, a.y - b.y) * 100) / 100
}

/** Leaflet CRS.Simple lat/lng for a campus point where y grows downward. */
export function toLatLng(x: number, y: number): [number, number] {
  return [-y, x]
}
