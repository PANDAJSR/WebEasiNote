import type { ConeElement } from '../types'

interface ConeRendererProps {
  element: ConeElement
  scale: number
}

/**
 * 圆锥渲染：顶点 + 两条母线 + 底面前实后虚
 */
export function ConeRenderer({ element, scale }: ConeRendererProps) {
  const { x, y, width, height, rotation, edgeThickness, edgeColor, sideFillColor, baseFillColor } = element
  const strokeWidth = Math.max(0.5, edgeThickness)
  const strokeInset = strokeWidth / 2
  const rx = Math.max(1, (width - strokeWidth) / 2)
  const maxRy = Math.max(3, height / 3)
  const ry = Math.max(3, Math.min(maxRy, width * 0.11))
  const apexX = width / 2
  const apexY = strokeInset
  const baseCy = Math.max(apexY + 1, height - strokeInset - ry)
  const leftX = strokeInset
  const rightX = Math.max(leftX + 1, width - strokeInset)
  const dashSize = Math.max(4, strokeWidth * 3)
  const baseBackArc = `M ${leftX} ${baseCy} A ${rx} ${ry} 0 0 1 ${rightX} ${baseCy}`
  const baseFrontArc = `M ${leftX} ${baseCy} A ${rx} ${ry} 0 0 0 ${rightX} ${baseCy}`

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
        opacity: 1
      }}
    >
      <svg
        width={width * scale}
        height={height * scale}
        viewBox={`0 0 ${width} ${height}`}
        style={{ display: 'block' }}
      >
        <path
          d={`M ${apexX} ${apexY} L ${rightX} ${baseCy} A ${rx} ${ry} 0 0 0 ${leftX} ${baseCy} Z`}
          fill={sideFillColor}
          stroke='none'
        />
        <path d={`M ${apexX} ${apexY} L ${leftX} ${baseCy}`} fill='none' stroke={edgeColor} strokeWidth={strokeWidth} />
        <path d={`M ${apexX} ${apexY} L ${rightX} ${baseCy}`} fill='none' stroke={edgeColor} strokeWidth={strokeWidth} />
        <path
          d={baseBackArc}
          fill='none'
          stroke={edgeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={`${dashSize} ${dashSize}`}
          strokeLinecap='round'
        />
        <path
          d={baseFrontArc}
          fill={baseFillColor}
          stroke={edgeColor}
          strokeWidth={strokeWidth}
          strokeLinecap='round'
        />
      </svg>
    </div>
  )
}
