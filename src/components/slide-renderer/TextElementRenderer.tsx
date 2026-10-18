import type { CSSProperties } from 'react'
import type { TextElement } from '../../parser'
import { buildFontFamily } from '../../font-utils'
import { convertSeewoLineSpacingToMultiplier } from '../../line-spacing'
import {
  buildTextGradient,
  getShadowStyle,
  getTextStrokeStyle,
  mergeOpacityToColor
} from './text-style-utils'
import { resolveTextMarkers } from '../../text-markers'
import { TextMarkerSpan } from './TextMarkerSpan'
import { measureRunWidth, sliceLineRunsByLineProperties } from './text-layout-utils'

const RULED_PAPER_TEXT_VERTICAL_OFFSET_RATIO = -0.12
const RULED_PAPER_CONTENT_PADDING_RATIO = 0.08

export function TextElementRenderer({ element, scale }: { element: TextElement; scale: number }) {
  const { x, y, width, height, textLines } = element
  const enableAutoWrap = !element.ruledPaper && element.arrangingType !== 'Vertical'
  const markers = resolveTextMarkers(textLines)
  const textOuterPadding = 10 * scale
  const ruledPaper = element.ruledPaper
  const mainHeight = height * scale
  const baseWidth = ruledPaper ? width * scale : (width + 2) * scale
  const ruledContentPadding = ruledPaper ? mainHeight * RULED_PAPER_CONTENT_PADDING_RATIO : 0
  const ruledRowCount = ruledPaper ? Math.max(1, textLines.length || 1) : 0
  const ruledUsableHeight = ruledPaper ? Math.max(1, mainHeight - ruledContentPadding * 2) : 0
  const ruledRowHeight = ruledPaper ? ruledUsableHeight / ruledRowCount : 0
  const containerPadding = ruledPaper ? ruledContentPadding : textOuterPadding
  const ruledTextVerticalOffset = ruledPaper ? ruledRowHeight * RULED_PAPER_TEXT_VERTICAL_OFFSET_RATIO : 0
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
  const widthAndHeightAutoSizing = !ruledPaper
    && element.arrangingType !== 'Vertical'
    && element.sizeToContent === 'WidthAndHeight'
  const maxMeasuredLineWidth = widthAndHeightAutoSizing
    ? textLines.reduce((maxWidth, line) => {
      const marginLeftWidth = (line.marginLeft || 0) * scale
      const runsWidth = line.textRuns.reduce((sum, run) => sum + measureRunWidth(run, scale), 0)
      return Math.max(maxWidth, marginLeftWidth + runsWidth)
    }, 0)
    : 0
  const renderedWidth = widthAndHeightAutoSizing
    ? Math.max(baseWidth, Math.ceil(maxMeasuredLineWidth + textOuterPadding * 2))
    : baseWidth
  const textContainerStyle: CSSProperties = {
    width: renderedWidth,
    minHeight: mainHeight,
    height: mainHeight,
    boxSizing: 'border-box',
    padding: containerPadding,
    paddingRight: containerPadding,
    overflow: 'visible',
    pointerEvents: 'none',
    display: 'flex',
    flexDirection: 'column',
    justifyContent,
    border: element.borderType && element.borderType !== 'None' && (element.borderThickness || 0) > 0 && element.borderColor && element.borderColor !== 'transparent' && element.borderColor !== 'rgba(0, 0, 0, 0)'
      ? `${(element.borderThickness || 0) * scale}px solid ${element.borderColor}`
      : undefined,
    backgroundColor: element.backgroundColor || ruledPaper?.backgroundColor,
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
              whiteSpace: enableAutoWrap ? 'pre-wrap' : 'nowrap',
              wordBreak: enableAutoWrap ? 'break-word' : 'keep-all',
              overflowWrap: enableAutoWrap ? 'anywhere' : undefined,
              marginTop: ruledPaper ? 0 : (line.spaceBefore || 0) * scale,
              marginBottom: ruledPaper ? 0 : (line.spaceAfter || 0) * scale,
              direction: line.direction === 'RightToLeft' ? 'rtl' : 'ltr',
              textIndent: !ruledPaper && line.indentType === 'FirstLine' && (line.indent || 0) !== 0
                ? `${(line.indent || 0) * scale}px`
                : undefined
            }}
          >
            {(() => {
              const marker = markers[lineIndex]
              if (!marker) return null
              const hasIndent = (line.indent || line.marginLeft || 0) > 0
              if (hasIndent) {
                return (
                  <TextMarkerSpan marker={marker} line={line} scale={scale} absoluteLeft={alignmentPaddingLeft} />
                )
              }
              if (hasRenderableText) {
                return null
              }
              return (
                <TextMarkerSpan marker={marker} line={line} scale={scale} />
              )
            })()}
            {hasRenderableText
              ? (() => {
                const visualLines = sliceLineRunsByLineProperties(line.textRuns, line.lines)
                const isMultiLineProperty = Boolean(line.lines && line.lines.length > 1)
                const marker = markers[lineIndex]
                const hasIndent = (line.indent || line.marginLeft || 0) > 0
                const shouldRenderMarkerInFirstLine = Boolean(marker && !hasIndent)

                return visualLines.map((vLine, vLineIdx) => (
                  <span
                    key={vLineIdx}
                    style={{
                      display: isMultiLineProperty ? 'block' : 'inline',
                      whiteSpace: isMultiLineProperty ? 'pre' : (enableAutoWrap ? 'pre-wrap' : 'nowrap')
                    }}
                  >
                    {vLineIdx === 0 && shouldRenderMarkerInFirstLine && (
                      <TextMarkerSpan marker={marker!} line={line} scale={scale} />
                    )}
                    {vLine.runs.map((run, runIndex) => (
                      <span
                        key={runIndex}
                        style={{
                          fontFamily: buildFontFamily(run.fontFamily),
                          fontSize: (run.variants === 'Subscript' || run.variants === 'Superscript' ? run.fontSize * 0.7 : run.fontSize) * scale,
                          fontStyle: run.fontStyle,
                          fontWeight: run.fontWeight,
                          fontSynthesis: 'style weight',
                          color: buildTextGradient(run) ? 'transparent' : run.color,
                          backgroundImage: buildTextGradient(run),
                          backgroundClip: buildTextGradient(run) ? 'text' : undefined,
                          WebkitBackgroundClip: buildTextGradient(run) ? 'text' : undefined,
                          WebkitTextFillColor: buildTextGradient(run) ? 'transparent' : undefined,
                          opacity: (run.opacity ?? 1) * (run.gradient?.opacity ?? 1),
                          textDecoration: (() => {
                            const decs: string[] = []
                            if (run.decoration === 'Underline') decs.push('underline')
                            if (run.strikethrough) decs.push('line-through')
                            return decs.length > 0 ? decs.join(' ') : 'none'
                          })(),
                          textDecorationStyle: run.underlineStyle || 'solid',
                          textDecorationColor: run.underlineColor,
                          textEmphasis: run.emphasisMark ? 'filled circle' : undefined,
                          WebkitTextEmphasis: run.emphasisMark ? 'filled circle' : undefined,
                          verticalAlign: run.variants === 'Subscript' ? 'sub' : run.variants === 'Superscript' ? 'super' : undefined,
                          textShadow: getShadowStyle(run, scale),
                          WebkitTextStrokeWidth: getTextStrokeStyle(run, scale).WebkitTextStrokeWidth,
                          WebkitTextStrokeColor: getTextStrokeStyle(run, scale).WebkitTextStrokeColor,
                          whiteSpace: 'inherit',
                          wordBreak: enableAutoWrap ? 'inherit' : 'keep-all'
                        }}
                      >
                        {run.text}
                      </span>
                    ))}
                  </span>
                ))
              })()
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
                        whiteSpace: enableAutoWrap ? 'inherit' : 'pre',
                        wordBreak: enableAutoWrap ? 'inherit' : 'keep-all'
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
