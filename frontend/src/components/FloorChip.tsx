import { Layers } from 'lucide-react'
import { useApp } from '../state/store'

/** Bottom-right floor selector, shown while a navigable building is focused. */
export default function FloorChip() {
  const { data, focusedBuildingId, activeFloorId, setActiveFloor, interiorOpen } = useApp()

  if (data === null || focusedBuildingId === null || !interiorOpen) return null

  const building = data.buildings.find((b) => b.id === focusedBuildingId)
  if (!building?.navigable || building.floors.length === 0) return null

  return (
    <div className="floor-chip" role="group" aria-label="Floor selection">
      <span className="floor-chip__label">
        <Layers size={13} aria-hidden />
        Level
      </span>
      <div className="floor-chip__buttons">
        {building.floors.map((floor) => (
          <button
            key={floor.id}
            type="button"
            className={floor.id === activeFloorId ? 'is-active' : ''}
            onClick={() => setActiveFloor(floor.id)}
          >
            {floor.name}
          </button>
        ))}
      </div>
    </div>
  )
}
