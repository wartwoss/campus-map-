import { useEffect, useMemo, useState } from 'react'
import { Html, Line } from '@react-three/drei'
import * as THREE from 'three'
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { FloorData, NavNodeData, PlaceData, RouteResult } from '../../types'
import { polygonCentroid } from '../../lib/floorplan'
import { buildWallPieces } from '../../lib/walls'
import { flatGeometry } from '../scene/shared'

/** Walls are cut away at this height. There are no ceilings or roofs. */
export const WALL_HEIGHT = 3.2
export const WALL_THICKNESS = 0.3

const SLAB_THICKNESS = 0.4
const ROOM_LIFT = 0.02
const ROUTE_Y = 0.6
const MARKER_Y = 0.35
const TAG_Y = 3.6

const ROOM_FILL: Record<string, string> = {
  corridor: '#dedede',
  cafe: '#e8e8e8',
  room: '#f7f7f7',
  hall: '#e8e8e8',
  service: '#dedede',
  toilets: '#d5d5d5',
  stair: '#cfcfcf',
  elevator: '#cfcfcf',
  printer: '#d7d7d7',
  library: '#e4e4e4',
  unmapped: '#d0d0d0',
}
const SELECTED_FILL = '#a4a4a4'
const WALL_COLOR = '#bcbcbc'
const SLAB_COLOR = '#dedede'

GlobalWorkerOptions.workerSrc = pdfWorkerUrl

interface FloorPlanAsset {
  texture: THREE.CanvasTexture
  walls: { a: Point2; b: Point2 }[]
}

type Point2 = [number, number]

/** Extract long horizontal/vertical wall runs from the university's PDF sheet. */
function detectPlanWalls(canvas: HTMLCanvasElement, size: { width: number; depth: number }): FloorPlanAsset['walls'] {
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return []
  const { width, height, data } = context.getImageData(0, 0, canvas.width, canvas.height)
  const horizontal = new Map<number, [number, number][]>()
  const vertical = new Map<number, [number, number][]>()
  const minH = Math.max(38, Math.round(width * 0.035))
  const minV = Math.max(38, Math.round(height * 0.035))
  const isInk = (x: number, y: number) => {
    const offset = (y * width + x) * 4
    return data[offset + 3] > 180 && data[offset] < 115 && data[offset + 1] < 115 && data[offset + 2] < 115
  }

  for (let y = 0; y < height; y += 2) {
    let start = -1
    for (let x = 0; x <= width; x++) {
      const ink = x < width && isInk(x, y)
      if (ink && start < 0) start = x
      if (!ink && start >= 0) {
        if (x - start >= minH) {
          const key = Math.round(y / 4) * 4
          const spans = horizontal.get(key) ?? []
          spans.push([start, x])
          horizontal.set(key, spans)
        }
        start = -1
      }
    }
  }
  for (let x = 0; x < width; x += 2) {
    let start = -1
    for (let y = 0; y <= height; y++) {
      const ink = y < height && isInk(x, y)
      if (ink && start < 0) start = y
      if (!ink && start >= 0) {
        if (y - start >= minV) {
          const key = Math.round(x / 4) * 4
          const spans = vertical.get(key) ?? []
          spans.push([start, y])
          vertical.set(key, spans)
        }
        start = -1
      }
    }
  }

  const walls: FloorPlanAsset['walls'] = []
  for (const [y, spans] of horizontal) {
    for (const [x0, x1] of spans) {
      walls.push({
        a: [(x0 / width) * size.width, (y / height) * size.depth],
        b: [(x1 / width) * size.width, (y / height) * size.depth],
      })
    }
  }
  for (const [x, spans] of vertical) {
    for (const [y0, y1] of spans) {
      walls.push({
        a: [(x / width) * size.width, (y0 / height) * size.depth],
        b: [(x / width) * size.width, (y1 / height) * size.depth],
      })
    }
  }
  return walls
}

