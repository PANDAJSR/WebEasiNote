import type { ShapeElement } from '../shapes'
import { getShapeGeometry } from '../rendering/shapeGeometry'
import { ShapeInlineText } from './shape-renderer/ShapeInlineText'

interface ShapeRendererProps {
  element: ShapeElement
  scale: number
}

export function ShapeRenderer({ element, scale }: ShapeRendererProps) {
  const { x, y, rotation = 0, opacity = 1, backgroundColor, backgroundBrush, path, borderWidth, borderColor, shadow, reflection } = element
  const hasShapePaths = Boolean(element.shapePaths && element.shapePaths.length > 0)
  const { renderWidth, renderHeight, pathScaleX, pathScaleY, pathTranslateX, pathTranslateY, resolvedFillRule } = getShapeGeometry(element)
  const strokePadding = borderWidth && borderWidth > 0
    ? borderWidth / 2 + 1
    : 0

  const shadowOffsetX = shadow ? shadow.offset * Math.cos((shadow.angle * Math.PI) / 180) : 0
  const shadowOffsetY = shadow ? shadow.offset * Math.sin((shadow.angle * Math.PI) / 180) : 0
  const shadowBlur = shadow ? shadow.blurRadius : 0

  const getShadowColor = () => {
    if (!shadow) return undefined
    const color = shadow.color
    const opacity = shadow.opacity
    if (color.startsWith('rgba(')) {
      const match = color.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/)
      if (match) {
        return `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${(parseFloat(match[4]) * opacity).toFixed(2)})`
      }
    }
    if (color.startsWith('#')) {
      const r = parseInt(color.substr(1, 2), 16)
      const g = parseInt(color.substr(3, 2), 16)
      const b = parseInt(color.substr(5, 2), 16)
      return `rgba(${r}, ${g}, ${b}, ${opacity.toFixed(2)})`
    }
    return color
  }

  const shadowPadding = shadow
    ? Math.max(Math.abs(shadowOffsetX) + shadowBlur, Math.abs(shadowOffsetY) + shadowBlur)
    : 0
  const visualPadding = shadowPadding + strokePadding

  const hasReflection = !!reflection
  const reflectionOffset = hasReflection ? reflection.offsetY * scale : 0
  const reflectionOpacity = hasReflection ? reflection.opacity : 0
  const gradientStart = hasReflection ? reflection.gradientStart : 0
  const gradientEnd = hasReflection ? reflection.gradientEnd : 1

  const mainWidth = (renderWidth + visualPadding * 2) * scale
  const mainHeight = (renderHeight + visualPadding * 2) * scale

  // 使用 XML 渐变区间控制倒影长度，支持短/中/长差异
  const reflectionLengthRatio = hasReflection
    ? Math.max(0.05, Math.min(1, gradientEnd - gradientStart))
    : 0
  const reflectionVisibleHeight = mainHeight * reflectionLengthRatio
  const reflectionSourceOffset = Math.max(0, mainHeight - reflectionVisibleHeight)
  
  // 遮罩：保留接近正文的一侧更清晰，向下逐渐淡出
  const maskImage = hasReflection
    ? `linear-gradient(to top, rgba(0,0,0,1) ${Math.max(0, gradientStart * 100).toFixed(0)}%, rgba(0,0,0,0) ${Math.max(1, gradientEnd * 100).toFixed(0)}%)`
    : undefined

  const hasGradientBrush = backgroundBrush?.type === 'linear' || backgroundBrush?.type === 'radial'
  const fillGradientId = hasGradientBrush ? `bg-grad-${element.id}` : undefined
  const resolvedFill = fillGradientId ? `url(#${fillGradientId})` : backgroundColor
  const flipTransform = `${element.flipHorizontal ? 'scaleX(-1) ' : ''}${element.flipVertical ? 'scaleY(-1) ' : ''}`

  const renderShapeSvg = () => (
    <svg
      width={mainWidth}
      height={mainHeight}
      viewBox={`0 0 ${renderWidth + visualPadding * 2} ${renderHeight + visualPadding * 2}`}
      style={{
        display: 'block',
        transform: flipTransform ? flipTransform : undefined,
        transformOrigin: 'center center'
      }}
    >
      {hasGradientBrush && (
        <defs>
          {backgroundBrush.type === 'linear' && (
            <linearGradient
              id={fillGradientId}
              x1={`${backgroundBrush.startPoint.x * 100}%`}
              y1={`${backgroundBrush.startPoint.y * 100}%`}
              x2={`${backgroundBrush.endPoint.x * 100}%`}
              y2={`${backgroundBrush.endPoint.y * 100}%`}
            >
              {backgroundBrush.stops.map((s, idx) => (
                <stop key={idx} offset={`${(s.offset * 100).toFixed(1)}%`} stopColor={s.color} />
              ))}
            </linearGradient>
          )}
          {backgroundBrush.type === 'radial' && (
            <radialGradient
              id={fillGradientId}
              cx={`${backgroundBrush.center.x * 100}%`}
              cy={`${backgroundBrush.center.y * 100}%`}
              r={`${backgroundBrush.radiusX * 100}%`}
            >
              {backgroundBrush.stops.map((s, idx) => (
                <stop key={idx} offset={`${(s.offset * 100).toFixed(1)}%`} stopColor={s.color} />
              ))}
            </radialGradient>
          )}
        </defs>
      )}
      <g transform={`translate(${visualPadding + pathTranslateX} ${visualPadding + pathTranslateY}) scale(${pathScaleX} ${pathScaleY})`}>
        {hasShapePaths ? (
          element.shapePaths!.map((sp, spIdx) => {
            const isFilled = sp.isFilled && resolvedFill !== 'transparent' && resolvedFill !== 'none'
            const isStroke = sp.isStroke && Boolean(borderWidth && borderWidth > 0)
            if (!isFilled && !isStroke) return null
            return (
              <path
                key={spIdx}
                d={sp.path}
                fill={isFilled ? resolvedFill : 'none'}
                fillRule={sp.fillRule || resolvedFillRule}
                stroke={isStroke ? borderColor : 'none'}
                strokeWidth={isStroke ? (borderWidth || 1) : 0}
                strokeDasharray={element.strokeDashArray}
                strokeLinecap={element.dashStyle ? 'round' : undefined}
                vectorEffect='non-scaling-stroke'
              />
            )
          })
        ) : (
          <path
            d={path}
            fill={resolvedFill}
            fillRule={resolvedFillRule}
            stroke={borderColor}
            strokeWidth={borderWidth}
            strokeDasharray={element.strokeDashArray}
            strokeLinecap={element.dashStyle ? 'round' : undefined}
            vectorEffect='non-scaling-stroke'
          />
        )}
      </g>
    </svg>
  )

  const renderMainContent = () => (
    <>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: mainWidth,
          height: mainHeight,
          opacity,
          filter: shadow
            ? `drop-shadow(${shadowOffsetX * scale}px ${shadowOffsetY * scale}px ${shadowBlur * scale}px ${getShadowColor()})`
            : undefined,
        }}
      >
        {renderShapeSvg()}
      </div>
      <ShapeInlineText element={element} scale={scale} visualPadding={visualPadding} />
    </>
  )

  return (
    <div
      style={{
        position: 'absolute',
        left: (x - visualPadding) * scale,
        top: (y - visualPadding) * scale,
        width: mainWidth,
        height: mainHeight + (hasReflection ? reflectionVisibleHeight + reflectionOffset : 0),
        overflow: 'visible',
        transform: rotation ? `rotate(${rotation}deg)` : undefined,
        transformOrigin: 'center center',
      }}
    >
      {renderMainContent()}

      {hasReflection && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: mainHeight + reflectionVisibleHeight + reflectionOffset,
            width: mainWidth,
            height: reflectionVisibleHeight,
            transform: 'scaleY(-1)',
            transformOrigin: 'center top',
            opacity: reflectionOpacity,
            WebkitMaskImage: maskImage,
            maskImage: maskImage,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: -reflectionSourceOffset,
              width: mainWidth,
              height: mainHeight,
            }}
          >
            {renderMainContent()}
          </div>
        </div>
      )}
    </div>
  )
}
