import type { CSSProperties, ReactNode } from 'react'
import { useState } from 'react'
import { buildFontFamily } from '../font-utils'
import { convertSeewoLineSpacingToMultiplier } from '../line-spacing'
import type { TextLine, TextRun, TopicElement, TopicNode } from '../types'

interface TopicRendererProps {
  element: TopicElement
  scale: number
}

interface RenderNode {
  node: TopicNode
  nodeId: string
  level: number
  centerX: number
  centerY: number
  parentCenterX: number
  parentCenterY: number
  parentWidth: number
  parentHeight: number
  width: number
  height: number
  siblingCount: number
  hasChildren: boolean
  expanded: boolean
}

type TopicLayoutMode = 'horizontal' | 'vertical'

const HORIZONTAL_NODE_PADDING = 6
const VERTICAL_NODE_PADDING = 4
const HORIZONTAL_NODE_GAP_X = 92
const HORIZONTAL_NODE_GAP_Y = 26
const VERTICAL_NODE_GAP_X = 34
const VERTICAL_NODE_GAP_Y = 68
const TOPIC_TEXT_LINE_HEIGHT = 1.1

function estimateSingleLineTextWidth(text: string, fontSize: number): number {
  // 中文和全角字符按 1em，ASCII 按 0.56em 估算，避免节点过窄导致换行
  let widthEm = 0
  for (const ch of text) {
    if (/[\u0000-\u00ff]/.test(ch)) {
      widthEm += 0.56
    } else {
      widthEm += 1
    }
  }
  return Math.max(0, widthEm * fontSize)
}

function estimateLineHeight(line: TextLine, fallbackFontSize: number): number {
  const maxRunFontSize = Math.max(...line.textRuns.map(run => run.fontSize), fallbackFontSize)
  if (line.fixedLineSpacing && line.fixedLineSpacing > 0) {
    return line.fixedLineSpacing
  }
  const multiplier = convertSeewoLineSpacingToMultiplier(line.lineSpacing)
  if (multiplier) {
    return maxRunFontSize * multiplier
  }
  return maxRunFontSize * TOPIC_TEXT_LINE_HEIGHT
}

function estimateTextBlockSize(
  textLines: TextLine[],
  fallbackText: string,
  fallbackFontSize: number
): { width: number; height: number } {
  if (textLines.length === 0) {
    const lines = fallbackText.split(/\r\n|\r|\n/)
    const longestLineWidth = Math.max(
      ...lines.map(line => estimateSingleLineTextWidth(line, fallbackFontSize)),
      0
    )
    return {
      width: longestLineWidth,
      height: Math.max(lines.length, 1) * fallbackFontSize * TOPIC_TEXT_LINE_HEIGHT
    }
  }

  const lineWidths = textLines.map(line => {
    if (line.textRuns.length === 0) return 0
    return line.textRuns.reduce(
      (sum, run) => sum + estimateSingleLineTextWidth(run.text.replace(/[\r\n]/g, ''), run.fontSize || fallbackFontSize),
      0
    )
  })
  const width = Math.max(...lineWidths, 0)
  const height = textLines.reduce(
    (sum, line) => sum + estimateLineHeight(line, fallbackFontSize) + (line.spaceBefore || 0) + (line.spaceAfter || 0),
    0
  )

  return { width, height: Math.max(height, fallbackFontSize * TOPIC_TEXT_LINE_HEIGHT) }
}

function getNodeVisualSize(
  contentWidth: number,
  contentHeight: number,
  textLines: TextLine[],
  text: string,
  fontSize: number
): { width: number; height: number } {
  const textBlockSize = estimateTextBlockSize(textLines, text, fontSize)
  const textDrivenWidth = textBlockSize.width + HORIZONTAL_NODE_PADDING * 2 + 2
  const textDrivenHeight = textBlockSize.height + VERTICAL_NODE_PADDING * 2 + 2
  return {
    width: Math.max(contentWidth + HORIZONTAL_NODE_PADDING * 2, textDrivenWidth, 72),
    height: Math.max(contentHeight + VERTICAL_NODE_PADDING * 2, textDrivenHeight, 34)
  }
}

interface VerticalMeasure {
  node: TopicNode
  nodeWidth: number
  nodeHeight: number
  subtreeWidth: number
  children: VerticalMeasure[]
}

interface HorizontalMeasure {
  node: TopicNode
  nodeWidth: number
  nodeHeight: number
  subtreeHeight: number
  leftChildren: HorizontalMeasure[]
  rightChildren: HorizontalMeasure[]
}

function sumWithGap(values: number[], gap: number): number {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) + gap * (values.length - 1)
}

