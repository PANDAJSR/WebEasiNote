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

  const maxDepth = Math.max(8, Math.min(width, height) * 0.35)
  const depthX = Math.min(maxDepth, width * 0.28)
  const depthY = Math.min(maxDepth, height * 0.20)
  const frontWidth = Math.max(1, width - depthX - strokeWidth)
  const frontHeight = Math.max(1, height - depthY - strokeWidth)

  const frontLeft = halfStroke
  const frontTop = depthY + halfStroke
  const frontRight = frontLeft + frontWidth
  const frontBottom = frontTop + frontHeight

  const backLeft = frontLeft + depthX
  const backTop = halfStroke
  const backRight = frontRight + depthX
  const backBottom = frontBottom - depthY

  const topFacePath = `M ${frontLeft} ${frontTop} L ${backLeft} ${backTop} L ${backRight} ${backTop} L ${frontRight} ${frontTop} Z`
  const rightFacePath = `M ${frontRight} ${frontTop} L ${backRight} ${backTop} L ${backRight} ${backBottom} L ${frontRight} ${frontBottom} Z`
  const frontFacePath = `M ${frontLeft} ${frontTop} L ${frontRight} ${frontTop} L ${frontRight} ${frontBottom} L ${frontLeft} ${frontBottom} Z`

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

        <path d={`M ${frontLeft} ${frontTop} L ${backLeft} ${backTop}`} fill='none' stroke={edgeColor} strokeWidth={strokeWidth} />
        <path d={`M ${backLeft} ${backTop} L ${backRight} ${backTop}`} fill='none' stroke={edgeColor} strokeWidth={strokeWidth} />
        <path d={`M ${backRight} ${backTop} L ${frontRight} ${frontTop}`} fill='none' stroke={edgeColor} strokeWidth={strokeWidth} />

        <path d={`M ${frontLeft} ${frontTop} L ${frontRight} ${frontTop}`} fill='none' stroke={edgeColor} strokeWidth={strokeWidth} />
        <path d={`M ${frontRight} ${frontTop} L ${frontRight} ${frontBottom}`} fill='none' stroke={edgeColor} strokeWidth={strokeWidth} />
        <path d={`M ${frontRight} ${frontBottom} L ${frontLeft} ${frontBottom}`} fill='none' stroke={edgeColor} strokeWidth={strokeWidth} />
        <path d={`M ${frontLeft} ${frontBottom} L ${frontLeft} ${frontTop}`} fill='none' stroke={edgeColor} strokeWidth={strokeWidth} />

        <path d={`M ${frontRight} ${frontTop} L ${backRight} ${backTop}`} fill='none' stroke={edgeColor} strokeWidth={strokeWidth} />
        <path d={`M ${backRight} ${backTop} L ${backRight} ${backBottom}`} fill='none' stroke={edgeColor} strokeWidth={strokeWidth} />
        <path d={`M ${backRight} ${backBottom} L ${frontRight} ${frontBottom}`} fill='none' stroke={edgeColor} strokeWidth={strokeWidth} />

        <path
          d={`M ${backLeft} ${backTop} L ${backLeft} ${backBottom}`}
          fill='none'
          stroke={edgeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={`${dashSize} ${dashSize}`}
          strokeLinecap='round'
        />
        <path
          d={`M ${backLeft} ${backBottom} L ${frontLeft} ${frontBottom}`}
          fill='none'
          stroke={edgeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={`${dashSize} ${dashSize}`}
          strokeLinecap='round'
        />
        <path
          d={`M ${backLeft} ${backBottom} L ${backRight} ${backBottom}`}
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
