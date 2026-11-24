import { ArrowLeft, Building2, ExternalLink } from 'lucide-react'
import { useApp } from '../../state/store'

/**
 * HUD for the indoor view. The 3D floor is drawn by the scene canvas, which
 * stays mounted so the exterior-to-interior transition runs in place. This
 * overlay only adds the header, back control and data note.
 */
export default function InteriorPlanView() {
  const { data, focusedBuildingId, activeFloorId, exitInterior } = useApp()

  if (data === null || focusedBuildingId === null) return null

  const building = data.buildings.find((b) => b.id === focusedBuildingId)
  if (!building || building.floors.length === 0) return null

  const floor = building.floors.find((f) => f.id === activeFloorId) ?? building.floors[0]

  return (
    <div className="interior-view">
      <div className="interior-header">
        <button type="button" className="btn btn--small" onClick={exitInterior}>
          <ArrowLeft size={14} />
          Back to campus
        </button>
        <div className="interior-header__title">
          <h2>{building.name_en ?? building.name}</h2>
          <span>
            {building.name_en && building.name !== building.name_en ? `${building.name} · ` : ''}
            {floor.name}
          </span>
        </div>
        {floor.plan_status === 'demo' && (
          <span className="plan-badge" title={floor.plan_source ?? undefined}>
            DEMO layout
          </span>
        )}
      </div>

      <p className="interior-note">
        <Building2 size={13} />
        {floor.plan_status === 'demo' ? (
          'Schematic demo layout, not official university drawings.'
        ) : (
          <>
            Floor drawing: Minnesota State University, Mankato.
            {floor.plan_source && (
              <a href={floor.plan_source} target="_blank" rel="noreferrer">
                Source PDF <ExternalLink size={11} />
              </a>
            )}
          </>
        )}
      </p>
    </div>
  )
}
