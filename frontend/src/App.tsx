import { AppProvider, useApp } from './state/store'
import TopBar from './components/TopBar'
import ToolRail from './components/ToolRail'
import FloorChip from './components/FloorChip'
import CampusScene from './components/scene/CampusScene'
import InteriorPlanView from './components/interior/InteriorPlanView'
import FocusCard, { IntroCard } from './components/panels/FocusCard'
import PlacePanel from './components/panels/PlacePanel'
import DirectionsCard from './components/panels/DirectionsCard'
import AdminApp from './components/admin/AdminApp'

function Attribution() {
  return (
    <div className="attribution">
      © OpenStreetMap contributors · ODbL 1.0 · Mankato site plan. Floor plans: Minnesota State University, Mankato.
    </div>
  )
}

function MapView() {
  const { focusedBuildingId, selectedPlaceId, directionsOpen, interiorOpen } = useApp()

  return (
    <>
      <div className="stage">
        <CampusScene />
      </div>
      {interiorOpen && <InteriorPlanView />}

      <div className="left-stack">
        {focusedBuildingId === null ? <IntroCard /> : <FocusCard />}
        {selectedPlaceId !== null && <PlacePanel />}
        {directionsOpen && <DirectionsCard />}
      </div>

      <FloorChip />
      <ToolRail />
      {!interiorOpen && <Attribution />}
    </>
  )
}

function Root() {
  const { view, data } = useApp()

  if (data === null) {
    return (
      <>
        <TopBar />
        <main className="stage" style={{ display: 'grid', placeItems: 'start center', paddingTop: 90 }}>
          <p style={{ color: 'var(--ink-2)' }}>Loading campus data</p>
        </main>
      </>
    )
  }

  return (
    <>
      <TopBar />
      {view === 'admin' ? <AdminApp /> : <MapView />}
    </>
  )
}

export default function App() {
  return (
    <AppProvider>
      <Root />
    </AppProvider>
  )
}
