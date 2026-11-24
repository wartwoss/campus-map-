import { ArrowLeft, Building2, Info, Layers } from 'lucide-react'
import { categorySvg } from '../../lib/categories'
import { useApp } from '../../state/store'

/**
 * Left card for the focused building: identity, indoor places on the active
 * floor, and the way back to the campus overview.
 */
export default function FocusCard() {
  const {
    data,
    focusedBuildingId,
    clearFocus,
    activeFloorId,
    selectPlace,
    selectedPlaceId,
    enterInterior,
    interiorOpen,
  } = useApp()

  if (data === null || focusedBuildingId === null) return null

  const building = data.buildings.find((b) => b.id === focusedBuildingId)
  if (!building) return null

  const activeFloor =
    building.floors.find((f) => f.id === activeFloorId) ?? building.floors[0] ?? null
  const floorPlaces = building.navigable
    ? data.places.filter(
        (place) =>
          place.floor_id === activeFloor?.id && place.status === 'published',
      )
    : []

  return (
    <section className="left-card" aria-label={building.name}>
      <div className="left-card__header">
        <button
          type="button"
          className="btn btn--icon"
          aria-label="Back to campus overview"
          onClick={clearFocus}
        >
          <ArrowLeft size={15} />
        </button>
        <div>
          <h2 className="left-card__title">{building.name_en ?? building.name}</h2>
          <span className="left-card__subtitle">
            {building.name_en && building.name !== building.name_en ? building.name : ''}
            {building.code ? ` · ${building.code}` : ''}
          </span>
        </div>
      </div>

      {building.navigable ? (
        <>
          <div className="left-card__section">
            <p className="left-card__label">Places on {activeFloor?.name ?? 'this floor'}</p>
            {floorPlaces.length === 0 && (
              <p className="left-card__text">
                {activeFloor?.plan_image_url
                  ? 'This floor uses the university-published plan shown on the map.'
                  : activeFloor?.unmapped_note ?? 'No published places on this floor yet.'}
              </p>
            )}
            <div className="stack-list">
              {floorPlaces.map((place) => (
                <button
                  key={place.id}
                  type="button"
                  className={`stack-list__row ${place.id === selectedPlaceId ? 'is-active' : ''}`}
                  onClick={() => selectPlace(place.id)}
                >
                  <span
                    aria-hidden
                    dangerouslySetInnerHTML={{ __html: categorySvg(place.category, 15) }}
                  />
                  <span className="stack-list__name">{place.name}</span>
                </button>
              ))}
            </div>
            <p className="left-card__hint">
              {interiorOpen
                ? 'Switch floors with the level buttons at the bottom right.'
                : 'Interiors use the university-published floor plans.'}
            </p>
            {!interiorOpen && (
              <button
                type="button"
                className="btn btn--primary left-card__enter"
                onClick={enterInterior}
              >
                <Layers size={15} />
                Open floor plan
              </button>
            )}
          </div>
        </>
      ) : (
        <div className="left-card__section">
          <p className="left-card__text left-card__text--row">
            <Building2 size={15} />
            Interior map not added yet.
          </p>
          <p className="left-card__hint">
            Staff with admin access can upload floor plans and place markers for this
            building.
          </p>
        </div>
      )}
    </section>
  )
}

/** Small card shown over the campus overview when nothing is focused. */
export function IntroCard() {
  const { data, setDirectionsOpen } = useApp()
  if (data === null) return null

  return (
    <section className="left-card" aria-label="Campus overview">
      <div className="left-card__header">
        <div>
          <h2 className="left-card__title">{data.campus.name}</h2>
          <span className="left-card__subtitle">Mankato, Minnesota · Two-building campus</span>
        </div>
      </div>
      <div className="left-card__section">
        <p className="left-card__text">
          Open the Engineering Building or Medical School Building to view both
          floors, or follow the mapped road and walkway between them.
        </p>
        <button
          type="button"
          className="btn"
          onClick={() => setDirectionsOpen(true)}
        >
          <Info size={14} />
          Open directions
        </button>
      </div>
    </section>
  )
}
