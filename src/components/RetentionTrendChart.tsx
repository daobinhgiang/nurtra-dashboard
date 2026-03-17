import type { RetentionTrendPoint } from '../hooks/useRetentionStats'

interface RetentionTrendChartProps {
  points: RetentionTrendPoint[]
  title?: string
  subtitle?: string
}

const WIDTH = 860
const HEIGHT = 280
const PADDING_LEFT = 42
const PADDING_RIGHT = 18
const PADDING_TOP = 16
const PADDING_BOTTOM = 34
const CHART_HEIGHT = HEIGHT - PADDING_TOP - PADDING_BOTTOM

function clampRate(value: number): number {
  return Math.max(0, Math.min(100, value))
}

function pointToY(rate: number): number {
  return PADDING_TOP + ((100 - clampRate(rate)) / 100) * CHART_HEIGHT
}

function pointsToPolyline(points: RetentionTrendPoint[], chartWidth: number): string {
  if (points.length === 0) return ''
  const stepX = points.length > 1 ? chartWidth / (points.length - 1) : 0
  return points
    .map((point, index) => {
      const x = PADDING_LEFT + stepX * index
      const y = pointToY(point.rate)
      return `${x},${y}`
    })
    .join(' ')
}

export default function RetentionTrendChart({
  points,
  title = 'Retention Curve',
  subtitle = 'X-axis: day since signup | Y-axis: retention rate',
}: RetentionTrendChartProps) {
  const dynamicWidth = Math.max(WIDTH, PADDING_LEFT + PADDING_RIGHT + points.length * 18)
  const chartWidth = dynamicWidth - PADDING_LEFT - PADDING_RIGHT
  const yTicks = [0, 25, 50, 75, 100]
  const stepX = points.length > 1 ? chartWidth / (points.length - 1) : 0

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
        <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
      </div>

      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${dynamicWidth} ${HEIGHT}`}
          className="h-[280px]"
          style={{ width: `${dynamicWidth}px`, minWidth: '100%' }}
          role="img"
          aria-label="Retention curve chart by day"
        >
          {yTicks.map((tick) => {
            const y = pointToY(tick)
            return (
              <g key={tick}>
                <line
                  x1={PADDING_LEFT}
                  y1={y}
                  x2={dynamicWidth - PADDING_RIGHT}
                  y2={y}
                  stroke="#e2e8f0"
                  strokeDasharray="3 3"
                />
                <text x={PADDING_LEFT - 8} y={y + 4} textAnchor="end" fontSize="10" fill="#64748b">
                  {tick}%
                </text>
              </g>
            )
          })}

          <polyline points={pointsToPolyline(points, chartWidth)} fill="none" stroke="#059669" strokeWidth="3" />

          {points.map((point, index) => {
            const x = PADDING_LEFT + stepX * index
            const y = pointToY(point.rate)
            return (
              <g key={point.day}>
                <circle cx={x} cy={y} r="2.5" fill="#059669" />
                <text x={x} y={HEIGHT - 10} textAnchor="middle" fontSize="9" fill="#64748b">
                  {point.day}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
