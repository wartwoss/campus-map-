import { Html } from '@react-three/drei'
import type { PlaceData } from '../../types'
import { categorySvg } from '../../lib/categories'
import type { SceneColors } from './shared'

interface Props {
  places: PlaceData[]
  colors: SceneColors
  visible: boolean
  onSelectPlace: (id: number) => void
  selectedPlaceId: number | null
}

function OutdoorMarker({
  place,
  colors,
  onSelect,
  active,
}: {
  place: PlaceData
  colors: SceneColors
  onSelect: (id: number) => void
  active: boolean
}) {
  if (place.position_campus === null) return null
  const x = place.position_campus.x
  const y = place.position_campus.y

  return (
    <group
      position={[x, 0, y]}
      onClick={(event) => {
        event.stopPropagation()
        onSelect(place.id)
      }}
    >
      <mesh position={[0, 1.2, 0]}>
        <cylinderGeometry args={[0.7, 0.95, 2.4, 12]} />
        <meshLambertMaterial color={active ? colors.accent : colors.primary} />
      </mesh>
      <mesh position={[0, 2.7, 0]}>
        <sphereGeometry args={[0.65, 12, 10]} />
        <meshLambertMaterial color={active ? colors.accent : colors.primary} />
      </mesh>
      <Html position={[0, 3.9, 0]} center distanceFactor={240} zIndexRange={[200, 0]}>
        <button
          type="button"
          className={`campus-marker ${active ? 'is-active' : ''}`}
          onClick={(event) => {
            event.stopPropagation()
            onSelect(place.id)
          }}
        >
          <span aria-hidden dangerouslySetInnerHTML={{ __html: categorySvg(place.category, 13) }} />
          {place.name}
        </button>
      </Html>
    </group>
  )
}

export default function OutdoorMarkers({
  places,
  colors,
  visible,
  onSelectPlace,
  selectedPlaceId,
}: Props) {
  if (!visible) return null

  return (
    <group>
      {places
        .filter((place) => place.position_campus !== null && place.status === 'published' && place.category !== 'landmark')
        .map((place) => (
          <OutdoorMarker
            key={place.id}
            place={place}
            colors={colors}
            onSelect={onSelectPlace}
            active={place.id === selectedPlaceId}
          />
        ))}
    </group>
  )
}
