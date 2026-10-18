import type { ShapeElement } from '../../shapes'
import { buildFontFamily } from '../../font-utils'
import { resolveTextMarkers } from '../../text-markers'
import { convertSeewoLineSpacingToMultiplier } from '../../line-spacing'

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

export function ShapeInlineText({ element, scale, visualPadding }: { element: ShapeElement; scale: number; visualPadding: number }) {
  const { inlineText, width, height } = element
  const extraHorizontalPadding = 10 * scale

    if (!inlineText || inlineText.length === 0) return null

    const markers = resolveTextMarkers(inlineText)

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
          top: visualPadding * scale,
          left: visualPadding * scale,
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
                  const marker = markers[lineIndex]
                  if (!marker) return null
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
                        fontFamily: marker.fontFamily,
                        fontSize: (line.textRuns[0]?.fontSize || 16) * scale,
                        fontSynthesis: 'style weight',
                        color: firstRun?.color || '#000000',
                        opacity: firstRun?.opacity ?? 1,
                        lineHeight: 'inherit',
                        whiteSpace: 'pre'
                      }}
                    >
                      {marker.text}
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
