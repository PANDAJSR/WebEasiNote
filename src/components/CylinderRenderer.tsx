import type { CylinderElement } from '../types'

interface CylinderRendererProps {
  element: CylinderElement
  scale: number
}

/**
 * 圆柱渲染：上椭圆 + 两条侧边 + 底部前实后虚
 */
export function CylinderRenderer({ element, scale }: CylinderRendererProps) {
  const { x, y, width, height, rotation, edgeThickness, edgeColor, topFillColor, sideFillColor, bottomFillColor } = element
  const strokeWidth = Math.max(0.5, edgeThickness)
  const strokeInset = strokeWidth / 2
  const rx = Math.max(1, (width - strokeWidth) / 2)
  const maxRy = Math.max(3, height / 3)
  const ry = Math.max(3, Math.min(maxRy, width * 0.11))
  const topCy = strokeInset + ry
  const bottomCy = Math.max(topCy + 1, height - strokeInset - ry)
  const leftX = strokeInset
  const rightX = Math.max(leftX + 1, width - strokeInset)
  const centerX = width / 2
  const dashSize = Math.max(4, strokeWidth * 3)
  const bottomBackArc = `M ${leftX} ${bottomCy} A ${rx} ${ry} 0 0 1 ${rightX} ${bottomCy}`
  const bottomFrontArc = `M ${leftX} ${bottomCy} A ${rx} ${ry} 0 0 0 ${rightX} ${bottomCy}`

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
          d={`M ${leftX} ${topCy} L ${rightX} ${topCy} L ${rightX} ${bottomCy} L ${leftX} ${bottomCy} Z`}
          fill={sideFillColor}
          stroke='none'
        />
        <ellipse cx={centerX} cy={topCy} rx={rx} ry={ry} fill={topFillColor} stroke={edgeColor} strokeWidth={strokeWidth} />
        <line x1={leftX} y1={topCy} x2={leftX} y2={bottomCy} stroke={edgeColor} strokeWidth={strokeWidth} />
        <line x1={rightX} y1={topCy} x2={rightX} y2={bottomCy} stroke={edgeColor} strokeWidth={strokeWidth} />
        <path
          d={bottomBackArc}
          fill='none'
          stroke={edgeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={`${dashSize} ${dashSize}`}
          strokeLinecap='round'
        />
        <path
          d={bottomFrontArc}
          fill={bottomFillColor}
          stroke={edgeColor}
          strokeWidth={strokeWidth}
          strokeLinecap='round'
        />
      </svg>
    </div>
  )
}
