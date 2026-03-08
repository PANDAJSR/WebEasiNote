import type { ShapeElement } from '../shapes'
import { buildFontFamily } from '../font-utils'
import { convertSeewoLineSpacingToMultiplier } from '../line-spacing'
import { estimatePathBounds, inferFillRule } from '../path-utils'

interface ShapeRendererProps {
  element: ShapeElement
  scale: number
}

function buildTextGradient(run: NonNullable<ShapeElement['inlineText']>[number]['textRuns'][number]): string | undefined {
  const gradient = run.gradient
  if (!gradient || gradient.stops.length === 0) return undefined

  const dx = gradient.endPoint.x - gradient.startPoint.x
  const dy = gradient.endPoint.y - gradient.startPoint.y
  const angle = Number.isFinite(dx) && Number.isFinite(dy) && (dx !== 0 || dy !== 0)
    ? (Math.atan2(dy, dx) * 180) / Math.PI + 90
    : 180
  const stops = gradient.stops
    .map(stop => `${stop.color} ${(stop.offset * 100).toFixed(2)}%`)
    .join(', ')

  return `linear-gradient(${angle.toFixed(2)}deg, ${stops})`
}

export function ShapeRenderer({ element, scale }: ShapeRendererProps) {
  const { x, y, width, height, opacity = 1, backgroundColor, path, fillRule, inlineText, borderWidth, borderColor, shadow, reflection } = element
  const extraHorizontalPadding = 14 * scale
  const markerCounters: Record<string, number> = {}
  const pathBounds = estimatePathBounds(path)
  const resolvedFillRule = fillRule || inferFillRule(path) || 'nonzero'
  const contentMinX = pathBounds ? Math.min(0, pathBounds.minX) : 0
  const contentMinY = pathBounds ? Math.min(0, pathBounds.minY) : 0
  const contentMaxX = pathBounds ? Math.max(width, pathBounds.maxX) : width
  const contentMaxY = pathBounds ? Math.max(height, pathBounds.maxY) : height
  const renderWidth = Math.max(1, contentMaxX - contentMinX)
  const renderHeight = Math.max(1, contentMaxY - contentMinY)
  const textOffsetX = -contentMinX
  const textOffsetY = -contentMinY
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

  // 倒影高度使用整块内容，避免文本与正文出现相对偏移
  const reflectionVisibleHeight = mainHeight
  
  // 遮罩：保留接近正文的一侧更清晰，向下逐渐淡出
  const maskImage = hasReflection
    ? `linear-gradient(to top, rgba(0,0,0,1) ${Math.max(0, gradientStart * 100).toFixed(0)}%, rgba(0,0,0,0) ${Math.max(1, gradientEnd * 100).toFixed(0)}%)`
    : undefined

  const renderShapeSvg = () => (
    <svg
      width={mainWidth}
      height={mainHeight}
      viewBox={`${contentMinX - visualPadding} ${contentMinY - visualPadding} ${renderWidth + visualPadding * 2} ${renderHeight + visualPadding * 2}`}
      style={{ display: 'block' }}
    >
      <path d={path} fill={backgroundColor} fillRule={resolvedFillRule} stroke={borderColor} strokeWidth={borderWidth} />
    </svg>
  )

  const renderInlineText = () => {
    if (!inlineText || inlineText.length === 0) return null

    const toLatin = (value: number, lower = false): string => {
      let n = value
      let result = ''
      while (n > 0) {
        n -= 1
        result = String.fromCharCode(65 + (n % 26)) + result
        n = Math.floor(n / 26)
      }
      return lower ? result.toLowerCase() : result
    }

    const toCircleNumber = (value: number): string => {
      const circleNumbers = ['⓪', '①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩', '⑪', '⑫', '⑬', '⑭', '⑮', '⑯', '⑰', '⑱', '⑲', '⑳']
      return circleNumbers[value] || `${value}`
    }

    const getMarkerText = (lineIndex: number): string | null => {
      const line = inlineText[lineIndex]
      if (!line?.textMarker || line.textMarker === 'None') return null

      const style = line.textMarkerStyle
      if (style?.char) return style.char

      const counterKey = `${line.textMarker}-${style?.autoNumberType || ''}-${style?.startAt || 1}`
      if (!(counterKey in markerCounters)) {
        markerCounters[counterKey] = (style?.startAt || 1) - 1
      }
      markerCounters[counterKey] += 1
      const n = markerCounters[counterKey]

      switch (line.textMarker) {
        case 'Circle':
          return '●'
        case 'Rect':
        case 'Box':
        case 'Square':
          return '■'
        case 'Tick':
          return '✓'
        case 'Decimal':
          return `${n}.`
        case 'Decimal1':
          return `(${n})`
        case 'Decimal2':
          return toCircleNumber(n)
        case 'UpperLatin':
          return `${toLatin(n)}.`
        case 'LowerLatin':
          return `${toLatin(n, true)}.`
        default:
          return '•'
      }
    }

    const getLineHeight = (line: NonNullable<ShapeElement['inlineText']>[number]): string => {
      if (line.fixedLineSpacing && line.fixedLineSpacing > 0) {
        return `${line.fixedLineSpacing * scale}px`
      }
      const multiplier = convertSeewoLineSpacingToMultiplier(line.lineSpacing)
      if (multiplier) {
        return `${multiplier}`
      }
      return 'normal'
    }

    return (
      <div
        style={{
          position: 'absolute',
          top: (textOffsetY + visualPadding) * scale,
          left: (textOffsetX + visualPadding) * scale,
          width: width * scale,
          height: height * scale,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
          boxSizing: 'border-box',
        }}
      >
        {inlineText.map((line, lineIndex) => (
          (() => {
            const hasRenderableText = line.textRuns.some(run => run.text.replace(/[\r\n]/g, '').length > 0)
            const firstRun = line.textRuns[0]

            return (
              <div
                key={lineIndex}
                style={{
                  width: '100%',
                  position: 'relative',
                  paddingLeft: (line.marginLeft || 0) * scale + extraHorizontalPadding,
                  paddingRight: extraHorizontalPadding,
                  textAlign: line.textAlignment.toLowerCase() as 'left' | 'center' | 'right',
                  lineHeight: getLineHeight(line),
                  marginTop: (line.spaceBefore || 0) * scale,
                  marginBottom: (line.spaceAfter || 0) * scale,
                  direction: line.direction === 'RightToLeft' ? 'rtl' : 'ltr',
                  whiteSpace: 'pre-wrap',
                  overflowWrap: 'anywhere',
                  wordBreak: 'break-all',
                  lineBreak: 'anywhere',
                  textIndent: line.indentType === 'FirstLine' && (line.indent || 0) !== 0
                    ? `${(line.indent || 0) * scale}px`
                    : undefined
                }}
              >
                {(() => {
                  const markerText = getMarkerText(lineIndex)
                  if (!markerText) return null
                  const markerAreaWidth = Math.max((line.indent || 0) * scale, 12 * scale)
                  const textStart = (line.marginLeft || 0) * scale + extraHorizontalPadding
                  const markerLeft = Math.max(0, textStart - markerAreaWidth)
                  return (
                    <span
                      style={{
                        position: 'absolute',
                        left: markerLeft,
                        top: 0,
                        width: markerAreaWidth,
                        textAlign: 'right',
                        paddingRight: 2 * scale,
                        fontFamily: buildFontFamily(line.textMarkerStyle?.fontFamily),
                        fontSize: (line.textRuns[0]?.fontSize || 16) * scale,
                        fontSynthesis: 'style weight',
                        color: firstRun?.color || '#000000',
                        opacity: firstRun?.opacity ?? 1,
                        lineHeight: 'inherit',
                        whiteSpace: 'pre'
                      }}
                    >
                      {markerText}
                    </span>
                  )
                })()}
                {hasRenderableText
                  ? line.textRuns.map((run, runIndex) => (
                    (() => {
                      const gradient = buildTextGradient(run)
                      const opacity = (run.opacity ?? 1) * (run.gradient?.opacity ?? 1)
                      return (
                        <span
                          key={runIndex}
                          style={{
                            fontFamily: buildFontFamily(run.fontFamily),
                            fontSize: run.fontSize * scale,
                            fontStyle: run.fontStyle,
                            fontWeight: run.fontWeight,
                            fontSynthesis: 'style weight',
                            color: gradient ? 'transparent' : run.color,
                            backgroundImage: gradient,
                            backgroundClip: gradient ? 'text' : undefined,
                            WebkitBackgroundClip: gradient ? 'text' : undefined,
                            WebkitTextFillColor: gradient ? 'transparent' : undefined,
                            opacity,
                            textDecoration: run.decoration === 'Underline' ? 'underline' : 'none',
                            whiteSpace: 'inherit',
                            overflowWrap: 'anywhere',
                            wordBreak: 'break-all',
                            lineBreak: 'anywhere'
                          }}
                        >
                          {run.text}
                        </span>
                      )
                    })()
                  ))
                  : (
                    <span
                      style={{
                        fontFamily: buildFontFamily(firstRun?.fontFamily),
                        fontSize: (firstRun?.fontSize || 16) * scale,
                        fontStyle: firstRun?.fontStyle || 'normal',
                        fontWeight: firstRun?.fontWeight || 'normal',
                        fontSynthesis: 'style weight',
                        color: firstRun?.color || '#000000',
                        opacity: firstRun?.opacity ?? 1,
                        textDecoration: firstRun?.decoration === 'Underline' ? 'underline' : 'none',
                        whiteSpace: 'inherit',
                        overflowWrap: 'anywhere',
                        wordBreak: 'break-all',
                        lineBreak: 'anywhere'
                      }}
                    >
                      {'\u00A0'}
                    </span>
                  )}
              </div>
            )
          })()
        ))}
      </div>
    )
  }

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
      {renderInlineText()}
    </>
  )

  return (
    <div
      style={{
        position: 'absolute',
        left: (x + contentMinX - visualPadding) * scale,
        top: (y + contentMinY - visualPadding) * scale,
        width: mainWidth,
        height: mainHeight + (hasReflection ? reflectionVisibleHeight + reflectionOffset : 0),
        overflow: 'visible',
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
          {renderMainContent()}
        </div>
      )}
    </div>
  )
}
