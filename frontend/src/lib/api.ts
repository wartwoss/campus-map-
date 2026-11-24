import type { CampusData, PlaceData, RouteResult } from '../types'
import fixtures from '../data/fixtures'
import { computeRoute } from './routing'

export const API_BASE: string =
  (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000'

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { Accept: 'application/json', ...(init?.headers ?? {}) },
  })

  if (!response.ok) {
    const message = await response
      .json()
      .then((body) => (body as { message?: string }).message)
      .catch(() => `Request failed with status ${response.status}`)
    throw new Error(message ?? `Request failed with status ${response.status}`)
  }

  return response.json() as Promise<T>
}

export interface CampusLoad {
  data: CampusData
  backendOnline: boolean
}

export async function loadCampus(): Promise<CampusLoad> {
  try {
    const data = await fetchJson<CampusData>('/api/campus')
    if (data.campus.name === fixtures.campus.name) {
      // The API stores site geometry and rooms, not the plan-sheet paths.
      // Attach them from the committed two-building source so the interior
      // still renders the university drawings when the backend is online.
      const sourceFloors = new Map(
        fixtures.buildings.flatMap((building) => building.floors).map((floor) => [floor.id, floor]),
      )
      const buildings = data.buildings.map((building) => ({
        ...building,
        floors: building.floors.map((floor) => {
          const source = sourceFloors.get(floor.id)
          return source
            ? {
                ...floor,
                plan_image_url: floor.plan_image_url ?? source.plan_image_url,
                plan_source: floor.plan_source ?? source.plan_source,
              }
            : floor
        }),
      }))
      return { data: { ...data, buildings }, backendOnline: true }
    }
  } catch {
    // Use the committed two-building extract when the API is offline.
  }
  return { data: fixtures, backendOnline: false }
}

export async function computeRouteApi(
  data: CampusData,
  backendOnline: boolean,
  fromPlaceId: number,
  toPlaceId: number,
  accessible: boolean,
): Promise<RouteResult> {
  if (backendOnline) {
    return fetchJson<RouteResult>('/api/route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: fromPlaceId, to: toPlaceId, accessible }),
    })
  }

  const route = computeRoute(data, fromPlaceId, toPlaceId, accessible)
  if (!route) {
    throw new Error('No walkable route exists between these places in the current map data.')
  }
  return route
}

// --- Admin API ---------------------------------------------------------------

export interface AdminSession {
  token: string
  user: { id: number; name: string; email: string }
}

export async function login(email: string, password: string): Promise<AdminSession> {
  return fetchJson<AdminSession>('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
}

export async function adminRequest<T>(
  token: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  return fetchJson<T>(path, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      ...(init?.headers ?? {}),
    },
  })
}

export async function adminListPlaces(token: string): Promise<PlaceData[]> {
  const places = await adminRequest<PlaceData[]>(token, '/api/admin/places')
  return places
}

export async function adminUpdatePlace(
  token: string,
  id: number,
  changes: Partial<PlaceData>,
): Promise<PlaceData> {
  return adminRequest<PlaceData>(token, `/api/admin/places/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(changes),
  })
}

export async function adminCreatePlace(
  token: string,
  place: Partial<PlaceData>,
): Promise<PlaceData> {
  return adminRequest<PlaceData>(token, '/api/admin/places', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(place),
  })
}

export async function adminSetPublishStatus(
  token: string,
  id: number,
  published: boolean,
): Promise<PlaceData> {
  return adminRequest<PlaceData>(token, `/api/admin/places/${id}/${published ? 'publish' : 'unpublish'}`, {
    method: 'POST',
  })
}

export async function adminDeletePlace(token: string, id: number): Promise<void> {
  await adminRequest<{ message: string }>(token, `/api/admin/places/${id}`, {
    method: 'DELETE',
  })
}

export async function adminUploadFloorPlan(
  token: string,
  floorId: number,
  file: File,
): Promise<{ id: number; plan_image_url: string | null }> {
  const body = new FormData()
  body.append('image', file)

  const response = await fetch(`${API_BASE}/api/admin/floors/${floorId}/plan-image`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    body,
  })

  if (!response.ok) {
    const message = await response
      .json()
      .then((body) => (body as { message?: string }).message)
      .catch(() => 'Upload failed.')
    throw new Error(message ?? 'Upload failed.')
  }

  return response.json()
}
