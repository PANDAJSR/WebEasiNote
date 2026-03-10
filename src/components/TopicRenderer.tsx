import { useState } from 'react'
import { buildFontFamily } from '../font-utils'
import type { TopicElement, TopicNode } from '../types'

interface TopicRendererProps {
  element: TopicElement
  scale: number
}

interface RenderNode {
  node: TopicNode
  level: number
  centerX: number
  centerY: number
  parentCenterX: number
  parentCenterY: number
  parentWidth: number
  parentHeight: number
  width: number
  height: number
}

type TopicLayoutMode = 'horizontal' | 'vertical'

const HORIZONTAL_NODE_PADDING = 8
const VERTICAL_NODE_PADDING = 4
const HORIZONTAL_NODE_GAP_X = 92
const HORIZONTAL_NODE_GAP_Y = 26
const VERTICAL_NODE_GAP_X = 34
const VERTICAL_NODE_GAP_Y = 68

function getNodeVisualSize(contentWidth: number, contentHeight: number): { width: number; height: number } {
  return {
    width: Math.max(contentWidth + HORIZONTAL_NODE_PADDING * 2, 72),
    height: Math.max(contentHeight + VERTICAL_NODE_PADDING * 2, 34)
  }
}

function collectVerticalRenderNodes(
  nodes: TopicNode[],
  parentCenterX: number,
  parentCenterY: number,
  parentWidth: number,
  parentHeight: number,
  level = 1
): RenderNode[] {
  if (nodes.length === 0) return []

  const collected: RenderNode[] = []
  const visualSizes = nodes.map(node => getNodeVisualSize(node.contentWidth, node.contentHeight))
  const totalWidth = visualSizes.reduce((sum, size) => sum + size.width, 0) + VERTICAL_NODE_GAP_X * (nodes.length - 1)
  let cursorX = parentCenterX - totalWidth / 2
  const topY = parentCenterY + parentHeight / 2 + VERTICAL_NODE_GAP_Y

  nodes.forEach((node, index) => {
    const visualSize = visualSizes[index]
    const centerX = cursorX + visualSize.width / 2
    const centerY = topY + visualSize.height / 2
    collected.push({
      node,
      level,
      centerX,
      centerY,
      parentCenterX,
      parentCenterY,
      parentWidth,
      parentHeight,
      width: visualSize.width,
      height: visualSize.height
    })

    if (node.children.length > 0) {
      collected.push(
        ...collectVerticalRenderNodes(node.children, centerX, centerY, visualSize.width, visualSize.height, level + 1)
      )
    }

    cursorX += visualSize.width + VERTICAL_NODE_GAP_X
  })

  return collected
}

function collectHorizontalSideNodes(
  sideNodes: TopicNode[],
  side: -1 | 1,
  parentCenterX: number,
  parentCenterY: number,
  parentWidth: number,
  parentHeight: number,
  level: number
): RenderNode[] {
  if (sideNodes.length === 0) return []

  const collected: RenderNode[] = []
  const visualSizes = sideNodes.map(node => getNodeVisualSize(node.contentWidth, node.contentHeight))
  const totalHeight = visualSizes.reduce((sum, size) => sum + size.height, 0) + HORIZONTAL_NODE_GAP_Y * (sideNodes.length - 1)
  let cursorY = parentCenterY - totalHeight / 2

  sideNodes.forEach((node, index) => {
    const visualSize = visualSizes[index]
    const centerX = parentCenterX + side * (parentWidth / 2 + HORIZONTAL_NODE_GAP_X + visualSize.width / 2)
    const centerY = cursorY + visualSize.height / 2

    collected.push({
      node,
      level,
      centerX,
      centerY,
      parentCenterX,
      parentCenterY,
      parentWidth,
      parentHeight,
      width: visualSize.width,
      height: visualSize.height
    })

    if (node.children.length > 0) {
      collected.push(
        ...collectHorizontalRenderNodes(node.children, centerX, centerY, visualSize.width, visualSize.height, level + 1)
      )
    }

    cursorY += visualSize.height + HORIZONTAL_NODE_GAP_Y
  })

  return collected
}

function collectHorizontalRenderNodes(
  nodes: TopicNode[],
  parentCenterX: number,
  parentCenterY: number,
  parentWidth: number,
  parentHeight: number,
  level = 1
): RenderNode[] {
  if (nodes.length === 0) return []

  const leftNodes = nodes.filter(node => node.location.x < 0)
  const rightNodes = nodes.filter(node => node.location.x >= 0)

  return [
    ...collectHorizontalSideNodes(leftNodes, -1, parentCenterX, parentCenterY, parentWidth, parentHeight, level),
    ...collectHorizontalSideNodes(rightNodes, 1, parentCenterX, parentCenterY, parentWidth, parentHeight, level)
  ]
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
  fontFamily: string
  fontSize: number
  scale: number
  isRoot?: boolean
}) {
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
        justifyContent: 'center',
        padding: `${6 * scale}px ${14 * scale}px`,
        textAlign: 'center',
        pointerEvents: 'none'
      }}
    >
      <span
        style={{
          fontFamily: buildFontFamily(fontFamily),
          fontSize: fontSize * scale,
          fontWeight: isRoot ? 700 : 500,
          color: textColor,
          lineHeight: 1.1,
          whiteSpace: 'pre-wrap'
        }}
      >
        {title}
      </span>
    </div>
  )
}

export function TopicRenderer({ element, scale }: TopicRendererProps) {
  const [expanded, setExpanded] = useState(true)
  const rootCenterX = element.x
  const rootCenterY = element.y
  const rootVisualSize = getNodeVisualSize(element.contentWidth, element.contentHeight)
  const rootWidth = rootVisualSize.width
  const rootHeight = rootVisualSize.height
  const layoutMode: TopicLayoutMode =
    element.topicType === 'Organization' || element.branchType === 'PolyLineWithRadius'
      ? 'vertical'
      : 'horizontal'

  const renderedNodes = layoutMode === 'vertical'
    ? collectVerticalRenderNodes(element.children, rootCenterX, rootCenterY, rootWidth, rootHeight)
    : collectHorizontalRenderNodes(element.children, rootCenterX, rootCenterY, rootWidth, rootHeight)

  const hasChildren = renderedNodes.length > 0
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
        {expanded && renderedNodes.map(entry => (
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

      {hasChildren && (
        <button
          type='button'
          onClick={() => setExpanded(value => !value)}
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
          aria-label={expanded ? '折叠子节点' : '展开子节点'}
        >
          {expanded ? '-' : '+'}
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
        fontFamily={element.fontFamily}
        fontSize={element.fontSize}
        scale={scale}
        isRoot
      />

      {expanded && renderedNodes.map(entry => (
        <TopicNodeBox
          key={entry.node.id}
          x={entry.centerX - entry.width / 2}
          y={entry.centerY - entry.height / 2}
          width={entry.width}
          height={entry.height}
          title={entry.node.title}
          fillColor={entry.node.fillColor}
          strokeColor={entry.node.strokeColor}
          textColor={entry.node.textColor}
          fontFamily={entry.node.fontFamily}
          fontSize={entry.node.fontSize}
          scale={scale}
        />
      ))}
    </div>
  )
}
