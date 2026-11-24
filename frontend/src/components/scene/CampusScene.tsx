import { useEffect, useMemo, useRef, useState, type ComponentRef, type RefObject } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Line, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { FloorData, RouteResult } from '../../types'
import { useApp } from '../../state/store'
import { polygonBounds, polygonCenter, readSceneColors, type SceneColors } from './shared'
import Ground from './Ground'
import Buildings, { type LabelTier } from './Buildings'
import OutdoorMarkers from './OutdoorMarkers'
import Interior3D from '../interior/Interior3D'
import { applyOpacity } from './transition'

interface CameraMemory {
  position: [number, number, number]
  target: [number, number, number]
}

/** Survives unmounting the exterior while the indoor plan is open. */
let cameraMemory: CameraMemory | null = null

/** Exponential approach rate (per second) for the exterior/interior swap and camera moves. */
const TRANSITION_RATE = 4.5
/** Caps the frame step so a slow frame does not skip the animation entirely. */
const MAX_STEP = 0.1

function easeStep(delta: number): number {
  return 1 - Math.exp(-TRANSITION_RATE * Math.min(delta, MAX_STEP))
}

function OutdoorRouteLine({ route, colors }: { route: RouteResult | null; colors: SceneColors }) {
  const points = useMemo(() => {
    if (!route) return null
    const outdoor = route.nodes.filter((node) => node.floor_id === null)
    if (outdoor.length < 2) return null
    return outdoor.map((node) => [node.x, 0.7, node.y] as [number, number, number])
  }, [route])

  if (!points) return null

  return <Line points={points} color={colors.route} lineWidth={3} dashed dashSize={6} gapSize={4} />
}

interface CameraCommand {
  position: [number, number, number]
  target: [number, number, number]
}

function CameraRig({ command }: { command: CameraCommand }) {
  const controlsRef = useRef<ComponentRef<typeof OrbitControls>>(null)
  const { camera } = useThree()
  const active = useRef(false)
  const first = useRef(true)

  useEffect(() => {
    if (first.current) {
      first.current = false
      if (cameraMemory) {
        camera.position.set(...cameraMemory.position)
        const controls = controlsRef.current as unknown as { target: THREE.Vector3; update: () => void } | null
        if (controls) {
          controls.target.set(...cameraMemory.target)
          controls.update()
        }
        return
      }
    }
    active.current = true
  }, [command, camera])

  useEffect(() => {
    const controls = controlsRef.current as unknown as {
      addEventListener: (event: string, handler: () => void) => void
    } | null
    controls?.addEventListener('start', () => {
      active.current = false
    })
  }, [])

  useFrame((_, delta) => {
    const controls = controlsRef.current as unknown as {
      target: THREE.Vector3
      update: () => void
    } | null
    if (!controls) return

    if (active.current) {
      const desiredPosition = new THREE.Vector3(...command.position)
      const desiredTarget = new THREE.Vector3(...command.target)
      const step = easeStep(delta)
      camera.position.lerp(desiredPosition, step)
      controls.target.lerp(desiredTarget, step)
      controls.update()
      if (camera.position.distanceTo(desiredPosition) < 0.8) active.current = false
    }

    cameraMemory = {
      position: [camera.position.x, camera.position.y, camera.position.z],
      target: [controls.target.x, controls.target.y, controls.target.z],
    }
  })

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      minPolarAngle={0.1}
      maxPolarAngle={1.35}
      minDistance={25}
      maxDistance={6000}
    />
  )
}

/** Distance-based label tier with hysteresis so labels do not flicker. */
function ZoomTierWatch({ onTier }: { onTier: (tier: LabelTier) => void }) {
  const { camera, controls } = useThree()
  const tier = useRef<LabelTier>('far')

  useFrame(() => {
    const target = (controls as unknown as { target?: THREE.Vector3 } | null)?.target
    if (!target) return
    const distance = camera.position.distanceTo(target)

    let next = tier.current
    if (tier.current === 'far' && distance < 2400) next = 'mid'
    else if (tier.current === 'mid' && distance > 2700) next = 'far'
    else if (tier.current === 'mid' && distance < 1200) next = 'near'
    else if (tier.current === 'near' && distance > 1400) next = 'mid'

    if (next !== tier.current) {
      tier.current = next
      onTier(next)
    }
  })

  return null
}

