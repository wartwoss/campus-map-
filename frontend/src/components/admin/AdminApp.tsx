import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { LogOut, Plus, Save, Trash2, Upload } from 'lucide-react'
import type { FloorData, PlaceData } from '../../types'
import {
  adminCreatePlace,
  adminDeletePlace,
  adminListPlaces,
  adminSetPublishStatus,
  adminUpdatePlace,
  adminUploadFloorPlan,
  login,
} from '../../lib/api'
import { CATEGORY_OPTIONS, categoryLabel, categorySvg } from '../../lib/categories'
import { placeContext } from '../../lib/search'
import { useApp } from '../../state/store'
import PlanEditor from './PlanEditor'

interface DraftPlace {
  name: string
  category: string
  aliases: string
  description: string
  building_id: number | null
  floor_id: number | null
  position_campus_x: string
  position_campus_y: string
  position_floor: { x: number; y: number } | null
  hours: string
  menu: { name: string; price: string }[]
  timetable: { route: string; destination: string; times: string }[]
  pairs: { key: string; value: string }[]
  source: string
  verified_at: string
}

function toDraft(place: PlaceData): DraftPlace {
  const details = place.details ?? {}
  const pairs: { key: string; value: string }[] = []
  for (const [key, value] of Object.entries(details)) {
    if (key === 'menu' || key === 'timetable' || key === 'hours') continue
    pairs.push({ key, value: String(value) })
  }

  return {
    name: place.name,
    category: place.category,
    aliases: (place.aliases ?? []).join(', '),
    description: place.description ?? '',
    building_id: place.building_id,
    floor_id: place.floor_id,
    position_campus_x: place.position_campus?.x !== undefined ? String(place.position_campus.x) : '',
    position_campus_y: place.position_campus?.y !== undefined ? String(place.position_campus.y) : '',
    position_floor: place.position_floor,
    hours: typeof details.hours === 'string' ? details.hours : '',
    menu: (details.menu ?? []).map((item) => ({
      name: item.name,
      price: String(item.price),
    })),
    timetable: (details.timetable ?? []).map((entry) => ({
      route: entry.route,
      destination: entry.destination,
      times: entry.times.join(', '),
    })),
    pairs,
    source: place.source ?? '',
    verified_at: place.verified_at ?? '',
  }
}

function detailsFromDraft(draft: DraftPlace): Record<string, unknown> {
  const details: Record<string, unknown> = {}

  if (draft.hours.trim()) details.hours = draft.hours.trim()
  if (draft.category === 'cafe') {
    details.menu = draft.menu
      .filter((row) => row.name.trim())
      .map((row) => ({ name: row.name.trim(), price: Number(row.price) || 0 }))
  }
  if (draft.category === 'bus_stop') {
    details.timetable = draft.timetable
      .filter((row) => row.route.trim())
      .map((row) => ({
        route: row.route.trim(),
        destination: row.destination.trim(),
        times: row.times
          .split(',')
          .map((time) => time.trim())
          .filter(Boolean),
      }))
  }
  for (const pair of draft.pairs) {
    if (!pair.key.trim()) continue
    const key = pair.key.trim().replace(/\s+/g, '_').toLowerCase()
    const numeric = Number(pair.value)
    details[key] =
      pair.value.trim() !== '' && !Number.isNaN(numeric) && /^-?\d+(\.\d+)?$/.test(pair.value.trim())
        ? numeric
        : pair.value.trim()
  }

  return details
}

function LoginCard() {
  const { backendOnline, setAdmin } = useApp()
  const [email, setEmail] = useState('admin@campus.test')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!backendOnline) {
    return (
      <div className="admin-card admin-login">
        <h2>Content admin</h2>
        <p className="admin__hint">
          The Laravel API is not running. Start it with
          <code> php artisan serve</code> in the backend folder, then reload this page.
        </p>
      </div>
    )
  }

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      const session = await login(email, password)
      setAdmin(session)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Sign in failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="admin-card admin-login">
      <h2>Content admin</h2>
      <p className="admin__hint">
        Demo account: admin@campus.test with password demo-password.
      </p>
      {error && <div className="admin-error">{error}</div>}
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <label className="field">
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        <button type="submit" className="btn btn--primary" disabled={busy}>
          {busy ? 'Signing in' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}