function measureVerticalNode(node: TopicNode, isNodeExpanded: (id: string) => boolean): VerticalMeasure {
  const visualSize = getNodeVisualSize(node.contentWidth, node.contentHeight, node.textLines, node.title, node.fontSize)
  const expanded = isNodeExpanded(node.id)
  const children = expanded ? node.children.map(child => measureVerticalNode(child, isNodeExpanded)) : []
  const childrenWidth = sumWithGap(children.map(item => item.subtreeWidth), VERTICAL_NODE_GAP_X)
  return {
    node,
    nodeWidth: visualSize.width,
    nodeHeight: visualSize.height,
    subtreeWidth: Math.max(visualSize.width, childrenWidth),
    children
  }
}

function measureHorizontalNode(node: TopicNode, isNodeExpanded: (id: string) => boolean): HorizontalMeasure {
  const visualSize = getNodeVisualSize(node.contentWidth, node.contentHeight, node.textLines, node.title, node.fontSize)
  const expanded = isNodeExpanded(node.id)
  const measuredChildren = expanded ? node.children.map(child => measureHorizontalNode(child, isNodeExpanded)) : []
  const leftChildren = measuredChildren.filter(item => item.node.location.x < 0)
  const rightChildren = measuredChildren.filter(item => item.node.location.x >= 0)
  const leftHeight = sumWithGap(leftChildren.map(item => item.subtreeHeight), HORIZONTAL_NODE_GAP_Y)
  const rightHeight = sumWithGap(rightChildren.map(item => item.subtreeHeight), HORIZONTAL_NODE_GAP_Y)

  return {
    node,
    nodeWidth: visualSize.width,
    nodeHeight: visualSize.height,
    subtreeHeight: Math.max(visualSize.height, leftHeight, rightHeight),
    leftChildren,
    rightChildren
  }
}

function placeVerticalMeasuredNode(
  measured: VerticalMeasure,
  subtreeLeftX: number,
  topY: number,
  parent: { centerX: number; centerY: number; width: number; height: number },
  level: number,
  siblingCount: number,
  isNodeExpanded: (id: string) => boolean
): RenderNode[] {
  const centerX = subtreeLeftX + measured.subtreeWidth / 2
  const centerY = topY + measured.nodeHeight / 2
  const expanded = isNodeExpanded(measured.node.id)
  const current: RenderNode = {
    node: measured.node,
    nodeId: measured.node.id,
    level,
    centerX,
    centerY,
    parentCenterX: parent.centerX,
    parentCenterY: parent.centerY,
    parentWidth: parent.width,
    parentHeight: parent.height,
    width: measured.nodeWidth,
    height: measured.nodeHeight,
    siblingCount,
    hasChildren: measured.node.children.length > 0,
    expanded
  }

  if (measured.children.length === 0 || !expanded) {
    return [current]
  }

  const childrenTopY = centerY + measured.nodeHeight / 2 + VERTICAL_NODE_GAP_Y
  let childCursorX = centerX - sumWithGap(measured.children.map(item => item.subtreeWidth), VERTICAL_NODE_GAP_X) / 2
  const descendants: RenderNode[] = []
  measured.children.forEach(child => {
    descendants.push(
      ...placeVerticalMeasuredNode(
        child,
        childCursorX,
        childrenTopY,
        { centerX, centerY, width: measured.nodeWidth, height: measured.nodeHeight },
        level + 1,
        measured.children.length,
        isNodeExpanded
      )
    )
    childCursorX += child.subtreeWidth + VERTICAL_NODE_GAP_X
  })

  return [current, ...descendants]
}

