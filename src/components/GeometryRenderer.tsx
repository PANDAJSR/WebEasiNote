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

export function GeometryRenderer({ element, scale }: GeometryRendererProps) {
  const { x, y, width, height, rotation = 0, geometries, angles, marks } = element

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
          return (
            <text
              key={`angle-${index}`}
              x={angle.curPoint.x}
              y={angle.curPoint.y - 18}
              fill='#000000'
              fontSize='24'
              textAnchor='middle'
              dominantBaseline='middle'
            >
              {`${Math.round(angle.value)}°`}
            </text>
          )
        })}

        {marks.map((mark, index) => (
          <circle key={`mark-${index}`} cx={mark.position.x} cy={mark.position.y} r={3} fill='#000000' />
        ))}
      </svg>
    </div>
  )
}
