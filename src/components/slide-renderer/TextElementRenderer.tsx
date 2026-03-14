import type { CSSProperties } from 'react'
import type { TextElement } from '../../parser'
import { buildFontFamily } from '../../font-utils'
import { convertSeewoLineSpacingToMultiplier } from '../../line-spacing'
import {
  buildTextGradient,
  getShadowStyle,
  getTextStrokeStyle,
  mergeOpacityToColor,
  toCircleNumber,
  toLatin
} from './text-style-utils'
const RULED_PAPER_TEXT_VERTICAL_OFFSET_RATIO = -0.12
const RULED_PAPER_CONTENT_PADDING_RATIO = 0.08
export function TextElementRenderer({ element, scale }: { element: TextElement; scale: number }) {
  const { x, y, width, height, textLines } = element
  const markerCounters: Record<string, number> = {}
  const textOuterPadding = 10 * scale
  const ruledPaper = element.ruledPaper
  const mainHeight = height * scale
  const renderedWidth = ruledPaper ? width * scale : (width + 2) * scale
  const ruledContentPadding = ruledPaper ? mainHeight * RULED_PAPER_CONTENT_PADDING_RATIO : 0
  const ruledRowCount = ruledPaper ? Math.max(1, textLines.length || 1) : 0
  const ruledUsableHeight = ruledPaper ? Math.max(1, mainHeight - ruledContentPadding * 2) : 0
  const ruledRowHeight = ruledPaper ? ruledUsableHeight / ruledRowCount : 0
  const containerPadding = ruledPaper ? ruledContentPadding : textOuterPadding
  const ruledTextVerticalOffset = ruledPaper ? ruledRowHeight * RULED_PAPER_TEXT_VERTICAL_OFFSET_RATIO : 0
  const getMarkerText = (lineIndex: number): string | null => {
    const line = textLines[lineIndex]
    if (!line?.textMarker || line.textMarker === 'None') return null
    const style = line.textMarkerStyle
    if (style?.char) {
      return style.char
    }
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
  const getLineHeight = (line: TextElement['textLines'][number]): string => {
    if (ruledPaper) {
      return '1'
    }
    if (line.fixedLineSpacing && line.fixedLineSpacing > 0) {
      return `${line.fixedLineSpacing * scale}px`
    }
    const multiplier = convertSeewoLineSpacingToMultiplier(line.lineSpacing)
    if (multiplier) {
      return `${multiplier}`
    }
    return 'normal'
  }
  const justifyContent = (() => {
    switch (element.verticalTextAlignment) {
      case 'Center':
        return 'center'
      case 'Bottom':
        return 'flex-end'
      default:
        return 'flex-start'
    }
  })()
  const reflectionEffect = (() => {
    for (const line of textLines) {
      for (const run of line.textRuns) {
        if (run.textEffects?.reflection) {
          return run.textEffects.reflection
        }
      }
    }
    return undefined
  })()
  const hasReflection = !!reflectionEffect
  const reflectionOffset = hasReflection ? reflectionEffect.distance * scale : 0
  const reflectionOpacity = hasReflection ? reflectionEffect.opacity : 0
  const reflectionDepth = hasReflection ? Math.min(1, Math.max(reflectionEffect.depth, 0.1)) : 0
  const estimateLineContentHeight = (line: TextElement['textLines'][number]): number => {
    const maxRunFontSize = Math.max(...line.textRuns.map(run => run.fontSize * scale), 16 * scale)
    if (ruledPaper) {
      return ruledRowHeight
    }
    if (line.fixedLineSpacing && line.fixedLineSpacing > 0) {
      return line.fixedLineSpacing * scale
    }
    const multiplier = convertSeewoLineSpacingToMultiplier(line.lineSpacing)
    if (multiplier) {
      return maxRunFontSize * multiplier
    }
    return maxRunFontSize * 1.2
  }
  const contentHeight = Math.max(
    textLines.reduce((sum, line) => sum + estimateLineContentHeight(line) + (line.spaceBefore || 0) * scale + (line.spaceAfter || 0) * scale, 0),
    1
  )
  const availableHeight = Math.max(mainHeight - containerPadding * 2, 0)
  const contentTopOffset = (() => {
    if (ruledPaper) return 0
    if (element.sizeToContent !== 'Manual' || availableHeight <= contentHeight) return containerPadding
    switch (element.verticalTextAlignment) {
      case 'Center':
        return containerPadding + (availableHeight - contentHeight) / 2
      case 'Bottom':
        return containerPadding + (availableHeight - contentHeight)
      default:
        return containerPadding
    }
  })()
  const textBottom = contentTopOffset + contentHeight
  const reflectionVisibleHeight = contentHeight
  const reflectionFadeStop = hasReflection
    ? Math.min(95, Math.max(20, (1 - reflectionDepth) * 100))
    : 0
  const textContainerStyle: CSSProperties = {
    width: renderedWidth,
    minHeight: mainHeight,
    height: element.sizeToContent === 'Manual' ? mainHeight : 'auto',
    boxSizing: 'border-box',
    padding: containerPadding,
    paddingRight: containerPadding,
    overflow: 'visible',
    pointerEvents: 'none',
    display: 'flex',
    flexDirection: 'column',
    justifyContent,
    border: element.borderType && element.borderType !== 'None' && (element.borderThickness || 0) > 0
      ? `${(element.borderThickness || 0) * scale}px solid #000000`
      : undefined,
    backgroundColor: ruledPaper?.backgroundColor,
    boxShadow: ruledPaper ? `0 ${(10 * scale).toFixed(2)}px ${(24 * scale).toFixed(2)}px rgba(0, 0, 0, 0.18)` : undefined,
    transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
    transformOrigin: 'center center',
    writingMode: element.arrangingType === 'Vertical' ? 'vertical-rl' : 'horizontal-tb'
  }
  const renderRuledPaperGuides = () => {
    if (!ruledPaper) return null
    const rowCount = ruledRowCount
    const rowHeight = ruledRowHeight
    const segment = rowHeight / 3
    const strokeColor = mergeOpacityToColor(ruledPaper.lineColor, ruledPaper.opacity)
    const strokeWidth = Math.max(1, scale)
    const lineY: number[] = []
    for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
      const rowStart = rowIndex * rowHeight
      lineY.push(
        ruledContentPadding + rowStart,
        ruledContentPadding + rowStart + segment,
        ruledContentPadding + rowStart + segment * 2,
        ruledContentPadding + rowStart + rowHeight
      )
    }
    return (
      <div
        style={{
          position: 'absolute',
          left: ruledContentPadding,
          top: 0,
          width: Math.max(0, renderedWidth - ruledContentPadding * 2),
          height: mainHeight,
          pointerEvents: 'none'
        }}
      >
        {lineY.map((yPos, index) => (
          (() => {
            const lineIndexInGroup = index % 4
            const lineThickness = lineIndexInGroup === 2 ? strokeWidth * 1.6 : strokeWidth
            return (
              <div
                key={index}
                style={{
                  position: 'absolute',
                  left: 0,
                  top: yPos - lineThickness / 2,
                  width: '100%',
                  height: lineThickness,
                  backgroundColor: strokeColor
                }}
              />
            )
          })()
        ))}
      </div>
    )
  }
  const renderTextContent = () => (
    <>
      {textLines.map((line, lineIndex) => {
        const alignment = ruledPaper ? 'center' : (line.textAlignment.toLowerCase() as 'left' | 'center' | 'right')
        const basePaddingLeft = ruledPaper ? 0 : (line.marginLeft || 0) * scale
        const alignmentPaddingLeft = 0
        const alignmentPaddingRight = 0
        const hasRenderableText = line.textRuns.some(run => run.text.replace(/[\r\n]/g, '').length > 0)
        return (
          <div
            key={lineIndex}
            style={{
              width: '100%',
              position: 'relative',
              paddingLeft: basePaddingLeft + alignmentPaddingLeft,
              paddingRight: alignmentPaddingRight,
              minHeight: ruledPaper ? ruledRowHeight : undefined,
              height: ruledPaper ? ruledRowHeight : undefined,
              display: ruledPaper ? 'flex' : undefined,
              alignItems: ruledPaper ? 'center' : undefined,
              justifyContent: ruledPaper ? 'center' : undefined,
              transform: ruledPaper ? `translateY(${ruledTextVerticalOffset}px)` : undefined,
              textAlign: alignment,
              lineHeight: getLineHeight(line),
              marginTop: ruledPaper ? 0 : (line.spaceBefore || 0) * scale,
              marginBottom: ruledPaper ? 0 : (line.spaceAfter || 0) * scale,
              direction: line.direction === 'RightToLeft' ? 'rtl' : 'ltr',
              textIndent: !ruledPaper && line.indentType === 'FirstLine' && (line.indent || 0) !== 0
                ? `${(line.indent || 0) * scale}px`
                : undefined
            }}
          >
            {(() => {
              const markerText = getMarkerText(lineIndex)
              if (!markerText) return null
              return (
                <span
                  style={{
                    position: 'absolute',
                    left: alignmentPaddingLeft,
                    top: 0,
                    minWidth: (line.indent || line.marginLeft || 0) * scale,
                    fontFamily: buildFontFamily(line.textMarkerStyle?.fontFamily),
                    fontSize: (line.textRuns[0]?.fontSize || 16) * scale,
                    fontSynthesis: 'style weight',
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
                  const textStrokeStyle = getTextStrokeStyle(run, scale)
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
                        textShadow: getShadowStyle(run, scale),
                        WebkitTextStrokeWidth: textStrokeStyle.WebkitTextStrokeWidth,
                        WebkitTextStrokeColor: textStrokeStyle.WebkitTextStrokeColor,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word'
                      }}
                    >
                      {run.text}
                    </span>
                  )
                })()
              ))
              : (
                (() => {
                  const fallbackRun = line.textRuns[0]
                  const textStrokeStyle = fallbackRun ? getTextStrokeStyle(fallbackRun, scale) : {}
                  return (
                    <span
                      style={{
                        fontFamily: buildFontFamily(line.textRuns[0]?.fontFamily),
                        fontSize: (line.textRuns[0]?.fontSize || 16) * scale,
                        fontStyle: line.textRuns[0]?.fontStyle || 'normal',
                        fontWeight: line.textRuns[0]?.fontWeight || 'normal',
                        fontSynthesis: 'style weight',
                        color: line.textRuns[0]?.color || '#000000',
                        opacity: line.textRuns[0]?.opacity ?? 1,
                        textDecoration: line.textRuns[0]?.decoration === 'Underline' ? 'underline' : 'none',
                        textShadow: line.textRuns[0] ? getShadowStyle(line.textRuns[0], scale) : undefined,
                        WebkitTextStrokeWidth: textStrokeStyle.WebkitTextStrokeWidth,
                        WebkitTextStrokeColor: textStrokeStyle.WebkitTextStrokeColor,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word'
                      }}
                    >
                      {'\u00A0'}
                    </span>
                  )
                })()
              )}
          </div>
        )
      })}
    </>
  )
  return (
    <div
      style={{
        position: 'absolute',
        left: x * scale,
        top: y * scale,
        width: renderedWidth,
        height: mainHeight + (hasReflection ? reflectionVisibleHeight + reflectionOffset : 0),
        overflow: 'visible',
        pointerEvents: 'none'
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          overflow: ruledPaper ? 'hidden' : 'visible',
          ...textContainerStyle
        }}
      >
        {renderRuledPaperGuides()}
        {renderTextContent()}
      </div>
      {hasReflection && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: textBottom + reflectionVisibleHeight + reflectionOffset,
            width: renderedWidth,
            height: reflectionVisibleHeight,
            transform: 'scaleY(-1)',
            transformOrigin: 'center top',
            opacity: reflectionOpacity,
            WebkitMaskImage: `linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0) ${reflectionFadeStop.toFixed(0)}%)`,
            maskImage: `linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0) ${reflectionFadeStop.toFixed(0)}%)`,
            overflow: 'hidden',
            pointerEvents: 'none'
          }}
        >
          <div
            style={{
              marginTop: -contentTopOffset,
              ...textContainerStyle,
              minHeight: contentHeight,
              height: contentHeight,
              justifyContent: 'flex-start'
            }}
          >
            {renderTextContent()}
          </div>
        </div>
      )}
    </div>
  )
}