function placeHorizontalSide(
  sideChildren: HorizontalMeasure[],
  side: -1 | 1,
  parent: { centerX: number; centerY: number; width: number; height: number },
  level: number,
  isNodeExpanded: (id: string) => boolean
): RenderNode[] {
  if (sideChildren.length === 0) return []

  const totalHeight = sumWithGap(sideChildren.map(item => item.subtreeHeight), HORIZONTAL_NODE_GAP_Y)
  let cursorY = parent.centerY - totalHeight / 2
  const rendered: RenderNode[] = []

  sideChildren.forEach(child => {
    const childCenterY = cursorY + child.subtreeHeight / 2
    const childCenterX = parent.centerX + side * (parent.width / 2 + HORIZONTAL_NODE_GAP_X + child.nodeWidth / 2)
    const expanded = isNodeExpanded(child.node.id)
    rendered.push({
      node: child.node,
      nodeId: child.node.id,
      level,
      centerX: childCenterX,
      centerY: childCenterY,
      parentCenterX: parent.centerX,
      parentCenterY: parent.centerY,
      parentWidth: parent.width,
      parentHeight: parent.height,
      width: child.nodeWidth,
      height: child.nodeHeight,
      siblingCount: sideChildren.length,
      hasChildren: child.node.children.length > 0,
      expanded
    })

    if (!expanded) {
      cursorY += child.subtreeHeight + HORIZONTAL_NODE_GAP_Y
      return
    }

    rendered.push(
      ...placeHorizontalSide(
        child.leftChildren,
        -1,
        { centerX: childCenterX, centerY: childCenterY, width: child.nodeWidth, height: child.nodeHeight },
        level + 1,
        isNodeExpanded
      )
    )
    rendered.push(
      ...placeHorizontalSide(
        child.rightChildren,
        1,
        { centerX: childCenterX, centerY: childCenterY, width: child.nodeWidth, height: child.nodeHeight },
        level + 1,
        isNodeExpanded
      )
    )

    cursorY += child.subtreeHeight + HORIZONTAL_NODE_GAP_Y
  })

  return rendered
}

function renderHorizontalBranchPath(entry: RenderNode, scale: number) {
  const childLeftX = (entry.centerX - entry.width / 2) * scale
  const childRightX = (entry.centerX + entry.width / 2) * scale
  const parentRightX = (entry.parentCenterX + entry.parentWidth / 2) * scale
  const parentLeftX = (entry.parentCenterX - entry.parentWidth / 2) * scale

  const childOnRight = entry.centerX >= entry.parentCenterX
  const startX = childOnRight ? parentRightX : parentLeftX
  const endX = childOnRight ? childLeftX : childRightX

  const startY = entry.parentCenterY * scale
  const endY = entry.centerY * scale

  const dx = Math.max(36, Math.abs(endX - startX) * 0.52)
  const direction = childOnRight ? 1 : -1
  const c1x = startX + dx * direction
  const c1y = startY
  const c2x = endX - dx * direction
  const c2y = endY

  return `M ${startX} ${startY} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${endX} ${endY}`
}

function renderVerticalBranchPath(
  entry: RenderNode,
  scale: number
) {
  const parentBottomX = entry.parentCenterX * scale
  const parentBottomY = (entry.parentCenterY + entry.parentHeight / 2) * scale
  const childTopX = entry.centerX * scale
  const childTopY = (entry.centerY - entry.height / 2) * scale

  if (entry.siblingCount === 1) {
    return `M ${parentBottomX} ${parentBottomY} L ${childTopX} ${childTopY}`
  }

  const middleY = parentBottomY + (childTopY - parentBottomY) * 0.55
  const radius = Math.min(14 * scale, Math.max(4 * scale, Math.abs(childTopX - parentBottomX) * 0.25))
  const dir = childTopX >= parentBottomX ? 1 : -1

  return [
    `M ${parentBottomX} ${parentBottomY}`,
    `L ${parentBottomX} ${middleY - radius}`,
    `Q ${parentBottomX} ${middleY} ${parentBottomX + radius * dir} ${middleY}`,
    `L ${childTopX - radius * dir} ${middleY}`,
    `Q ${childTopX} ${middleY} ${childTopX} ${middleY + radius}`,
    `L ${childTopX} ${childTopY}`
  ].join(' ')
}

function buildTextGradient(run: TextLine['textRuns'][number]): string | undefined {
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

function getShadowStyle(run: TextLine['textRuns'][number], scale: number): string | undefined {
  const shadow = run.textEffects?.shadow
  if (!shadow) return undefined

  const radians = (shadow.direction * Math.PI) / 180
  const offsetX = Math.cos(radians) * shadow.distance * scale
  const offsetY = -Math.sin(radians) * shadow.distance * scale
  let shadowColor = shadow.color
  if (shadow.color.startsWith('rgba(')) {
    shadowColor = shadow.color.replace(/,\s*([0-9.]+)\)$/, (_, alpha) => `, ${(parseFloat(alpha) * shadow.opacity).toFixed(2)})`)
  } else if (shadow.color.startsWith('rgb(')) {
    shadowColor = shadow.color.replace('rgb(', 'rgba(').replace(')', `, ${shadow.opacity.toFixed(2)})`)
  } else if (shadow.color.startsWith('#') && shadow.color.length === 7) {
    const r = parseInt(shadow.color.slice(1, 3), 16)
    const g = parseInt(shadow.color.slice(3, 5), 16)
    const b = parseInt(shadow.color.slice(5, 7), 16)
    shadowColor = `rgba(${r}, ${g}, ${b}, ${shadow.opacity.toFixed(2)})`
  }

  return `${offsetX.toFixed(2)}px ${offsetY.toFixed(2)}px ${(shadow.blur * scale).toFixed(2)}px ${shadowColor}`
}

