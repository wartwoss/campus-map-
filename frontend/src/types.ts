export interface Room {
  id: string
  name: string
  type: string
  place?: string | null
  polygon: [number, number][]
}

export interface Door {
  id: string
  between: string[]
  at: [number, number]
  width: number
  kind: 'door' | 'opening' | 'entrance' | 'lift' | 'stair'
}

export interface FloorData {
  id: number
  level: number
  name: string
  size: { width: number; depth: number }
  /** Floor-local origin in campus coordinates, for placing the interior. */
  origin: { x: number; y: number }
  rooms: Room[]
  doors: Door[]
  /** 'demo' layouts are schematic and must be labelled as such. */
  plan_status: 'demo' | 'official' | 'not_published'
  plan_source: string | null
  plan_image_url: string | null
  unmapped_note?: string | null
}

export interface BuildingData {
  id: number
  osm_id: number | null
  name: string
  name_en: string | null
  code: string | null
  footprint: [number, number][]
  visual_height: number
  navigable: boolean
  floors: FloorData[]
}

export interface PlaceDetails {
  hours?: string
  menu?: { name: string; price: number }[]
  timetable?: { route: string; destination: string; times: string[] }[]
  shop_number?: string
  supports?: string
  payment?: string
  seats?: number
  equipment?: string
  [key: string]: unknown
}

export interface PlaceData {
  id: number
  category: string
  name: string
  aliases: string[]
  description: string | null
  details: PlaceDetails | null
  building_id: number | null
  floor_id: number | null
  position_campus: { x: number; y: number } | null
  position_floor: { x: number; y: number } | null
  status: 'draft' | 'published'
  source: string | null
  verified_at: string | null
}

export interface NavNodeData {
  key: string
  name: string | null
  type: 'outdoor' | 'entrance' | 'corridor' | 'stair' | 'elevator' | 'poi'
  x: number
  y: number
  building_id: number | null
  floor_id: number | null
  place_id: number | null
}

export interface NavEdgeData {
  from: string
  to: string
  weight: number | null
  kind: 'path' | 'stair' | 'elevator' | 'indoor'
  accessible: boolean
}

export interface CampusPath {
  kind: 'road' | 'walkway' | 'sidewalk'
  osm_kind: string
  zone: 'campus' | 'outside'
  width: number
  points: [number, number][]
}

export interface CampusFeatures {
  boundary: { osm_way_id: number; ring: [number, number][] }
  paths: CampusPath[]
  lawns: { kind: string; osm_id: number; points: [number, number][] }[]
  trees: [number, number][]
  labels: { text: string; x: number; y: number }[]
}

export interface CampusData {
  campus: {
    id: number
    name: string
    description: string | null
    size: { width: number; height: number }
    bounds: { minX: number; minY: number; maxX: number; maxY: number }
    features: CampusFeatures
    base_image_url: string | null
  }
  buildings: BuildingData[]
  places: PlaceData[]
  graph: { nodes: NavNodeData[]; edges: NavEdgeData[] }
}

/** Raw generated campus source, shared with the Laravel seeder. */
export interface CampusSource {
  attribution: string
  retrieved_at: string
  origin: { lat: number; lng: number }
  campus: CampusData['campus'] & { id: number }
  buildings: (Omit<BuildingData, 'floors'> & { osm_id: number })[]
  floors: (FloorData & { building_id: number })[]
  places: PlaceData[]
  graph: {
    nodes: NavNodeData[]
    edges: (NavEdgeData & { from_key: string; to_key: string })[]
  }
}

export type RouteStepAction = 'walk' | 'enter' | 'stairs' | 'elevator'

export interface RouteStep {
  action: RouteStepAction
  distance?: number
  text: string
  building_id?: number | null
  floor_id?: number | null
}

export interface RouteNode {
  key: string
  name: string | null
  type: NavNodeData['type']
  x: number
  y: number
  building_id: number | null
  floor_id: number | null
  place_id: number | null
}

export interface RouteResult {
  from: { id: number; name: string; category: string }
  to: { id: number; name: string; category: string }
  total_distance: number
  estimated_minutes: number
  nodes: RouteNode[]
  steps: RouteStep[]
  accessible: boolean
}
