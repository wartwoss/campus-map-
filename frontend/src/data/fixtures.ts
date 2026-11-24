import type { CampusData, CampusSource } from '../types'
import sourceJson from './two-building-campus.json'

/**
 * Two-building Minnesota State Mankato demo map. Outdoor geometry and the
 * connecting road/paths come from OpenStreetMap (ODbL). The interior sheets
 * link to the university-published floor plans in public/assets/floorplans.
 */

const source = sourceJson as unknown as CampusSource

const campusData: CampusData = {
  campus: {
    id: source.campus.id,
    name: source.campus.name,
    description: source.campus.description,
    size: source.campus.size,
    bounds: source.campus.bounds,
    features: source.campus.features,
    base_image_url: source.campus.base_image_url,
  },
  buildings: source.buildings.map((building) => ({
    id: building.id,
    osm_id: building.osm_id ?? null,
    name: building.name,
    name_en: building.name_en,
    code: building.code,
    footprint: building.footprint,
    visual_height: building.visual_height,
    navigable: building.navigable,
    floors: source.floors
      .filter((floor) => floor.building_id === building.id)
      .sort((a, b) => a.level - b.level),
  })),
  places: source.places,
  graph: {
    nodes: source.graph.nodes,
    edges: source.graph.edges.map((edge) => ({
      from: edge.from_key,
      to: edge.to_key,
      weight: edge.weight,
      kind: edge.kind,
      accessible: edge.accessible,
    })),
  },
}

export default campusData
