import type { GeometryElement } from '../types'

interface GeometryRendererProps {
  element: GeometryElement
  scale: number
}

function buildPolylinePath(points: GeometryElement['geometries'][number]['points'], closePath = false): string {
  if (points.length === 0) return ''
  const segments = [`M ${points[0].x} ${points[0].y}`]
  for (let index = 1; index < points.length; index += 1) {
    segments.push(`L ${points[index].x} ${points[index].y}`)
  }
  if (closePath) segments.push('Z')
  return segments.join(' ')
}

function distance(
  pointA: GeometryElement['geometries'][number]['points'][number],
  pointB: GeometryElement['geometries'][number]['points'][number]
): number {
  const dx = pointA.x - pointB.x
  const dy = pointA.y - pointB.y
  return Math.sqrt(dx * dx + dy * dy)
}

function normalizeVector(x: number, y: number): { x: number; y: number } | null {
  const length = Math.sqrt(x * x + y * y)
  if (!Number.isFinite(length) || length <= 0.0001) return null
  return { x: x / length, y: y / length }
}

export function GeometryRenderer({ element, scale }: GeometryRendererProps) {
  const { x, y, width, height, rotation = 0, geometries, angles, marks } = element
  const shouldRenderMarks = geometries.length === 1
    && geometries[0].type === 'Ellipse'
    && Math.round(geometries[0].angleOfEllipse || 0) === 360
    && marks.length === 1

  return (
    <div
      style={{
        position: 'absolute',
        left: x * scale,
        top: y * scale,
        width: width * scale,
        height: height * scale,
        transform: rotation ? `rotate(${rotation}deg)` : undefined,
        transformOrigin: 'center center',
        pointerEvents: 'none'
      }}
    >
      <svg width={width * scale} height={height * scale} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block' }}>
        {geometries.map((geometry, index) => {
          const strokeColor = geometry.strokeColor || '#000000'
          const strokeWidth = geometry.strokeThickness > 0 ? geometry.strokeThickness : 2

          if (geometry.type === 'Ellipse') {
            return (
              <ellipse
                key={`ellipse-${index}`}
                cx={width / 2}
                cy={height / 2}
                rx={Math.max(0, width / 2 - strokeWidth / 2)}
                ry={Math.max(0, height / 2 - strokeWidth / 2)}
                fill='none'
                stroke={strokeColor}
                strokeWidth={strokeWidth}
              />
            )
          }

          if (geometry.type === 'Line') {
            const linePath = buildPolylinePath(geometry.points, false)
            if (!linePath) return null
            return (
              <path
                key={`line-${index}`}
                d={linePath}
                fill='none'
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                strokeLinecap='round'
              />
            )
          }

          if (geometry.type === 'Polygon') {
            const polygonPath = buildPolylinePath(geometry.points, true)
            if (!polygonPath) return null
            return (
              <path
                key={`polygon-${index}`}
                d={polygonPath}
                fill='none'
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                strokeLinejoin='round'
              />
            )
          }

          const fallbackPath = buildPolylinePath(geometry.points, false)
          if (!fallbackPath) return null
          return (
            <path
              key={`path-${index}`}
              d={fallbackPath}
              fill='none'
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              strokeLinecap='round'
              strokeLinejoin='round'
            />
          )
        })}

        {angles.map((angle, index) => {
          if (!angle.curPoint) return null

          const value = Math.round(angle.value)
          const prePoint = angle.prePoint
          const nextPoint = angle.nextPoint
          const canRenderArc = !!prePoint && !!nextPoint && value > 0 && value < 360

          if (!canRenderArc) {
            return (
              <text
                key={`angle-label-${index}`}
                x={angle.curPoint.x}
                y={angle.curPoint.y - 18}
                fill='#000000'
                fontSize='24'
                textAnchor='middle'
                dominantBaseline='middle'
              >
                {`${value}°`}
              </text>
            )
          }

          const toPre = normalizeVector(prePoint.x - angle.curPoint.x, prePoint.y - angle.curPoint.y)
          const toNext = normalizeVector(nextPoint.x - angle.curPoint.x, nextPoint.y - angle.curPoint.y)
          if (!toPre || !toNext) {
            return null
          }

          const edgeLength = Math.min(distance(prePoint, angle.curPoint), distance(nextPoint, angle.curPoint))
          const radius = Math.max(10, Math.min(24, edgeLength * 0.18))
          const arcStart = {
            x: angle.curPoint.x + toPre.x * radius,
            y: angle.curPoint.y + toPre.y * radius
          }
          const arcEnd = {
            x: angle.curPoint.x + toNext.x * radius,
            y: angle.curPoint.y + toNext.y * radius
          }
          const cross = toPre.x * toNext.y - toPre.y * toNext.x
          const sweepFlag = cross > 0 ? 1 : 0
          const smallArcFlag = value > 180 ? 1 : 0
          const arcPath = `M ${arcStart.x} ${arcStart.y} A ${radius} ${radius} 0 ${smallArcFlag} ${sweepFlag} ${arcEnd.x} ${arcEnd.y}`

          const bisector = normalizeVector(toPre.x + toNext.x, toPre.y + toNext.y)
          const labelRadius = radius + 18
          const labelX = bisector ? angle.curPoint.x + bisector.x * labelRadius : angle.curPoint.x
          const labelY = bisector ? angle.curPoint.y + bisector.y * labelRadius : angle.curPoint.y - 18

          return (
            <g key={`angle-${index}`}>
              <path d={arcPath} fill='none' stroke='#000000' strokeWidth={2} />
              <text
                x={labelX}
                y={labelY}
                fill='#000000'
                fontSize='24'
                textAnchor='middle'
                dominantBaseline='middle'
              >
                {`${value}°`}
              </text>
            </g>
          )
        })}

        {shouldRenderMarks && marks.map((mark, index) => (
          <circle key={`mark-${index}`} cx={mark.position.x} cy={mark.position.y} r={3} fill='#000000' />
        ))}
      </svg>
    </div>
  )
}
