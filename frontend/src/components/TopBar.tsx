import { useEffect, useRef, useState } from 'react'
import { MapPin, Search } from 'lucide-react'
import type { PlaceData } from '../types'
import { categorySvg } from '../lib/categories'
import { placeContext, searchPlaces } from '../lib/search'
import { useApp, type ThemeName } from '../state/store'

const THEMES: { key: ThemeName; label: string }[] = [
  { key: 'glacier', label: 'Glacier' },
  { key: 'tide', label: 'Tide' },
  { key: 'orchid', label: 'Orchid' },
]

function TopSearch() {
  const { data, selectPlace } = useApp()
  const [term, setTerm] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const buildingNames = new Map<number, string>()
  const floorNames = new Map<number, string>()
  for (const building of data?.buildings ?? []) {
    buildingNames.set(building.id, building.name_en ?? building.name)
    for (const floor of building.floors) floorNames.set(floor.id, floor.name)
  }

  const results = term.trim().length > 0 && data ? searchPlaces(data.places, term) : []

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const pick = (place: PlaceData) => {
    selectPlace(place.id)
    setOpen(false)
    setTerm('')
  }

  return (
    <div className="search" ref={containerRef}>
      <Search size={15} className="search__icon" aria-hidden />
      <input
        className="search__input"
        type="text"
        placeholder="Search the two campus buildings"
        value={term}
        aria-label="Search campus places"
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setTerm(event.target.value)
          setOpen(true)
          setActiveIndex(0)
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            setActiveIndex((i) => Math.min(i + 1, results.length - 1))
          } else if (event.key === 'ArrowUp') {
            event.preventDefault()
            setActiveIndex((i) => Math.max(i - 1, 0))
          } else if (event.key === 'Enter' && results[activeIndex]) {
            pick(results[activeIndex])
          } else if (event.key === 'Escape') {
            setOpen(false)
          }
        }}
      />
      {open && term.trim().length > 0 && (
        <div className="search__results">
          {results.length === 0 && <div className="search__empty">No matching places.</div>}
          {results.map((place, index) => (
            <button
              type="button"
              key={place.id}
              className={`search__result ${index === activeIndex ? 'search__result--active' : ''}`}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => pick(place)}
            >
              <span
                aria-hidden
                dangerouslySetInnerHTML={{ __html: categorySvg(place.category, 16) }}
              />
              <span>
                <span className="search__result-name">{place.name}</span>
                <span className="search__result-context">
                  {placeContext(place, buildingNames, floorNames)}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function TopBar() {
  const { theme, setTheme, data, backendOnline, view } = useApp()

  return (
    <header className="topbar">
      <div className="topbar__title">
        <MapPin size={18} aria-hidden />
        <h1>Campus Map</h1>
        <span>{data?.campus.name ?? 'Loading'}</span>
      </div>

      {view === 'map' && <TopSearch />}

      <div className="topbar__spacer" />

      {backendOnline === false && view === 'map' && (
        <span className="topbar__state">Local OpenStreetMap data</span>
      )}

      <div className="theme-switch" role="group" aria-label="Theme">
        {THEMES.map((item) => (
          <button
            key={item.key}
            type="button"
            className={theme === item.key ? 'is-active' : ''}
            onClick={() => setTheme(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>
    </header>
  )
}