interface TransitionProps {
  /** 1 = interior shown, 0 = exterior shown. */
  target: number
  exteriorRef: RefObject<THREE.Group | null>
  interiorRef: RefObject<THREE.Group | null>
  /** Changing this re-applies opacity to freshly mounted content. */
  resetKey: string
  /** Reports when the interior is mostly visible, so its labels can appear. */
  onInteriorReady: (ready: boolean) => void
}

/**
 * Cross-fades the exterior campus and the interior plan inside the single
 * canvas. The exterior is hidden entirely once the interior is fully shown,
 * so its geometry costs nothing while indoors.
 */
function TransitionDriver({ target, exteriorRef, interiorRef, resetKey, onInteriorReady }: TransitionProps) {
  const progress = useRef(0)
  const applied = useRef(-1)
  const ready = useRef(false)

  useEffect(() => {
    applied.current = -1
  }, [resetKey])

  useFrame((_, delta) => {
    const current = progress.current
    let next = current + (target - current) * easeStep(delta)
    if (Math.abs(target - next) < 0.001) next = target
    progress.current = next

    const nowReady = target === 1 && next > 0.9
    if (nowReady !== ready.current) {
      ready.current = nowReady
      onInteriorReady(nowReady)
    }

    if (Math.abs(next - applied.current) < 1e-5) return
    applied.current = next

    const exterior = exteriorRef.current
    if (exterior) {
      exterior.visible = next < 0.999
      applyOpacity(exterior, 1 - next)
    }
    const interior = interiorRef.current
    if (interior) {
      interior.visible = next > 0.001
      applyOpacity(interior, next)
    }
  })

  return null
}