function mergeOpacityToColor(color: string, opacity: number): string {
  const normalizedOpacity = Math.min(1, Math.max(0, opacity))
  if (color.startsWith('rgba(')) {
    return color.replace(
      /,\s*([0-9.]+)\)$/,
      (_, alpha) => `, ${(parseFloat(alpha) * normalizedOpacity).toFixed(2)})`
    )
  }
  if (color.startsWith('rgb(')) {
    return color.replace('rgb(', 'rgba(').replace(')', `, ${normalizedOpacity.toFixed(2)})`)
  }
  if (color.startsWith('#') && color.length === 7) {
    const r = parseInt(color.slice(1, 3), 16)
    const g = parseInt(color.slice(3, 5), 16)
    const b = parseInt(color.slice(5, 7), 16)
    return `rgba(${r}, ${g}, ${b}, ${normalizedOpacity.toFixed(2)})`
  }
  return color
}

function getTextStrokeStyle(
  run: TextLine['textRuns'][number],
  scale: number
): Pick<CSSProperties, 'WebkitTextStrokeColor' | 'WebkitTextStrokeWidth'> {
  const frame = run.textEffects?.frame
  if (!frame || frame.thickness <= 0) {
    return {
      WebkitTextStrokeColor: undefined,
      WebkitTextStrokeWidth: undefined
    }
  }

  return {
    WebkitTextStrokeColor: mergeOpacityToColor(frame.color, frame.opacity),
    WebkitTextStrokeWidth: `${(frame.thickness * scale).toFixed(2)}px`
  }
}

