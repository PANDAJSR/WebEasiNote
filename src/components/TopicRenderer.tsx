import { useState } from 'react'
import { buildFontFamily } from '../font-utils'
import type { TopicElement, TopicNode } from '../types'

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

function estimateTextBlockSize(text: string, fontSize: number): { width: number; height: number } {
  const lines = text.split(/\r\n|\r|\n/)
  const longestLineWidth = Math.max(
    ...lines.map(line => estimateSingleLineTextWidth(line, fontSize)),
    0
  )
  const lineCount = Math.max(lines.length, 1)
  return {
    width: longestLineWidth,
    height: lineCount * fontSize * TOPIC_TEXT_LINE_HEIGHT
  }
}

function getNodeVisualSize(
  contentWidth: number,
  contentHeight: number,
  text: string,
  fontSize: number
): { width: number; height: number } {
  const textBlockSize = estimateTextBlockSize(text, fontSize)
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
  const visualSize = getNodeVisualSize(node.contentWidth, node.contentHeight, node.title, node.fontSize)
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
  const visualSize = getNodeVisualSize(node.contentWidth, node.contentHeight, node.title, node.fontSize)
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

function TopicNodeBox({
  x,
  y,
  width,
  height,
  title,
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
  fillColor: string
  strokeColor: string
  textColor: string
  textAlignment: 'Left' | 'Center' | 'Right'
  fontFamily: string
  fontSize: number
  scale: number
  isRoot?: boolean
}) {
  const justifyContent =
    textAlignment === 'Left'
      ? 'flex-start'
      : textAlignment === 'Right'
        ? 'flex-end'
        : 'center'
  const cssTextAlign =
    textAlignment === 'Left'
      ? 'left'
      : textAlignment === 'Right'
        ? 'right'
        : 'center'

  return (
    <div
      style={{
        position: 'absolute',
        left: x * scale,
        top: y * scale,
        width: width * scale,
        height: height * scale,
        border: `${(isRoot ? 2.2 : 1.8) * scale}px solid ${strokeColor}`,
        boxShadow: `0 0 0 ${(isRoot ? 1.2 : 1) * scale}px ${strokeColor}`,
        borderRadius: 14 * scale,
        backgroundColor: fillColor,
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        justifyContent,
        padding: `${4 * scale}px ${4 * scale}px`,
        textAlign: cssTextAlign,
        pointerEvents: 'none'
      }}
    >
      <span
        style={{
          fontFamily: buildFontFamily(fontFamily),
          fontSize: fontSize * scale,
          fontWeight: isRoot ? 700 : 500,
          color: textColor,
          lineHeight: TOPIC_TEXT_LINE_HEIGHT,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          width: '100%'
        }}
      >
        {title}
      </span>
    </div>
  )
}

export function TopicRenderer({ element, scale }: TopicRendererProps) {
  const [collapsedNodeIds, setCollapsedNodeIds] = useState<Set<string>>(new Set())
  const rootCenterX = element.x
  const rootCenterY = element.y
  const rootVisualSize = getNodeVisualSize(element.contentWidth, element.contentHeight, element.title, element.fontSize)
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
