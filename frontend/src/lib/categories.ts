import {
  Bus,
  Coffee,
  DoorClosed,
  DoorOpen,
  Landmark,
  Library,
  MapPin,
  Printer,
  type LucideIcon,
} from 'lucide-react'

export const CATEGORY_OPTIONS = [
  'cafe',
  'printer',
  'bus_stop',
  'room',
  'gate',
  'library',
  'landmark',
  'shop',
  'other',
] as const

const ICONS: Record<string, LucideIcon> = {
  cafe: Coffee,
  printer: Printer,
  bus_stop: Bus,
  room: DoorClosed,
  gate: DoorOpen,
  library: Library,
  landmark: Landmark,
  shop: MapPin,
}

export function categoryIcon(category: string): LucideIcon {
  return ICONS[category] ?? MapPin
}

export function categoryLabel(category: string): string {
  switch (category) {
    case 'bus_stop':
      return 'Bus stop'
    default:
      return category.charAt(0).toUpperCase() + category.slice(1)
  }
}

/**
 * Small inline SVG glyph per category, used inside Leaflet markers and the
 * 2D plan editor where React components cannot be rendered directly.
 */
const GLYPHS: Record<string, string> = {
  cafe:
    '<path d="M5 9h10v5a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4Z"/>' +
    '<path d="M15 10h1.5a2.5 2.5 0 0 1 0 5H15"/>' +
    '<path d="M7.5 3v2M10.5 3v2M13.5 3v2"/>',
  printer:
    '<rect x="6" y="3" width="9" height="5"/>' +
    '<rect x="4" y="8" width="13" height="5" rx="1"/>' +
    '<rect x="7" y="13" width="7" height="6"/>',
  bus_stop:
    '<rect x="4" y="3" width="12" height="13" rx="2"/>' +
    '<path d="M4 10h12"/>' +
    '<circle cx="7.5" cy="18" r="1.6"/>' +
    '<circle cx="12.5" cy="18" r="1.6"/>',
  room:
    '<rect x="7" y="3" width="9" height="16" rx="1"/>' +
    '<circle cx="13.5" cy="11.5" r="0.9" fill="currentColor"/>',
  gate:
    '<path d="M4 20V6l7-3v17"/>' +
    '<path d="M11 20h9"/>' +
    '<path d="M4 6l7-3"/>',
  library:
    '<path d="M4 19V8l4-2 4 2v11"/>' +
    '<path d="M12 19V8l4-2 4 2v11"/>' +
    '<path d="M3 19h18"/>',
  landmark:
    '<path d="M4 20V8l4-2 4 2v11"/>' +
    '<path d="M12 19V8l4-2 4 2v11"/>' +
    '<path d="M3 19h18"/>',
  shop:
    '<path d="M12 3a5 5 0 0 1 5 5c0 4-5 9-5 9s-5-5-5-9a5 5 0 0 1 5-5Z"/>' +
    '<circle cx="12" cy="8" r="1.6"/>',
}

export function categoryGlyph(category: string): string {
  return GLYPHS[category] ?? GLYPHS.shop
}

export function categorySvg(
  category: string,
  size = 14,
  extra = '',
): string {
  return (
    `<svg width="${size}" height="${size}" viewBox="0 0 22 22" fill="none" ` +
    `stroke="currentColor" stroke-width="1.8" stroke-linecap="round" ` +
    `stroke-linejoin="round" ${extra}>${categoryGlyph(category)}</svg>`
  )
}