export default function CampusScene() {
  const {
    data,
    focusedBuildingId,
    activeFloorId,
    interiorOpen,
    selectedPlaceId,
    focusPlaceId,
    route,
    selectPlace,
    focusBuilding,
  } = useApp()

  const colors = readSceneColors()
  const [tier, setTier] = useState<LabelTier>('far')
  const [interiorReady, setInteriorReady] = useState(false)
  const exteriorRef = useRef<THREE.Group>(null)
  const interiorRef = useRef<THREE.Group>(null)

  const focusedBuilding = useMemo(
    () =>
      data && focusedBuildingId !== null
        ? data.buildings.find((building) => building.id === focusedBuildingId) ?? null
        : null,
    [data, focusedBuildingId],
  )

  /** Floor shown in the 3D interior. Kept mounted while the exterior is visible so the fade can run. */
  const interiorFloor = useMemo<FloorData | null>(() => {
    if (!focusedBuilding?.navigable || focusedBuilding.floors.length === 0) return null
    return focusedBuilding.floors.find((floor) => floor.id === activeFloorId) ?? focusedBuilding.floors[0]
  }, [focusedBuilding, activeFloorId])

  const interiorConnectors = useMemo(() => {
    if (!data || !interiorFloor) return []
    return data.graph.nodes.filter(
      (node) =>
        node.floor_id === interiorFloor.id && (node.type === 'stair' || node.type === 'elevator'),
    )
  }, [data, interiorFloor])

  const interiorPlaces = useMemo(() => {
    if (!data || !interiorFloor) return []
    return data.places.filter((place) => place.floor_id === interiorFloor.id && place.status === 'published')
  }, [data, interiorFloor])

  const command = useMemo<CameraCommand | null>(() => {
    if (!data) return null

    if (interiorOpen && interiorFloor) {
      // Top-down over the floor, with a slight tilt so the wall height reads.
      // The target sits left of the plan so it centres in the space to the
      // right of the left-hand cards.
      const { origin, size } = interiorFloor
      const cx = origin.x + size.width / 2
      const cz = origin.y + size.depth / 2
      const distance = Math.max(size.width, size.depth, 30) * 0.95
      return {
        position: [cx - distance * 0.14, distance, cz + distance * 0.25],
        target: [cx - distance * 0.14, 0, cz],
      }
    }

    const boundary = data.campus.features.boundary.ring
    const bounds = polygonBounds(boundary)
    const centerX = (bounds.minX + bounds.maxX) / 2
    const centerZ = (bounds.minY + bounds.maxY) / 2
    const extent = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY)

    if (focusedBuilding) {
      const [cx, cz] = polygonCenter(focusedBuilding.footprint)
      const buildingBounds = polygonBounds(focusedBuilding.footprint)
      const size = Math.max(
        buildingBounds.maxX - buildingBounds.minX,
        buildingBounds.maxY - buildingBounds.minY,
      )
      const height = focusedBuilding.visual_height
      return {
        position: [cx, Math.max(height * 1.25, size * 0.6 + 30), cz + size * 1.5 + 60],
        target: [cx, height * 0.4, cz],
      }
    }

    const place = focusPlaceId !== null ? data.places.find((p) => p.id === focusPlaceId) : null
    if (place?.position_campus) {
      return {
        position: [place.position_campus.x, 120, place.position_campus.y + 170],
        target: [place.position_campus.x, 0, place.position_campus.y],
      }
    }
    return {
      position: [centerX, extent * 1.32, centerZ + extent * 1.05],
      target: [centerX, 0, centerZ],
    }
  }, [data, focusedBuilding, focusPlaceId, interiorOpen, interiorFloor])

  if (data === null || command === null) return null

  const visibleTier: LabelTier = focusedBuilding ? 'near' : tier
  const showInterior = interiorOpen && interiorFloor !== null
  const labelFocusBuildingId = focusedBuildingId ??
    (focusPlaceId === null
      ? null
      : (data.places.find((place) => place.id === focusPlaceId)?.building_id ?? null))

  return (
    <Canvas
      className="stage__canvas"
      camera={{ fov: 38, near: 1, far: 10000, position: command.position }}
      gl={{ antialias: true, alpha: true }}
      dpr={[1, 2]}
      aria-label="3D campus map"
    >
      <ambientLight intensity={0.95} />
      <directionalLight position={[220, 380, 140]} intensity={0.85} />
      <directionalLight position={[-220, 200, -260]} intensity={0.35} />

      <group ref={exteriorRef}>
        <Ground data={data} colors={colors} />

        <Buildings
          data={data}
          colors={colors}
          focusedBuildingId={labelFocusBuildingId}
          tier={visibleTier}
          onSelect={focusBuilding}
          showLabels={!interiorOpen}
        />

        <OutdoorMarkers
          places={data.places}
          colors={colors}
          visible={!interiorOpen && focusedBuilding === null && tier !== 'far'}
          onSelectPlace={selectPlace}
          selectedPlaceId={selectedPlaceId}
        />

        <OutdoorRouteLine route={route} colors={colors} />
      </group>

      {interiorFloor && (
        <group ref={interiorRef}>
          <Interior3D
            key={interiorFloor.id}
            floor={interiorFloor}
            places={interiorPlaces}
            connectors={interiorConnectors}
            selectedPlaceId={selectedPlaceId}
            route={route}
            accent={colors.accent}
            routeColor={colors.route}
            labels={showInterior && interiorReady}
            onSelectPlace={selectPlace}
          />
        </group>
      )}

      <TransitionDriver
        target={showInterior ? 1 : 0}
        exteriorRef={exteriorRef}
        interiorRef={interiorRef}
        resetKey={`${focusedBuildingId ?? 'none'}-${interiorFloor?.id ?? 'none'}`}
        onInteriorReady={setInteriorReady}
      />
      <ZoomTierWatch onTier={setTier} />
      <CameraRig command={command} />
    </Canvas>
  )
}