function TopicNodeBox({
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
}: {
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
}) {
  const markerCounters: Record<string, number> = {}

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

  const getLineHeight = (line: TextLine): string => {
    if (line.fixedLineSpacing && line.fixedLineSpacing > 0) {
      return `${line.fixedLineSpacing * scale}px`
    }
    const multiplier = convertSeewoLineSpacingToMultiplier(line.lineSpacing)
    if (multiplier) {
      return `${multiplier}`
    }
    return `${TOPIC_TEXT_LINE_HEIGHT}`
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
        lineSpacing: TOPIC_TEXT_LINE_HEIGHT,
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
              lineHeight: getLineHeight(line),
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

export function TopicRenderer({ element, scale }: TopicRendererProps) {
  const [collapsedNodeIds, setCollapsedNodeIds] = useState<Set<string>>(new Set())
  const rootCenterX = element.x
  const rootCenterY = element.y
  const rootVisualSize = getNodeVisualSize(
    element.contentWidth,
    element.contentHeight,
    element.textLines,
    element.title,
    element.fontSize
  )
  const rootWidth = rootVisualSize.width
  const rootHeight = rootVisualSize.height
  const layoutMode: TopicLayoutMode =
    element.topicType === 'Organization' || element.branchType === 'PolyLineWithRadius'
      ? 'vertical'
      : 'horizontal'
  const isNodeExpanded = (id: string) => !collapsedNodeIds.has(id)
  const toggleNodeExpanded = (id: string) => {
    setCollapsedNodeIds(previous => {
      const next = new Set(previous)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }
  const rootHasChildren = element.children.length > 0
  const rootExpanded = isNodeExpanded(element.id)

  const renderedNodes = (() => {
    if (!rootExpanded) return []

    if (layoutMode === 'vertical') {
      const measured = element.children.map(child => measureVerticalNode(child, isNodeExpanded))
      const totalWidth = sumWithGap(measured.map(item => item.subtreeWidth), VERTICAL_NODE_GAP_X)
      let cursorX = rootCenterX - totalWidth / 2
      const topY = rootCenterY + rootHeight / 2 + VERTICAL_NODE_GAP_Y
      const rendered: RenderNode[] = []
      measured.forEach(item => {
        rendered.push(
          ...placeVerticalMeasuredNode(
            item,
            cursorX,
            topY,
            { centerX: rootCenterX, centerY: rootCenterY, width: rootWidth, height: rootHeight },
            1,
            measured.length,
            isNodeExpanded
          )
        )
        cursorX += item.subtreeWidth + VERTICAL_NODE_GAP_X
      })
      return rendered
    }

    const measured = element.children.map(child => measureHorizontalNode(child, isNodeExpanded))
    const leftChildren = measured.filter(item => item.node.location.x < 0)
    const rightChildren = measured.filter(item => item.node.location.x >= 0)
    return [
      ...placeHorizontalSide(
        leftChildren,
        -1,
        { centerX: rootCenterX, centerY: rootCenterY, width: rootWidth, height: rootHeight },
        1,
        isNodeExpanded
      ),
      ...placeHorizontalSide(
        rightChildren,
        1,
        { centerX: rootCenterX, centerY: rootCenterY, width: rootWidth, height: rootHeight },
        1,
        isNodeExpanded
      )
    ]
  })()

  const rootBottomY = rootCenterY + rootHeight / 2

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: '100%',
        height: '100%',
        transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
        transformOrigin: `${rootCenterX * scale}px ${rootCenterY * scale}px`,
        pointerEvents: 'none'
      }}
    >
      <svg
        width='100%'
        height='100%'
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          overflow: 'visible'
        }}
      >
        {renderedNodes.map(entry => (
          <path
            key={`branch-${entry.node.id}`}
            d={
              layoutMode === 'vertical'
                ? renderVerticalBranchPath(entry, scale)
                : renderHorizontalBranchPath(entry, scale)
            }
            fill='none'
            stroke={element.branchColor}
            strokeWidth={(entry.level === 1 ? 6 : 4) * scale}
            strokeLinecap='round'
            strokeLinejoin='round'
          />
        ))}
      </svg>

      {rootHasChildren && (
        <button
          type='button'
          onClick={() => toggleNodeExpanded(element.id)}
          style={{
            position: 'absolute',
            left: (
              layoutMode === 'vertical'
                ? rootCenterX - 14
                : rootCenterX + rootWidth / 2 - 14
            ) * scale,
            top: (
              layoutMode === 'vertical'
                ? rootBottomY - 14
                : rootCenterY - 14
            ) * scale,
            width: 28 * scale,
            height: 28 * scale,
            borderRadius: '50%',
            border: `${2 * scale}px solid #95aad8`,
            backgroundColor: '#f5f9ff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#95aad8',
            fontSize: 20 * scale,
            lineHeight: 1,
            fontWeight: 700,
            boxSizing: 'border-box',
            cursor: 'pointer',
            pointerEvents: 'auto',
            zIndex: 20,
            padding: 0
          }}
          aria-label={rootExpanded ? '折叠子节点' : '展开子节点'}
        >
          {rootExpanded ? '-' : '+'}
        </button>
      )}

      <TopicNodeBox
        x={rootCenterX - rootWidth / 2}
        y={rootCenterY - rootHeight / 2}
        width={rootWidth}
        height={rootHeight}
        title={element.title}
        textLines={element.textLines}
        fillColor={element.fillColor}
        strokeColor={element.strokeColor}
        textColor={element.textColor}
        textAlignment={element.textAlignment}
        fontFamily={element.fontFamily}
        fontSize={element.fontSize}
        scale={scale}
        isRoot
      />

      {renderedNodes.map(entry => (
        <div key={entry.node.id}>
          <TopicNodeBox
            x={entry.centerX - entry.width / 2}
            y={entry.centerY - entry.height / 2}
            width={entry.width}
            height={entry.height}
            title={entry.node.title}
            textLines={entry.node.textLines}
            fillColor={entry.node.fillColor}
            strokeColor={entry.node.strokeColor}
            textColor={entry.node.textColor}
            textAlignment={entry.node.textAlignment}
            fontFamily={entry.node.fontFamily}
            fontSize={entry.node.fontSize}
            scale={scale}
          />
          {entry.hasChildren && (
            <button
              type='button'
              onClick={() => toggleNodeExpanded(entry.nodeId)}
              style={{
                position: 'absolute',
                left: (
                  layoutMode === 'vertical'
                    ? entry.centerX - 12
                    : entry.centerX + entry.width / 2 - 12
                ) * scale,
                top: (
                  layoutMode === 'vertical'
                    ? entry.centerY + entry.height / 2 - 12
                    : entry.centerY - 12
                ) * scale,
                width: 24 * scale,
                height: 24 * scale,
                borderRadius: '50%',
                border: `${1.6 * scale}px solid #95aad8`,
                backgroundColor: '#f5f9ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#95aad8',
                fontSize: 16 * scale,
                lineHeight: 1,
                fontWeight: 700,
                boxSizing: 'border-box',
                cursor: 'pointer',
                pointerEvents: 'auto',
                zIndex: 20,
                padding: 0
              }}
              aria-label={entry.expanded ? '折叠子节点' : '展开子节点'}
            >
              {entry.expanded ? '-' : '+'}
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