function useSourcePlan(floor: FloorData): FloorPlanAsset | null {
  const [asset, setAsset] = useState<FloorPlanAsset | null>(null)
  useEffect(() => {
    let cancelled = false
    let texture: THREE.CanvasTexture | null = null
    const source = floor.plan_image_url
    if (!source) {
      setAsset(null)
      return
    }
    void (async () => {
      const loadingTask = getDocument({ url: source })
      const document = await loadingTask.promise
      const page = await document.getPage(1)
      const viewport = page.getViewport({ scale: 1.5 })
      const canvas = window.document.createElement('canvas')
      canvas.width = Math.ceil(viewport.width)
      canvas.height = Math.ceil(viewport.height)
      const context = canvas.getContext('2d', { alpha: false, willReadFrequently: true })
      if (!context) return
      await page.render({ canvas, canvasContext: context, viewport, background: '#ffffff' }).promise
      if (cancelled) {
        void loadingTask.destroy()
        return
      }
      texture = new THREE.CanvasTexture(canvas)
      texture.colorSpace = THREE.SRGBColorSpace
      texture.minFilter = THREE.LinearFilter
      texture.magFilter = THREE.LinearFilter
      texture.generateMipmaps = false
      setAsset({ texture, walls: detectPlanWalls(canvas, floor.size) })
    })().catch((error: unknown) => {
      console.error(`Could not load source plan ${source}`, error)
    })
    return () => {
      cancelled = true
      texture?.dispose()
    }
  }, [floor])
  return asset
}

interface Props {
  floor: FloorData
  places: PlaceData[]
  connectors: NavNodeData[]
  selectedPlaceId: number | null
  route: RouteResult | null
  accent: string
  routeColor: string
  /** Room and connector labels are DOM overlays, so they show only when the interior is open. */
  labels: boolean
  onSelectPlace: (id: number) => void
}

/**
 * Ceiling-free 3D plan of a single floor. Rooms are flat floor areas, walls
 * are continuous wall runs with door openings, and the floor is shown from
 * above. The parent positions and fades the group.
 */
