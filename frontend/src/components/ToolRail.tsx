import { Route, Search, Settings } from 'lucide-react'
import { useApp } from '../state/store'

/**
 * Slim vertical tool rail on the right edge: search focus, directions
 * toggle, and the admin entry point.
 */
export default function ToolRail() {
  const { view, setView, setDirectionsOpen, directionsOpen, admin } = useApp()

  const focusSearch = () => {
    const input = document.querySelector<HTMLInputElement>('.search__input')
    input?.focus()
  }

  return (
    <nav className="tool-rail" aria-label="Map tools">
      <button
        type="button"
        className="tool-rail__button"
        aria-label="Search"
        title="Search"
        onClick={focusSearch}
      >
        <Search size={17} />
      </button>
      <button
        type="button"
        className={`tool-rail__button ${directionsOpen ? 'is-active' : ''}`}
        aria-label="Directions"
        title="Directions"
        onClick={() => setDirectionsOpen(!directionsOpen)}
      >
        <Route size={17} />
      </button>
      <button
        type="button"
        className="tool-rail__button"
        aria-label="Admin"
        title={admin ? 'Content admin' : 'Admin sign in'}
        onClick={() => setView(view === 'admin' ? 'map' : 'admin')}
      >
        <Settings size={17} />
      </button>
    </nav>
  )
}
