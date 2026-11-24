// Refresh the deliberately small Mankato two-building campus extract.
// Run from frontend/: node scripts/fetch-two-building-campus.mjs
// Campus/site geometry is OpenStreetMap (ODbL 1.0); plan PDF sources are linked
// and attributed per building in the generated JSON and campus-data README.

import { mkdirSync, writeFileSync } from 'node:fs'

const ORIGIN = { lat: 44.147, lng: -93.996 }
const BBOX = { west: -93.999, south: 44.145, east: -93.993, north: 44.150 }
const OUTPUT = 'src/data/two-building-campus.json'
const PDF_DIR = 'public/assets/floorplans'
const MAP_URL = `https://api.openstreetmap.org/api/0.6/map?bbox=${BBOX.west},${BBOX.south},${BBOX.east},${BBOX.north}`
const OSM_USER_AGENT = 'CampusMapNavigator/1.0 (OSM-derived two-building campus map)'
const PDFS = [
  ['tre-ground.pdf', 'https://mankato.mnsu.edu/globalassets/maps/university/buildings/2021/tre_01_firstfloor_2021.pdf'],
  ['tre-first.pdf', 'https://mankato.mnsu.edu/globalassets/maps/university/buildings/trafton-east-second-floor-plan.pdf'],
  ['csb-ground.pdf', 'https://mankato.mnsu.edu/globalassets/maps/university/buildings/2021/csb_01_firstfloor_2021.pdf'],
  ['csb-first.pdf', 'https://mankato.mnsu.edu/globalassets/maps/university/buildings/clinical-sciences-building-second-floor.pdf'],
]

mkdirSync(PDF_DIR, { recursive: true })
for (const [filename, url] of PDFS) {
  const pdfResponse = await fetch(url, { headers: { 'User-Agent': 'CampusMapNavigator/1.0 (source floor plan)' } })
  if (!pdfResponse.ok) throw new Error(`Floor plan request failed (${pdfResponse.status}): ${url}`)
  const bytes = new Uint8Array(await pdfResponse.arrayBuffer())
  if (new TextDecoder().decode(bytes.slice(0, 4)) !== '%PDF') throw new Error(`Not a PDF: ${url}`)
  writeFileSync(`${PDF_DIR}/${filename}`, bytes)
}

function readAttrs(text) {
  return Object.fromEntries([...text.matchAll(/([\w:.-]+)="([^"]*)"/g)].map((m) => [
    m[1], m[2].replaceAll('&amp;', '&').replaceAll('&quot;', '"'),
  ]))
}

function parseOsm(xml) {
  const nodes = new Map()
  for (const m of xml.matchAll(/<node\b([^>]*?)(?:\/>|>([\s\S]*?)<\/node>)/g)) {
    const attrs = readAttrs(m[1])
    if (attrs.id && attrs.lat && attrs.lon) nodes.set(attrs.id, { ...attrs, tags: parseTags(m[2] ?? '') })
  }
  const ways = []
  for (const m of xml.matchAll(/<way\b([^>]*)>([\s\S]*?)<\/way>/g)) {
    const attrs = readAttrs(m[1])
    ways.push({
      ...attrs,
      refs: [...m[2].matchAll(/<nd\b[^>]*ref="([^"]+)"/g)].map((nd) => nd[1]),
      tags: parseTags(m[2]),
    })
  }
  return { nodes, ways }
}

function parseTags(body) {
  return Object.fromEntries([...body.matchAll(/<tag\b([^>]*)\/?\s*>/g)].map((m) => {
    const attrs = readAttrs(m[1])
    return [attrs.k, attrs.v]
  }))
}

function project(node) {
  const metresPerLon = 111320 * Math.cos((ORIGIN.lat * Math.PI) / 180)
  return [
    Math.round((Number(node.lon) - ORIGIN.lng) * metresPerLon * 10) / 10,
    Math.round((ORIGIN.lat - Number(node.lat)) * 110574 * 10) / 10,
  ]
}

function center(points) {
  return [
    Math.round(points.reduce((sum, point) => sum + point[0], 0) / points.length * 10) / 10,
    Math.round(points.reduce((sum, point) => sum + point[1], 0) / points.length * 10) / 10,
  ]
}

function boxFor(points) {
  return points.reduce((b, [x, y]) => ({
    minX: Math.min(b.minX, x), minY: Math.min(b.minY, y),
    maxX: Math.max(b.maxX, x), maxY: Math.max(b.maxY, y),
  }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity })
}

