import type { CubeElement } from '../types'

interface CubeRendererProps {
  element: CubeElement
  scale: number
}

/**
 * 立方体渲染：可见边实线，遮挡边虚线
 */
export function CubeRenderer({ element, scale }: CubeRendererProps) {
  const { x, y, width, height, rotation, edgeThickness, edgeColor, topFillColor, frontFillColor, rightFillColor } = element
  const strokeWidth = Math.max(0.5, edgeThickness)
  const halfStroke = strokeWidth / 2
  const dashSize = Math.max(4, strokeWidth * 3)
  const depthX = Math.max(8, width * 0.30)
  const depthY = Math.max(8, height * 0.16)
  const skewY = Math.max(4, Math.min(height * 0.12, depthY * 0.85))

  const ax = halfStroke
  const ay = depthY + halfStroke
  const bx = Math.max(ax + 1, width - depthX - halfStroke)
  const by = ay + skewY
  const frontHeight = Math.max(1, height - depthY - skewY - strokeWidth)
  const dx = ax
  const dy = ay + frontHeight
  const cx = bx
  const cy = by + frontHeight

  const ex = ax + depthX
  const ey = ay - depthY
  const fx = bx + depthX
  const fy = by - depthY
  const hx = dx + depthX
  const hy = dy - depthY
  const gx = cx + depthX
  const gy = cy - depthY

  const topFacePath = `M ${ax} ${ay} L ${ex} ${ey} L ${fx} ${fy} L ${bx} ${by} Z`
  const rightFacePath = `M ${bx} ${by} L ${fx} ${fy} L ${gx} ${gy} L ${cx} ${cy} Z`
  const frontFacePath = `M ${ax} ${ay} L ${bx} ${by} L ${cx} ${cy} L ${dx} ${dy} Z`

  return (
    <div
      style={{
        position: 'absolute',
        left: x * scale,
        top: y * scale,
        width: width * scale,
        height: height * scale,
        transform: rotation ? `rotate(${rotation}deg)` : undefined,
        transformOrigin: 'center center'
      }}
    >
      <svg
        width={width * scale}
        height={height * scale}
        viewBox={`0 0 ${width} ${height}`}
        style={{ display: 'block' }}
      >
        <path d={topFacePath} fill={topFillColor} stroke='none' />
        <path d={rightFacePath} fill={rightFillColor} stroke='none' />
        <path d={frontFacePath} fill={frontFillColor} stroke='none' />

        <path d={`M ${ax} ${ay} L ${ex} ${ey}`} fill='none' stroke={edgeColor} strokeWidth={strokeWidth} />
        <path d={`M ${ex} ${ey} L ${fx} ${fy}`} fill='none' stroke={edgeColor} strokeWidth={strokeWidth} />
        <path d={`M ${fx} ${fy} L ${bx} ${by}`} fill='none' stroke={edgeColor} strokeWidth={strokeWidth} />

        <path d={`M ${ax} ${ay} L ${bx} ${by}`} fill='none' stroke={edgeColor} strokeWidth={strokeWidth} />
        <path d={`M ${bx} ${by} L ${cx} ${cy}`} fill='none' stroke={edgeColor} strokeWidth={strokeWidth} />
        <path d={`M ${cx} ${cy} L ${dx} ${dy}`} fill='none' stroke={edgeColor} strokeWidth={strokeWidth} />
        <path d={`M ${dx} ${dy} L ${ax} ${ay}`} fill='none' stroke={edgeColor} strokeWidth={strokeWidth} />

        <path d={`M ${bx} ${by} L ${fx} ${fy}`} fill='none' stroke={edgeColor} strokeWidth={strokeWidth} />
        <path d={`M ${fx} ${fy} L ${gx} ${gy}`} fill='none' stroke={edgeColor} strokeWidth={strokeWidth} />
        <path d={`M ${gx} ${gy} L ${cx} ${cy}`} fill='none' stroke={edgeColor} strokeWidth={strokeWidth} />

        <path
          d={`M ${ex} ${ey} L ${hx} ${hy}`}
          fill='none'
          stroke={edgeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={`${dashSize} ${dashSize}`}
          strokeLinecap='round'
        />
        <path
          d={`M ${hx} ${hy} L ${dx} ${dy}`}
          fill='none'
          stroke={edgeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={`${dashSize} ${dashSize}`}
          strokeLinecap='round'
        />
        <path
          d={`M ${hx} ${hy} L ${gx} ${gy}`}
          fill='none'
          stroke={edgeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={`${dashSize} ${dashSize}`}
          strokeLinecap='round'
        />
      </svg>
    </div>
  )
}