export default function AdminApp() {
  const { admin, setAdmin, data, reload, setView } = useApp()
  const [places, setPlaces] = useState<PlaceData[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [draft, setDraft] = useState<DraftPlace | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [planBuildingId, setPlanBuildingId] = useState<number | null>(null)
  const [planFloorId, setPlanFloorId] = useState<number | null>(null)
  const [uploadMessage, setUploadMessage] = useState<string | null>(null)

  const buildingNames = useMemo(
    () => new Map((data?.buildings ?? []).map((b) => [b.id, b.name_en ?? b.name])),
    [data],
  )
  const floorNames = useMemo(() => {
    const map = new Map<number, string>()
    for (const building of data?.buildings ?? []) {
      for (const floor of building.floors) map.set(floor.id, floor.name)
    }
    return map
  }, [data])

  const refreshPlaces = useCallback(async () => {
    if (!admin) return
    try {
      setPlaces(await adminListPlaces(admin.token))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load places.')
    }
  }, [admin])

  useEffect(() => {
    if (admin) void refreshPlaces()
  }, [admin, refreshPlaces])

  useEffect(() => {
    if (!planBuildingId && data && data.buildings.length > 0) {
      const withFloors = data.buildings.find((b) => b.floors.length > 0)
      if (withFloors) {
        setPlanBuildingId(withFloors.id)
        setPlanFloorId(withFloors.floors[0]?.id ?? null)
      }
    }
  }, [data, planBuildingId])

  if (!admin) {
    return (
      <div className="admin">
        <div className="admin__inner">
          <LoginCard />
        </div>
      </div>
    )
  }

  const selected = places.find((p) => p.id === selectedId) ?? null
  const navigableBuildings = (data?.buildings ?? []).filter((b) => b.floors.length > 0)
  const planBuilding = navigableBuildings.find((b) => b.id === planBuildingId) ?? null
  const planFloor: FloorData | null =
    planBuilding?.floors.find((f) => f.id === planFloorId) ?? planBuilding?.floors[0] ?? null

  const selectPlace = (place: PlaceData) => {
    setSelectedId(place.id)
    setDraft(toDraft(place))
    setMessage(null)
    setError(null)
  }

  const savePlace = async () => {
    if (!admin || !draft || !selected) return
    setBusy(true)
    setError(null)
    setMessage(null)

    const positionCampus =
      draft.building_id === null && draft.position_campus_x !== '' && draft.position_campus_y !== ''
        ? { x: Number(draft.position_campus_x), y: Number(draft.position_campus_y) }
        : null

    try {
      const updated = await adminUpdatePlace(admin.token, selected.id, {
        name: draft.name,
        category: draft.category,
        aliases: draft.aliases
          .split(',')
          .map((a) => a.trim())
          .filter(Boolean),
        description: draft.description,
        building_id: draft.building_id,
        floor_id: draft.floor_id,
        position_campus: positionCampus,
        position_floor: draft.building_id !== null ? draft.position_floor : null,
        details: detailsFromDraft(draft),
        source: draft.source,
        verified_at: draft.verified_at !== '' ? draft.verified_at : null,
      } as Partial<PlaceData>)
      setPlaces((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
      setDraft(toDraft(updated))
      setMessage('Saved.')
      await reload()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Save failed.')
    } finally {
      setBusy(false)
    }
  }

  const togglePublish = async (place: PlaceData) => {
    if (!admin) return
    try {
      const updated = await adminSetPublishStatus(admin.token, place.id, place.status !== 'published')
      setPlaces((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
      if (selectedId === place.id) setDraft(toDraft(updated))
      await reload()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Publish change failed.')
    }
  }

  const removePlace = async (place: PlaceData) => {
    if (!admin) return
    try {
      await adminDeletePlace(admin.token, place.id)
      setPlaces((prev) => prev.filter((p) => p.id !== place.id))
      if (selectedId === place.id) {
        setSelectedId(null)
        setDraft(null)
      }
      await reload()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Delete failed.')
    }
  }

  const addPlace = async () => {
    if (!admin) return
    setBusy(true)
    setError(null)
    try {
      const created = await adminCreatePlace(admin.token, {
        name: 'New place',
        category: 'other',
        status: 'draft',
      } as Partial<PlaceData>)
      await refreshPlaces()
      selectPlace(created)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not create a place.')
    } finally {
      setBusy(false)
    }
  }

  const uploadPlan = async (file: File | null) => {
    if (!admin || !planFloor || !file) return
    setUploadMessage(null)
    setError(null)
    try {
      const floor = await adminUploadFloorPlan(admin.token, planFloor.id, file)
      setUploadMessage(`Uploaded plan for ${floor.id === planFloor.id ? planFloor.name : 'the floor'}.`)
      await reload()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Upload failed.')
    }
  }

  return (
    <div className="admin">
      <div className="admin__inner">
        <h2>Campus content admin</h2>
        <p className="admin__hint">
          Signed in as {admin.user.name}. Changes marked as drafts are hidden from the public map
          until published. Demo data is illustrative until campus-approved sources are provided.
        </p>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button type="button" className="btn" onClick={() => setView('map')}>
            Back to map
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              setAdmin(null)
              setSelectedId(null)
              setDraft(null)
            }}
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>

        {error && <div className="admin-error">{error}</div>}
        {!error && message && <div className="admin-ok">{message}</div>}

        <div className="admin-card">
          <h3>Places</h3>
          <div className="place-list">
            {places.map((place) => (
              <button
                key={place.id}
                type="button"
                className={`place-list__row ${place.id === selectedId ? 'is-active' : ''}`}
                onClick={() => selectPlace(place)}
              >
                <span
                  aria-hidden
                  dangerouslySetInnerHTML={{ __html: categorySvg(place.category, 15) }}
                />
                <span>
                  <span className="place-list__name">{place.name}</span>
                  <span className="place-list__context">
                    {placeContext(place, buildingNames, floorNames)}
                  </span>
                </span>
                <span
                  className={`status-tag status-tag--${place.status === 'published' ? 'published' : 'draft'}`}
                >
                  {place.status}
                </span>
              </button>
            ))}
          </div>
          <div style={{ marginTop: 10 }}>
            <button type="button" className="btn" onClick={() => void addPlace()} disabled={busy}>
              <Plus size={14} />
              Add place
            </button>
          </div>
        </div>

        {draft && selected && (
          <div className="admin-card">
            <h3>Edit: {selected.name}</h3>

            <div className="inline-fields">
              <label className="field">
                <span>Name</span>
                <input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </label>
              <label className="field">
                <span>Category</span>
                <select
                  value={draft.category}
                  onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                >
                  {CATEGORY_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {categoryLabel(option)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="field">
              <span>Aliases (comma separated)</span>
              <input
                value={draft.aliases}
                onChange={(e) => setDraft({ ...draft, aliases: e.target.value })}
              />
            </label>

            <label className="field">
              <span>Description</span>
              <textarea
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              />
            </label>

            <div className="inline-fields">
              <label className="field">
                <span>Building</span>
                <select
                  value={draft.building_id ?? ''}
                  onChange={(e) => {
                    const buildingId = e.target.value ? Number(e.target.value) : null
                    const building = data?.buildings.find((b) => b.id === buildingId)
                    setDraft({
                      ...draft,
                      building_id: buildingId,
                      floor_id: building?.floors[0]?.id ?? null,
                    })
                  }}
                >
                  <option value="">Campus grounds</option>
                  {(data?.buildings ?? []).map((building) => (
                    <option key={building.id} value={building.id}>
                      {building.name_en ?? building.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Floor</span>
                <select
                  value={draft.floor_id ?? ''}
                  disabled={draft.building_id === null}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      floor_id: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                >
                  {draft.building_id !== null &&
                    data?.buildings
                      .find((b) => b.id === draft.building_id)
                      ?.floors.map((floor) => (
                        <option key={floor.id} value={floor.id}>
                          {floor.name}
                        </option>
                      ))}
                </select>
              </label>
            </div>

            {draft.building_id === null ? (
              <div className="inline-fields">
                <label className="field">
                  <span>Campus position X</span>
                  <input
                    type="number"
                    value={draft.position_campus_x}
                    onChange={(e) =>
                      setDraft({ ...draft, position_campus_x: e.target.value })
                    }
                  />
                </label>
                <label className="field">
                  <span>Campus position Y</span>
                  <input
                    type="number"
                    value={draft.position_campus_y}
                    onChange={(e) =>
                      setDraft({ ...draft, position_campus_y: e.target.value })
                    }
                  />
                </label>
              </div>
            ) : (
              planFloor &&
              selected.floor_id !== null && (
                <div className="field">
                  <span>Marker position on {planFloor.name}</span>
                  <PlanEditor
                    floor={
                      data!.buildings
                        .flatMap((b) => b.floors)
                        .find((f) => f.id === selected.floor_id) ?? planFloor
                    }
                    places={places}
                    selectedPlaceId={selected.id}
                    onPickPosition={(x, y) =>
                      setDraft({ ...draft, position_floor: { x, y } })
                    }
                  />
                </div>
              )
            )}

            <hr style={{ border: 0, borderTop: '1px solid var(--line)', margin: '14px 0' }} />

            <label className="field">
              <span>Hours</span>
              <input
                value={draft.hours}
                placeholder="Mon-Fri 08:00-17:00"
                onChange={(e) => setDraft({ ...draft, hours: e.target.value })}
              />
            </label>

            {draft.category === 'cafe' && (
              <div className="field">
                <span>Menu items and prices</span>
                {draft.menu.map((row, index) => (
                  <div className="inline-fields" key={index} style={{ marginBottom: 6 }}>
                    <input
                      placeholder="Item name"
                      value={row.name}
                      onChange={(e) => {
                        const menu = [...draft.menu]
                        menu[index] = { ...menu[index], name: e.target.value }
                        setDraft({ ...draft, menu })
                      }}
                    />
                    <input
                      placeholder="Price"
                      style={{ maxWidth: 120 }}
                      type="number"
                      step="0.1"
                      value={row.price}
                      onChange={(e) => {
                        const menu = [...draft.menu]
                        menu[index] = { ...menu[index], price: e.target.value }
                        setDraft({ ...draft, menu })
                      }}
                    />
                    <button
                      type="button"
                      className="btn btn--icon btn--danger"
                      aria-label="Remove menu item"
                      onClick={() =>
                        setDraft({ ...draft, menu: draft.menu.filter((_, i) => i !== index) })
                      }
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="btn btn--small"
                  onClick={() =>
                    setDraft({ ...draft, menu: [...draft.menu, { name: '', price: '' }] })
                  }
                >
                  <Plus size={13} />
                  Add item
                </button>
              </div>
            )}

            {draft.category === 'bus_stop' && (
              <div className="field">
                <span>Bus timetable</span>
                {draft.timetable.map((row, index) => (
                  <div key={index} style={{ marginBottom: 8 }}>
                    <div className="inline-fields" style={{ marginBottom: 4 }}>
                      <input
                        placeholder="Route number"
                        style={{ maxWidth: 130 }}
                        value={row.route}
                        onChange={(e) => {
                          const timetable = [...draft.timetable]
                          timetable[index] = { ...timetable[index], route: e.target.value }
                          setDraft({ ...draft, timetable })
                        }}
                      />
                      <input
                        placeholder="Destination"
                        value={row.destination}
                        onChange={(e) => {
                          const timetable = [...draft.timetable]
                          timetable[index] = { ...timetable[index], destination: e.target.value }
                          setDraft({ ...draft, timetable })
                        }}
                      />
                      <button
                        type="button"
                        className="btn btn--icon btn--danger"
                        aria-label="Remove timetable entry"
                        onClick={() =>
                          setDraft({
                            ...draft,
                            timetable: draft.timetable.filter((_, i) => i !== index),
                          })
                        }
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <input
                      placeholder="Departure times, comma separated"
                      value={row.times}
                      onChange={(e) => {
                        const timetable = [...draft.timetable]
                        timetable[index] = { ...timetable[index], times: e.target.value }
                        setDraft({ ...draft, timetable })
                      }}
                    />
                  </div>
                ))}
                <button
                  type="button"
                  className="btn btn--small"
                  onClick={() =>
                    setDraft({
                      ...draft,
                      timetable: [
                        ...draft.timetable,
                        { route: '', destination: '', times: '' },
                      ],
                    })
                  }
                >
                  <Plus size={13} />
                  Add route
                </button>
              </div>
            )}

            {draft.category !== 'cafe' && draft.category !== 'bus_stop' && (
              <div className="field">
                <span>Extra details</span>
                {draft.pairs.map((row, index) => (
                  <div className="inline-fields" key={index} style={{ marginBottom: 6 }}>
                    <input
                      placeholder="Label"
                      value={row.key}
                      onChange={(e) => {
                        const pairs = [...draft.pairs]
                        pairs[index] = { ...pairs[index], key: e.target.value }
                        setDraft({ ...draft, pairs })
                      }}
                    />
                    <input
                      placeholder="Value"
                      value={row.value}
                      onChange={(e) => {
                        const pairs = [...draft.pairs]
                        pairs[index] = { ...pairs[index], value: e.target.value }
                        setDraft({ ...draft, pairs })
                      }}
                    />
                    <button
                      type="button"
                      className="btn btn--icon btn--danger"
                      aria-label="Remove detail"
                      onClick={() =>
                        setDraft({ ...draft, pairs: draft.pairs.filter((_, i) => i !== index) })
                      }
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="btn btn--small"
                  onClick={() =>
                    setDraft({ ...draft, pairs: [...draft.pairs, { key: '', value: '' }] })
                  }
                >
                  <Plus size={13} />
                  Add detail
                </button>
              </div>
            )}

            <div className="inline-fields">
              <label className="field">
                <span>Source</span>
                <input
                  value={draft.source}
                  onChange={(e) => setDraft({ ...draft, source: e.target.value })}
                />
              </label>
              <label className="field">
                <span>Verified on</span>
                <input
                  type="date"
                  value={draft.verified_at}
                  onChange={(e) => setDraft({ ...draft, verified_at: e.target.value })}
                />
              </label>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn--primary"
                disabled={busy}
                onClick={() => void savePlace()}
              >
                <Save size={14} />
                Save changes
              </button>
              <button type="button" className="btn" onClick={() => void togglePublish(selected)}>
                {selected.status === 'published' ? 'Unpublish' : 'Publish'}
              </button>
              <button
                type="button"
                className="btn btn--danger"
                onClick={() => void removePlace(selected)}
              >
                <Trash2 size={14} />
                Delete
              </button>
            </div>
          </div>
        )}

        {navigableBuildings.length > 0 && (
          <div className="admin-card">
            <h3>Floor plan images</h3>
            <div className="inline-fields">
              <label className="field">
                <span>Building</span>
                <select
                  value={planBuildingId ?? ''}
                  onChange={(e) => {
                    const id = e.target.value ? Number(e.target.value) : null
                    setPlanBuildingId(id)
                    const building = navigableBuildings.find((b) => b.id === id)
                    setPlanFloorId(building?.floors[0]?.id ?? null)
                    setUploadMessage(null)
                  }}
                >
                  {navigableBuildings.map((building) => (
                    <option key={building.id} value={building.id}>
                      {building.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Floor</span>
                <select
                  value={planFloor?.id ?? ''}
                  onChange={(e) => {
                    setPlanFloorId(e.target.value ? Number(e.target.value) : null)
                    setUploadMessage(null)
                  }}
                >
                  {(planBuilding?.floors ?? []).map((floor) => (
                    <option key={floor.id} value={floor.id}>
                      {floor.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {planFloor && (
              <Fragment>
                <p className="admin__hint" style={{ margin: '4px 0 10px' }}>
                  {planFloor.plan_image_url
                    ? 'This floor uses an uploaded plan image. Room outlines from the demo data are still used for the 3D view.'
                    : 'No plan image uploaded. The 3D view and editor fall back to room outlines.'}
                </p>
                {planFloor.plan_image_url && (
                  <img
                    src={planFloor.plan_image_url}
                    alt={`Plan for ${planFloor.name}`}
                    style={{
                      maxWidth: 320,
                      border: '1px solid var(--line-strong)',
                      borderRadius: 6,
                      display: 'block',
                      marginBottom: 10,
                    }}
                  />
                )}
                <label className="btn" style={{ display: 'inline-flex', cursor: 'pointer' }}>
                  <Upload size={14} />
                  Upload plan image
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => void uploadPlan(e.target.files?.[0] ?? null)}
                  />
                </label>
                {uploadMessage && (
                  <p className="admin__hint" style={{ marginTop: 8 }}>
                    {uploadMessage}
                  </p>
                )}
              </Fragment>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