function clipSegment(a, b, bounds) {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  let low = 0
  let high = 1
  for (const [p, q] of [[-dx, a[0] - bounds.minX], [dx, bounds.maxX - a[0]], [-dy, a[1] - bounds.minY], [dy, bounds.maxY - a[1]]]) {
    if (Math.abs(p) < 1e-8) {
      if (q < 0) return null
      continue
    }
    const t = q / p
    if (p < 0) low = Math.max(low, t)
    else high = Math.min(high, t)
    if (low > high) return null
  }
  return [
    [a[0] + low * dx, a[1] + low * dy],
    [a[0] + high * dx, a[1] + high * dy],
  ]
}

function clipLine(points, bounds) {
  const result = []
  for (let i = 1; i < points.length; i++) {
    const segment = clipSegment(points[i - 1], points[i], bounds)
    if (segment) result.push(...(result.length ? [segment[1]] : segment))
  }
  return result.filter((point, index) => index === 0 || Math.hypot(point[0] - result[index - 1][0], point[1] - result[index - 1][1]) > 0.1)
}

function floorPlan(id, buildingId, name, level, sourceUrl, imageUrl, size, origin) {
  return {
    id,
    building_id: buildingId,
    level,
    name,
    size,
    origin,
    rooms: [],
    doors: [],
    plan_status: 'official',
    plan_source: sourceUrl,
    plan_image_url: imageUrl,
  }
}

async function request(url) {
  const response = await fetch(url, { headers: { 'User-Agent': OSM_USER_AGENT } })
  if (!response.ok) throw new Error(`Request failed: ${response.status} ${url}`)
  return response
}

const response = await request(MAP_URL)
const { nodes, ways } = parseOsm(await response.text())
const wayById = new Map(ways.map((way) => [way.id, way]))
const candidates = ways.filter((way) => way.tags.building && way.refs.length > 3)
const engineeringWay = wayById.get('170831799')
const medicalWay = candidates.find((way) => /clinical sciences building/i.test(way.tags.name ?? ''))
if (!engineeringWay || !medicalWay) {
  throw new Error(`Required OSM footprint missing. Trafton East=${Boolean(engineeringWay)}; Clinical Sciences=${medicalWay?.id ?? 'not found'}`)
}

const buildingSpecs = [
  { source: engineeringWay, name: 'Engineering Building', code: 'ENG', sourceName: 'Trafton East' },
  { source: medicalWay, name: 'Medical School Building', code: 'MED', sourceName: 'Clinical Sciences Building' },
]
const buildings = buildingSpecs.map(({ source, name, code }, index) => {
  const footprint = source.refs.map((ref) => nodes.get(ref)).filter(Boolean).map(project)
  if (footprint.length > 2 && Math.hypot(...[footprint[0][0] - footprint.at(-1)[0], footprint[0][1] - footprint.at(-1)[1]]) < 0.2) footprint.pop()
  const bounds = boxFor(footprint)
  return {
    id: index + 1,
    osm_id: Number(source.id),
    name,
    name_en: name,
    code,
    footprint,
    visual_height: 12,
    navigable: true,
    _source_name: source.tags.name,
    _bounds: bounds,
  }
})

const floors = []
for (let i = 0; i < buildingSpecs.length; i++) {
  const { sourceName } = buildingSpecs[i]
  const building = buildings[i]
  const bounds = building._bounds
  const origin = { x: bounds.minX, y: bounds.minY }
  const size = { width: Math.max(20, bounds.maxX - bounds.minX), depth: Math.max(20, bounds.maxY - bounds.minY) }
  const sources = PDFS.slice(i * 2, i * 2 + 2)
  const prefix = i === 0 ? 'tre' : 'csb'
  floors.push(
    floorPlan(i * 2 + 1, building.id, 'Floor 1', 1, sources[0][1], `/assets/floorplans/${sources[0][0]}`, size, origin),
    floorPlan(i * 2 + 2, building.id, 'Floor 2', 2, sources[1][1], `/assets/floorplans/${sources[1][0]}`, size, origin),
  )
  // Keep the source pairing explicit in generated metadata.
  building.plan_set = prefix
  building.source_building_name = sourceName
  delete building._bounds
  delete building._source_name
}

const siteBox = boxFor(buildings.flatMap((building) => building.footprint))
const siteClip = {
  minX: siteBox.minX - 60,
  minY: siteBox.minY - 60,
  maxX: siteBox.maxX + 60,
  maxY: siteBox.maxY + 60,
}

