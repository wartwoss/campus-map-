import { Fragment } from 'react'
import { Route, X } from 'lucide-react'
import type { PlaceDetails, PlaceData } from '../../types'
import { categoryIcon, categoryLabel, categorySvg } from '../../lib/categories'
import { useApp } from '../../state/store'

function CafeDetails({ details }: { details: PlaceDetails }) {
  return (
    <div className="left-card__section">
      <p className="left-card__label">Menu and prices</p>
      {details.hours && (
        <p className="left-card__text" style={{ marginBottom: 8 }}>
          Hours: {details.hours}
        </p>
      )}
      <div>
        {(details.menu ?? []).map((item) => (
          <div key={item.name} className="menu-row">
            <span className="menu-row__name">{item.name}</span>
            <span className="menu-row__price">{item.price.toFixed(0)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function BusTimetable({ details }: { details: PlaceDetails }) {
  return (
    <div className="left-card__section">
      <p className="left-card__label">Departures</p>
      {(details.timetable ?? []).map((entry) => (
        <div key={entry.route} className="timetable" style={{ marginBottom: 10 }}>
          <div className="timetable__head">
            <span>Route {entry.route}</span>
            <span>{entry.destination}</span>
          </div>
          <div className="timetable__times">
            {entry.times.map((time) => (
              <span key={time}>{time}</span>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function GridDetails({ details }: { details: PlaceDetails }) {
  const entries = Object.entries(details).filter(([key]) => key !== 'menu' && key !== 'timetable')
  if (entries.length === 0) return null

  return (
    <div className="left-card__section">
      <dl className="detail-grid">
        {entries.map(([key, value]) => (
          <Fragment key={key}>
            <dt>{key.replace(/_/g, ' ')}</dt>
            <dd>{String(value)}</dd>
          </Fragment>
        ))}
      </dl>
    </div>
  )
}

export default function PlacePanel() {
  const { data, selectedPlaceId, selectPlace, requestRouteTo } = useApp()
  if (data === null || selectedPlaceId === null) return null

  const place: PlaceData | undefined = data.places.find((p) => p.id === selectedPlaceId)
  if (!place) return null

  const building = data.buildings.find((b) => b.id === place.building_id)
  const floor = building?.floors.find((f) => f.id === place.floor_id)
  const Icon = categoryIcon(place.category)

  return (
    <section className="left-card place-card" aria-label={place.name}>
      <div className="left-card__header">
        <span
          aria-hidden
          dangerouslySetInnerHTML={{ __html: categorySvg(place.category, 22) }}
        />
        <div>
          <h2 className="left-card__title">{place.name}</h2>
          <span className="left-card__subtitle">
            <Icon size={13} />
            {categoryLabel(place.category)}
            {building && floor ? ` - ${building.name_en ?? building.name}, ${floor.name}` : ' - Campus grounds'}
          </span>
        </div>
        <button
          type="button"
          className="btn btn--icon left-card__close"
          aria-label="Close place panel"
          onClick={() => selectPlace(null)}
        >
          <X size={15} />
        </button>
      </div>

      {place.description && (
        <div className="left-card__section">
          <p className="left-card__text">{place.description}</p>
        </div>
      )}

      {place.details?.menu && <CafeDetails details={place.details} />}
      {place.details?.timetable && <BusTimetable details={place.details} />}
      {place.details && !place.details.menu && !place.details.timetable && (
        <GridDetails details={place.details} />
      )}

      <div className="left-card__section">
        <button
          type="button"
          className="btn btn--accent"
          onClick={() => requestRouteTo(place.id)}
        >
          <Route size={15} />
          Route here
        </button>
      </div>

      <p className="left-card__hint">
        {place.verified_at
          ? `Last verified ${place.verified_at}`
          : `Unverified${place.source ? ` - ${place.source}` : ''}`}
      </p>
    </section>
  )
}
