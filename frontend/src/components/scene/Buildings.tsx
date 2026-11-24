import { useEffect, useMemo } from 'react'
import { Html, Line } from '@react-three/drei'
import * as THREE from 'three'
import type { BuildingData, CampusData } from '../../types'
import { extrudedGeometry, polygonCenter, type SceneColors } from './shared'

export type LabelTier = 'far' | 'mid' | 'near'

interface Props {
  data: CampusData
  colors: SceneColors
  focusedBuildingId: number | null
  tier: LabelTier
  onSelect: (id: number) => void
  showLabels?: boolean
}

function isLandmark(building: BuildingData): boolean {
  return building.visual_height >= 22 || /stadium|library|union|hall|center/i.test(building.name_en ?? building.name)
}

function displayName(building: BuildingData): string {
  return building.name_en ?? building.name
}

/**
 * Clean monochrome campus massings extruded from OSM building footprints.
 * One compact mesh per footprint keeps the larger Clemson map responsive.
 */
export default function Buildings({
  data,
  colors,
  focusedBuildingId,
  tier,
  onSelect,
  showLabels = true,
}: Props) {
  const entries = useMemo(
    () =>
      data.buildings.map((building) => ({
        building,
        geometry: extrudedGeometry(building.footprint, building.visual_height),
      })),
    [data],
  )

  const facade = useMemo(
    () => new THREE.MeshStandardMaterial({ color: colors.building, roughness: 0.94 }),
    [colors.building],
  )
  const selectedFacade = useMemo(
    () => new THREE.MeshStandardMaterial({ color: colors.buildingLine, roughness: 0.92 }),
    [colors.buildingLine],
  )
  const roof = useMemo(
    () => new THREE.MeshStandardMaterial({ color: colors.buildingRoof, roughness: 0.9 }),
    [colors.buildingRoof],
  )

  useEffect(() => {
    return () => {
      for (const { geometry } of entries) geometry.dispose()
      facade.dispose()
      selectedFacade.dispose()
      roof.dispose()
    }
  }, [entries, facade, selectedFacade, roof])

  const labels = useMemo(() => {
    if (!showLabels || tier === 'far') return []
    const eligible = focusedBuildingId !== null
      ? data.buildings.filter((building) => building.id === focusedBuildingId)
      : tier === 'mid'
        ? data.buildings.filter(isLandmark)
        : data.buildings.filter(isLandmark).concat(data.buildings.filter((building) => !isLandmark(building)).slice(0, 110))
    return eligible.map((building) => ({ building, name: displayName(building) }))
  }, [data, focusedBuildingId, showLabels, tier])

  return (
    <group>
      {entries.map(({ building, geometry }) => {
        const selected = building.id === focusedBuildingId
        const materials = [selected ? selectedFacade : facade, roof]
        return (
          <mesh
            key={building.id}
            geometry={geometry}
            material={materials}
            onClick={(event) => {
              event.stopPropagation()
              onSelect(building.id)
            }}
            onPointerOver={() => {
              document.body.style.cursor = 'pointer'
            }}
            onPointerOut={() => {
              document.body.style.cursor = ''
            }}
          />
        )
      })}

      {focusedBuildingId !== null && (() => {
        const focused = data.buildings.find((building) => building.id === focusedBuildingId)
        if (!focused) return null
        const ring = focused.footprint.map(([x, z]) => [x, 0.2, z] as [number, number, number])
        ring.push(ring[0])
        return <Line points={ring} color={colors.buildingLine} lineWidth={2.5} />
      })()}

      {labels.map(({ building, name }) => {
        const [x, z] = polygonCenter(building.footprint)
        const dim = focusedBuildingId !== null && focusedBuildingId !== building.id
        return (
          <Html
            key={building.id}
            position={[x, building.visual_height + 4, z]}
            center
            distanceFactor={190}
            zIndexRange={[120, 0]}
          >
            <button
              type="button"
              className={`building-label ${dim ? 'is-dim' : ''}`}
              style={{ opacity: dim ? 0.45 : 1 }}
              onClick={(event) => {
                event.stopPropagation()
                onSelect(building.id)
              }}
            >
              {name}
              {building.code ? ` · ${building.code}` : ''}
            </button>
          </Html>
        )
      })}
    </group>
  )
}