const features = ways.flatMap((way) => {
  const highway = way.tags.highway
  if (!highway || !['footway', 'path', 'pedestrian', 'steps', 'service', 'track', 'residential', 'living_street', 'tertiary', 'secondary', 'primary', 'unclassified'].includes(highway)) return []
  const points = way.refs.map((ref) => nodes.get(ref)).filter(Boolean).map(project)
  const clipped = clipLine(points, siteClip)
  if (clipped.length < 2) return []
  const pedestrian = ['footway', 'path', 'pedestrian', 'steps'].includes(highway)
  return [{
    kind: pedestrian ? 'walkway' : 'road',
    osm_kind: highway,
    zone: 'campus',
    width: Number.parseFloat(way.tags.width ?? '') || (pedestrian ? 2.4 : 5.5),
    points: clipped,
  }]
})

const graphNodes = []
const graphEdges = []
for (const path of features) {
  let previousKey = null
  for (let i = 0; i < path.points.length; i++) {
    const point = path.points[i]
    const key = `osm:${point[0].toFixed(1)},${point[1].toFixed(1)}`
    if (!graphNodes.some((node) => node.key === key)) {
      graphNodes.push({ key, name: null, type: 'outdoor', x: point[0], y: point[1], building_id: null, floor_id: null, place_id: null })
    }
    if (previousKey && previousKey !== key) graphEdges.push({ from_key: previousKey, to_key: key, weight: null, kind: 'path', accessible: path.osm_kind !== 'steps' })
    previousKey = key
  }
}

const places = buildingSpecs.map(({ name, sourceName }, i) => {
  const building = buildings[i]
  const midpoint = center(building.footprint)
  const placeId = i + 1
  const key = `place:${placeId}`
  graphNodes.push({ key, name, type: 'poi', x: midpoint[0], y: midpoint[1], building_id: building.id, floor_id: null, place_id: placeId })
  let nearest = null
  let distance = Infinity
  for (const node of graphNodes) {
    if (node.type !== 'outdoor') continue
    const next = Math.hypot(node.x - midpoint[0], node.y - midpoint[1])
    if (next < distance) { distance = next; nearest = node }
  }
  if (nearest) graphEdges.push({ from_key: key, to_key: nearest.key, weight: null, kind: 'path', accessible: true })
  return {
    id: placeId,
    category: 'landmark',
    name,
    aliases: [sourceName],
    description: `${name} (${sourceName}), Minnesota State University, Mankato.`,
    details: null,
    building_id: building.id,
    floor_id: null,
    position_campus: { x: midpoint[0], y: midpoint[1] },
    position_floor: null,
    status: 'published',
    source: 'OpenStreetMap footprint and public university directory',
    verified_at: null,
  }
})

const boundary = boxFor(buildings.flatMap((building) => building.footprint))
const ring = [[boundary.minX - 25, boundary.minY - 25], [boundary.maxX + 25, boundary.minY - 25], [boundary.maxX + 25, boundary.maxY + 25], [boundary.minX - 25, boundary.maxY + 25]]
const source = {
  attribution: '© OpenStreetMap contributors, ODbL 1.0 (https://www.openstreetmap.org/copyright). Floor-plan drawings © Minnesota State University, Mankato; source links are recorded per floor.',
  retrieved_at: new Date().toISOString(),
  origin: ORIGIN,
  campus: {
    id: 2,
    name: 'Minnesota State University, Mankato',
    description: 'Two-building campus demo: Engineering Building (Trafton East) and Medical School Building (Clinical Sciences Building). Exterior roads and footprints are from OpenStreetMap. Interiors link to the university-published floor plans.',
    size: { width: boundary.maxX - boundary.minX + 50, height: boundary.maxY - boundary.minY + 50 },
    bounds: { minX: ring[0][0], minY: ring[0][1], maxX: ring[2][0], maxY: ring[2][1] },
    features: {
      boundary: { osm_way_id: 0, ring },
      paths: features,
      lawns: [],
      trees: [],
      labels: [],
    },
    base_image_url: null,
  },
  buildings: buildings.map(({ _bounds, _source_name, ...building }) => building),
  floors,
  places,
  graph: { nodes: graphNodes, edges: graphEdges },
}

writeFileSync(OUTPUT, `${JSON.stringify(source, null, 2)}\n`)
console.log(`Wrote ${OUTPUT}: ${buildings.length} buildings; ${floors.length} source-plan floors; ${features.length} mapped paths.`)