export default function Interior3D({
  floor,
  places,
  connectors,
  selectedPlaceId,
  route,
  accent,
  routeColor,
  labels,
  onSelectPlace,
}: Props) {
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null)
  const { width, depth } = floor.size
  const sourcePlan = useSourcePlan(floor)

  const placesByName = useMemo(() => new Map(places.map((p) => [p.name, p])), [places])

  const walls = useMemo(() => {
    const fromRooms = buildWallPieces(floor, WALL_THICKNESS)
    return fromRooms.length > 0 ? fromRooms : sourcePlan?.walls ?? []
  }, [floor, sourcePlan])
  const wallGeometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), [])
  const wallMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: WALL_COLOR, roughness: 0.85 }),
    [],
  )
  const slabMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: SLAB_COLOR, roughness: 1 }),
    [],
  )
  const markerGeometry = useMemo(() => new THREE.SphereGeometry(0.5, 16, 12), [])
  const markerMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: accent, roughness: 0.6 }),
    [accent],
  )

  const rooms = useMemo(
    () =>
      floor.rooms.map((room) => ({
        room,
        geometry: flatGeometry(room.polygon),
        centre: polygonCentroid(room.polygon),
      })),
    [floor],
  )

  const roomMaterials = useMemo(() => {
    const materials = new Map<string, THREE.MeshStandardMaterial>()
    for (const type of Object.keys(ROOM_FILL)) {
      materials.set(type, new THREE.MeshStandardMaterial({ color: ROOM_FILL[type], roughness: 0.95 }))
    }
    materials.set('selected', new THREE.MeshStandardMaterial({ color: SELECTED_FILL, roughness: 0.9 }))
    return materials
  }, [])

  useEffect(() => {
    return () => {
      wallGeometry.dispose()
      wallMaterial.dispose()
      slabMaterial.dispose()
      markerGeometry.dispose()
      markerMaterial.dispose()
      for (const { geometry } of rooms) geometry.dispose()
      for (const material of roomMaterials.values()) material.dispose()
    }
  }, [wallGeometry, wallMaterial, slabMaterial, markerGeometry, markerMaterial, rooms, roomMaterials])

  const routePoints = useMemo(() => {
    if (!route) return []
    return route.nodes
      .filter((node) => node.floor_id === floor.id)
      .map((node) => [node.x, ROUTE_Y, node.y] as [number, number, number])
  }, [route, floor.id])

  const routeEnds = useMemo(() => {
    if (routePoints.length === 0) return null
    return { start: routePoints[0], end: routePoints[routePoints.length - 1] }
  }, [routePoints])

  return (
    <group position={[floor.origin.x, 0, floor.origin.y]}>
      {/* Base slab under the plan so the building reads as a solid in the top-down view. */}
      <mesh position={[width / 2, -SLAB_THICKNESS / 2, depth / 2]} material={slabMaterial}>
        <boxGeometry args={[width + 1.2, SLAB_THICKNESS, depth + 1.2]} />
      </mesh>

      {sourcePlan && (
        <mesh
          position={[width / 2, ROOM_LIFT, depth / 2]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[width, depth]} />
          <meshBasicMaterial map={sourcePlan.texture} side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
      )}

      {rooms.map(({ room, geometry, centre }) => {
        const place = room.place ? placesByName.get(room.place) ?? null : null
        const selected = room.id === selectedRoomId || (place !== null && place.id === selectedPlaceId)
        const material = selected
          ? roomMaterials.get('selected')!
          : roomMaterials.get(room.type) ?? roomMaterials.get('room')!
        return (
          <group key={room.id}>
            <mesh
              geometry={geometry}
              material={material}
              position={[0, ROOM_LIFT, 0]}
              onClick={(event) => {
                event.stopPropagation()
                setSelectedRoomId(room.id)
                if (place) onSelectPlace(place.id)
              }}
              onPointerOver={() => {
                document.body.style.cursor = place ? 'pointer' : 'default'
              }}
              onPointerOut={() => {
                document.body.style.cursor = ''
              }}
            />
            {place && (
              <mesh
                geometry={markerGeometry}
                material={markerMaterial}
                position={[centre[0], MARKER_Y, centre[1]]}
                scale={[0.5, 0.5, 0.5]}
              />
            )}
          </group>
        )
      })}

      {walls.map((wall, index) => {
        const dx = wall.b[0] - wall.a[0]
        const dy = wall.b[1] - wall.a[1]
        const length = Math.hypot(dx, dy)
        return (
          <mesh
            key={index}
            geometry={wallGeometry}
            material={wallMaterial}
            position={[(wall.a[0] + wall.b[0]) / 2, WALL_HEIGHT / 2, (wall.a[1] + wall.b[1]) / 2]}
            rotation={[0, -Math.atan2(dy, dx), 0]}
            scale={[length, WALL_HEIGHT, WALL_THICKNESS]}
          />
        )
      })}

      {routePoints.length > 1 && (
        <Line points={routePoints} color={routeColor} lineWidth={4} />
      )}
      {routeEnds && (
        <>
          <mesh position={routeEnds.start} scale={[0.35, 0.35, 0.35]}>
            <sphereGeometry args={[1, 14, 10]} />
            <meshStandardMaterial color="#ffffff" />
          </mesh>
          <mesh position={routeEnds.end} scale={[0.5, 0.5, 0.5]}>
            <sphereGeometry args={[1, 14, 10]} />
            <meshStandardMaterial color={routeColor} />
          </mesh>
        </>
      )}

      {labels &&
        rooms
          .filter(({ room }) => room.type !== 'unmapped')
          .map(({ room, centre }) => (
            <Html
              key={`label-${room.id}`}
              position={[centre[0], ROOM_LIFT + 0.1, centre[1]]}
              center
              zIndexRange={[20, 0]}
              style={{ pointerEvents: 'none' }}
            >
              <span className={`room-label ${room.type === 'corridor' ? 'is-corridor' : ''}`}>
                {room.name}
              </span>
            </Html>
          ))}

      {labels &&
        connectors.map((node) => (
          <Html
            key={node.key}
            position={[node.x, TAG_Y, node.y]}
            center
            zIndexRange={[30, 0]}
            style={{ pointerEvents: 'none' }}
          >
            <span className="interior-tag">{node.type === 'elevator' ? 'Lift' : 'Stairs'}</span>
          </Html>
        ))}
    </group>
  )
}
