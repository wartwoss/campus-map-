import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { CampusData, RouteResult } from '../types'
import { loadCampus, type AdminSession } from '../lib/api'

export type ThemeName = 'glacier' | 'tide' | 'orchid'
export type ViewMode = 'map' | 'admin'

interface AppState {
  theme: ThemeName
  setTheme: (theme: ThemeName) => void
  data: CampusData | null
  backendOnline: boolean
  reload: () => Promise<void>
  view: ViewMode
  setView: (view: ViewMode) => void

  /** Building the camera is zoomed into. Cutaway only when navigable. */
  focusedBuildingId: number | null
  focusBuilding: (id: number, floorId?: number | null) => void
  clearFocus: () => void

  selectedPlaceId: number | null
  selectPlace: (id: number | null) => void
  /** Outdoor place the camera should pan to. */
  focusPlaceId: number | null

  activeFloorId: number | null
  setActiveFloor: (floorId: number) => void

  /** Indoor plan view. When true the exterior scene is unmounted. */
  interiorOpen: boolean
  enterInterior: () => void
  exitInterior: () => void

  route: RouteResult | null
  setRoute: (route: RouteResult | null) => void
  routeTargetId: number | null
  requestRouteTo: (placeId: number | null) => void
  directionsOpen: boolean
  setDirectionsOpen: (open: boolean) => void

  admin: AdminSession | null
  setAdmin: (session: AdminSession | null) => void
}

const AppContext = createContext<AppState | null>(null)

const THEME_KEY = 'campusmap.theme'

export function AppProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>(
    () => (localStorage.getItem(THEME_KEY) as ThemeName | null) ?? 'glacier',
  )
  const [data, setData] = useState<CampusData | null>(null)
  const [backendOnline, setBackendOnline] = useState(false)
  const [view, setView] = useState<ViewMode>('map')
  const [focusedBuildingId, setFocusedBuildingId] = useState<number | null>(null)
  const [activeFloorId, setActiveFloorId] = useState<number | null>(null)
  const [selectedPlaceId, setSelectedPlaceId] = useState<number | null>(null)
  const [focusPlaceId, setFocusPlaceId] = useState<number | null>(null)
  const [route, setRoute] = useState<RouteResult | null>(null)
  const [routeTargetId, setRouteTargetId] = useState<number | null>(null)
  const [directionsOpen, setDirectionsOpen] = useState(false)
  const [interiorOpen, setInteriorOpen] = useState(false)
  const [admin, setAdmin] = useState<AdminSession | null>(null)

  const reload = useCallback(async () => {
    const { data, backendOnline } = await loadCampus()
    setData(data)
    setBackendOnline(backendOnline)
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const setTheme = useCallback((next: ThemeName) => {
    setThemeState(next)
    localStorage.setItem(THEME_KEY, next)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  const focusBuilding = useCallback(
    (id: number, floorId?: number | null) => {
      setFocusedBuildingId(id)
      setFocusPlaceId(null)

      const building = data?.buildings.find((b) => b.id === id)
      if (building?.navigable && building.floors.length > 0) {
        setActiveFloorId(typeof floorId === 'number' ? floorId : building.floors[0].id)
      } else {
        setActiveFloorId(null)
      }
    },
    [data],
  )

  const clearFocus = useCallback(() => {
    setFocusedBuildingId(null)
    setActiveFloorId(null)
    setSelectedPlaceId(null)
    setInteriorOpen(false)
  }, [])

  const selectPlace = useCallback(
    (id: number | null) => {
      setSelectedPlaceId(id)
      if (id === null) return

      const place = data?.places.find((p) => p.id === id)
      if (!place) return

      if (place.building_id !== null && place.floor_id !== null) {
        // Indoor place: open its building floor plan directly.
        setFocusedBuildingId(place.building_id)
        setActiveFloorId(place.floor_id)
        setFocusPlaceId(null)
        setInteriorOpen(true)
      } else {
        // Outdoor place: back to the campus view, pan to the place.
        setFocusedBuildingId(null)
        setActiveFloorId(null)
        setFocusPlaceId(id)
        setInteriorOpen(false)
      }
    },
    [data],
  )

  const setActiveFloor = useCallback((floorId: number) => {
    setActiveFloorId(floorId)
  }, [])

  const enterInterior = useCallback(() => {
    setInteriorOpen(true)
  }, [])

  const exitInterior = useCallback(() => {
    setInteriorOpen(false)
  }, [])

  const requestRouteTo = useCallback((placeId: number | null) => {
    setRouteTargetId(placeId)
    if (placeId !== null) setDirectionsOpen(true)
  }, [])

  const value = useMemo<AppState>(
    () => ({
      theme,
      setTheme,
      data,
      backendOnline,
      reload,
      view,
      setView,
      focusedBuildingId,
      focusBuilding,
      clearFocus,
      selectedPlaceId,
      selectPlace,
      focusPlaceId,
      activeFloorId,
      setActiveFloor,
      interiorOpen,
      enterInterior,
      exitInterior,
      route,
      setRoute,
      routeTargetId,
      requestRouteTo,
      directionsOpen,
      setDirectionsOpen,
      admin,
      setAdmin,
    }),
    [
      theme,
      setTheme,
      data,
      backendOnline,
      reload,
      view,
      focusedBuildingId,
      focusBuilding,
      clearFocus,
      selectedPlaceId,
      selectPlace,
      focusPlaceId,
      activeFloorId,
      setActiveFloor,
      interiorOpen,
      enterInterior,
      exitInterior,
      route,
      routeTargetId,
      requestRouteTo,
      directionsOpen,
      admin,
    ],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppState {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp must be used inside AppProvider')
  return context
}
