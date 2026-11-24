import { useRef } from 'react'
import type { FloorData, PlaceData } from '../../types'

const SCALE = 10 // pixels per meter

interface Props {
  floor: FloorData
  places: PlaceData[]
  selectedPlaceId: number | null
  onPickPosition: (x: number, y: number) => void
}

export default function PlanEditor({ floor, places, selectedPlaceId, onPickPosition }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)

  const width = floor.size.width * SCALE
  const height = floor.size.depth * SCALE

  const handleClick = (event: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width) * floor.size.width
    const y = ((event.clientY - rect.top) / rect.height) * floor.size.depth
    onPickPosition(Math.round(x * 10) / 10, Math.round(y * 10) / 10)
  }

  return (
    <div>
      <div className="plan-editor">
        <svg
          ref={svgRef}
          className="plan-editor__svg"
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          onClick={handleClick}
          role="application"
          aria-label={`Floor plan editor for ${floor.name}`}
        >
          <rect x={0} y={0} width={width} height={height} fill="var(--surface-2)" />

          {floor.plan_image_url && (
            <image
              href={floor.plan_image_url}
              x={0}
              y={0}
              width={width}
              height={height}
              preserveAspectRatio="none"
            />
          )}

          {!floor.plan_image_url &&
            floor.rooms.map((room) => {
              const points = room.polygon
                .map(([x, y]) => `${x * SCALE},${y * SCALE}`)
                .join(' ')
              return (
                <g key={room.name}>
                  <polygon
                    points={points}
                    fill="var(--surface)"
                    stroke="var(--line-strong)"
                    strokeWidth={1.5}
                  />
                  <text
                    x={room.polygon[0][0] * SCALE + 4}
                    y={room.polygon[0][1] * SCALE + 14}
                    fontSize={10}
                    fill="var(--ink-2)"
                  >
                    {room.name}
                  </text>
                </g>
              )
            })}

          {places
            .filter((place) => place.floor_id === floor.id && place.position_floor)
            .map((place) => {
              const x = place.position_floor!.x * SCALE
              const y = place.position_floor!.y * SCALE
              const active = place.id === selectedPlaceId
              return (
                <g key={place.id} pointerEvents="none">
                  <circle
                    cx={x}
                    cy={y}
                    r={active ? 9 : 7}
                    fill={active ? 'var(--accent)' : 'var(--primary)'}
                    stroke="var(--surface)"
                    strokeWidth={2}
                    strokeDasharray={place.status === 'draft' ? '3 2' : undefined}
                  />
                  <text x={x + 11} y={y + 4} fontSize={11.5} fontWeight={700} fill="var(--ink)">
                    {place.name}
                  </text>
                </g>
              )
            })}
        </svg>
      </div>
      <p className="plan-editor__hint">
        Click on the plan to move the selected place marker to that position, then save.
      </p>
    </div>
  )
}
