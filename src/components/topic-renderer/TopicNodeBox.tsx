import type { ReactNode } from 'react'
import { buildFontFamily } from '../../font-utils'
import type { TextLine, TextRun } from '../../types'
import {
  buildTextGradient,
  estimateTextBlockSize,
  getLineHeight,
  getShadowStyle,
  getTextStrokeStyle,
  toCircleNumber,
  toLatin
} from './text-style-utils'

interface TopicNodeBoxProps {
  x: number
  y: number
  width: number
  height: number
  title: string
  textLines: TextLine[]
  fillColor: string
  strokeColor: string
  textColor: string
  textAlignment: 'Left' | 'Center' | 'Right'
  fontFamily: string
  fontSize: number
  scale: number
  isRoot?: boolean
}

export function TopicNodeBox({
  x,
  y,
  width,
  height,
  title,
  textLines,
  fillColor,
  strokeColor,
  textColor,
  textAlignment,
  fontFamily,
  fontSize,
  scale,
  isRoot = false
}: TopicNodeBoxProps) {
  const markerCounters: Record<string, number> = {}

  const getMarkerText = (lineIndex: number, lines: TextLine[]): string | null => {
    const line = lines[lineIndex]
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

  const resolvedLines = textLines.length > 0
    ? textLines
    : (() => {
      const fallbackRun: TextRun = {
        text: title,
        fontFamily,
        fontSize,
        fontStyle: 'normal',
        fontWeight: isRoot ? 'bold' : 'normal',
        color: textColor,
        opacity: 1,
        decoration: 'None'
      }
      const fallbackLine: TextLine = {
        textRuns: [fallbackRun],
        textAlignment,
        textMarker: 'None',
        indent: 0,
        indentLevel: 0,
        indentType: 'FirstLine',
        marginLeft: 0,
        direction: 'LeftToRight',
        lineSpacing: 1.1,
        spaceBefore: 0,
        spaceAfter: 0
      }
      return [fallbackLine]
    })()

  const reflectionEffect = (() => {
    for (const line of resolvedLines) {
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
  const reflectionFadeStop = hasReflection
    ? Math.min(95, Math.max(20, (1 - reflectionDepth) * 100))
    : 0
  const estimatedTextHeight = estimateTextBlockSize(resolvedLines, title, fontSize).height * scale

  const renderTextContent = (): ReactNode => (
    <>
      {resolvedLines.map((line, lineIndex) => {
        const lineAlignment = (line.textAlignment || textAlignment).toLowerCase() as 'left' | 'center' | 'right'
        const hasRenderableText = line.textRuns.some(run => run.text.replace(/[\r\n]/g, '').length > 0)
        const firstRun = line.textRuns[0]

        return (
          <div
            key={lineIndex}
            style={{
              width: '100%',
              position: 'relative',
              paddingLeft: (line.marginLeft || 0) * scale,
              textAlign: lineAlignment,
              lineHeight: getLineHeight(line, scale),
              marginTop: (line.spaceBefore || 0) * scale,
              marginBottom: (line.spaceAfter || 0) * scale,
              direction: line.direction === 'RightToLeft' ? 'rtl' : 'ltr',
              textIndent: line.indentType === 'FirstLine' && (line.indent || 0) !== 0
                ? `${(line.indent || 0) * scale}px`
                : undefined
            }}
          >
            {(() => {
              const markerText = getMarkerText(lineIndex, resolvedLines)
              if (!markerText) return null
              const markerWidth = Math.max((line.indent || line.marginLeft || 0) * scale, 12 * scale)
              return (
                <span
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    width: markerWidth,
                    textAlign: 'right',
                    paddingRight: 2 * scale,
                    fontFamily: buildFontFamily(line.textMarkerStyle?.fontFamily),
                    fontSize: (firstRun?.fontSize || fontSize) * scale,
                    color: firstRun?.color || textColor,
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
              ? line.textRuns.map((run, runIndex) => {
                const gradient = buildTextGradient(run)
                const opacity = (run.opacity ?? 1) * (run.gradient?.opacity ?? 1)
                const textStrokeStyle = getTextStrokeStyle(run, scale)
                return (
                  <span
                    key={runIndex}
                    style={{
                      fontFamily: buildFontFamily(run.fontFamily || fontFamily),
                      fontSize: (run.fontSize || fontSize) * scale,
                      fontStyle: run.fontStyle || 'normal',
                      fontWeight: run.fontWeight || 'normal',
                      fontSynthesis: 'style weight',
                      color: gradient ? 'transparent' : (run.color || textColor),
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
              })
              : (
                <span
                  style={{
                    fontFamily: buildFontFamily(firstRun?.fontFamily || fontFamily),
                    fontSize: (firstRun?.fontSize || fontSize) * scale,
                    fontStyle: firstRun?.fontStyle || 'normal',
                    fontWeight: firstRun?.fontWeight || 'normal',
                    color: firstRun?.color || textColor,
                    opacity: firstRun?.opacity ?? 1,
                    textDecoration: firstRun?.decoration === 'Underline' ? 'underline' : 'none',
                    textShadow: firstRun ? getShadowStyle(firstRun, scale) : undefined,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                  }}
                >
                  {'\u00A0'}
                </span>
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
        width: width * scale,
        height: height * scale + (hasReflection ? estimatedTextHeight + reflectionOffset : 0),
        pointerEvents: 'none',
        overflow: 'visible'
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: width * scale,
          height: height * scale,
          border: `${(isRoot ? 2.2 : 1.8) * scale}px solid ${strokeColor}`,
          boxShadow: `0 0 0 ${(isRoot ? 1.2 : 1) * scale}px ${strokeColor}`,
          borderRadius: 14 * scale,
          backgroundColor: fillColor,
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: `${4 * scale}px ${4 * scale}px`,
          pointerEvents: 'none',
          overflow: 'visible'
        }}
      >
        {renderTextContent()}
      </div>

      {hasReflection && (
        <div
          style={{
            position: 'absolute',
            left: 4 * scale,
            top: height * scale + reflectionOffset,
            width: width * scale - 8 * scale,
            height: estimatedTextHeight,
            transform: 'scaleY(-1)',
            transformOrigin: 'center top',
            opacity: reflectionOpacity,
            WebkitMaskImage: `linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0) ${reflectionFadeStop.toFixed(0)}%)`,
            maskImage: `linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0) ${reflectionFadeStop.toFixed(0)}%)`,
            overflow: 'hidden'
          }}
        >
          <div>{renderTextContent()}</div>
        </div>
      )}
    </div>
  )
}
