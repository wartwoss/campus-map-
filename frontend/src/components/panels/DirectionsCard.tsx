import { useState } from 'react'
import { ArrowUpDown, DoorOpen, Footprints, Route, X } from 'lucide-react'
import type { RouteResult, RouteStep } from '../../types'
import { computeRouteApi } from '../../lib/api'
import { useApp } from '../../state/store'

function StepIcon({ step }: { step: RouteStep }) {
  if (step.action === 'enter') return <DoorOpen size={16} className="route-step__icon" />
  if (step.action === 'elevator')
    return <ArrowUpDown size={16} className="route-step__icon route-step__icon--vertical" />
  if (step.action === 'stairs')
    return <Footprints size={16} className="route-step__icon route-step__icon--vertical" />
  return <Footprints size={16} className="route-step__icon" />
}

function stepSummary(step: RouteStep): string | null {
  if (step.action === 'walk' && step.distance !== undefined) {
    return `${step.distance} m`
  }
  return null
}

export default function DirectionsCard() {
  const {
    data,
    backendOnline,
    route,
    setRoute,
    routeTargetId,
    requestRouteTo,
    setDirectionsOpen,
    selectPlace,
    focusedBuildingId,
  } = useApp()

  const [fromId, setFromId] = useState<number | null>(null)
  const [toId, setToId] = useState<number | null>(routeTargetId ?? null)
  const [accessible, setAccessible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (data === null) return null

  const published = data.places.filter((p) => p.status === 'published')
  const effectiveTo = toId ?? routeTargetId

  const swap = () => {
    const nextFrom = effectiveTo
    setFromId(nextFrom)
    setToId(fromId)
    requestRouteTo(fromId)
  }

  const find = async () => {
    if (fromId === null || effectiveTo === null) return
    setBusy(true)
    setError(null)
    try {
      const result = await computeRouteApi(data, backendOnline, fromId, effectiveTo, accessible)
      setRoute(result)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not compute a route.')
      setRoute(null)
    } finally {
      setBusy(false)
    }
  }

  const current: RouteResult | null = route

  return (
    <section className="left-card directions" aria-label="Route planner">
      <div className="left-card__header">
        <Route size={16} aria-hidden />
        <h2 className="left-card__title" style={{ fontSize: 15 }}>
          Directions
        </h2>
        <button
          type="button"
          className="btn btn--icon left-card__close"
          aria-label="Close directions"
          onClick={() => {
            setDirectionsOpen(false)
            setRoute(null)
            requestRouteTo(null)
            setError(null)
          }}
        >
          <X size={15} />
        </button>
      </div>

      <div className="directions__fields">
        <label className="directions__field">
          <span>From</span>
          <select
            value={fromId ?? ''}
            onChange={(event) => setFromId(event.target.value ? Number(event.target.value) : null)}
          >
            <option value="">Choose a start</option>
            {published.map((place) => (
              <option key={place.id} value={place.id}>
                {place.name}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className="btn btn--icon directions__swap"
          aria-label="Swap start and destination"
          onClick={swap}
        >
          <ArrowUpDown size={14} />
        </button>

        <label className="directions__field">
          <span>To</span>
          <select
            value={effectiveTo ?? ''}
            onChange={(event) => {
              const id = event.target.value ? Number(event.target.value) : null
              requestRouteTo(id)
              setToId(id)
              if (id !== null && focusedBuildingId === null) selectPlace(id)
            }}
          >
            <option value="">Choose a destination</option>
            {published.map((place) => (
              <option key={place.id} value={place.id}>
                {place.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="directions__toggle">
        <input
          type="checkbox"
          checked={accessible}
          onChange={(event) => setAccessible(event.target.checked)}
        />
        Step-free route (elevator, no stairs)
      </label>

      <button
        type="button"
        className="btn btn--primary directions__find"
        disabled={fromId === null || effectiveTo === null || busy}
        onClick={() => void find()}
      >
        {busy ? 'Finding route' : 'Find route'}
      </button>

      {error && <div className="admin-error">{error}</div>}

      {current && (
        <div className="directions__result">
          <div className="route-summary">
            <div>
              Distance
              <strong>{current.total_distance} m</strong>
            </div>
            <div>
              About
              <strong>{current.estimated_minutes} min walk</strong>
            </div>
          </div>

          <div>
            {current.steps.map((step, index) => (
              <div key={index} className="route-step">
                <span className="route-step__index">{index + 1}</span>
                <StepIcon step={step} />
                <span className="route-step__text">
                  {step.text}
                  {stepSummary(step) && (
                    <em className="route-step__meta">{stepSummary(step)}</em>
                  )}
                </span>
              </div>
            ))}
          </div>

          {!backendOnline && (
            <p className="left-card__hint">Computed from demo data (API offline).</p>
          )}
        </div>
      )}
    </section>
  )
}
