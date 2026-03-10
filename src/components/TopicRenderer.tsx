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
}

function collectRenderNodes(
  nodes: TopicNode[],
  parentCenterX: number,
  parentCenterY: number,
  parentWidth: number,
  level = 1
): RenderNode[] {
  const collected: RenderNode[] = []

  nodes.forEach(node => {
    const centerX = parentCenterX + node.location.x
    const centerY = parentCenterY + node.location.y
    collected.push({
      node,
      level,
      centerX,
      centerY,
      parentCenterX,
      parentCenterY,
      parentWidth
    })

    if (node.children.length > 0) {
      collected.push(
        ...collectRenderNodes(node.children, centerX, centerY, node.width, level + 1)
      )
    }
  })

  return collected
}

function renderBranchPath(entry: RenderNode, scale: number) {
  const childLeftX = (entry.centerX - entry.node.width / 2) * scale
  const childRightX = (entry.centerX + entry.node.width / 2) * scale
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
  const rootCenterX = element.x
  const rootCenterY = element.y
  const rootWidth = element.contentWidth
  const rootHeight = element.contentHeight

  const renderedNodes = collectRenderNodes(
    element.children,
    rootCenterX,
    rootCenterY,
    rootWidth
  )

  const needsCenterPoint = renderedNodes.length > 0

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
            d={renderBranchPath(entry, scale)}
            fill='none'
            stroke={element.branchColor}
            strokeWidth={(entry.level === 1 ? 6 : 4) * scale}
            strokeLinecap='round'
            strokeLinejoin='round'
          />
        ))}
      </svg>

      {needsCenterPoint && (
        <div
          style={{
            position: 'absolute',
            left: (rootCenterX + rootWidth / 2 - 14) * scale,
            top: (rootCenterY - 14) * scale,
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
            boxSizing: 'border-box'
          }}
        >
          -
        </div>
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

      {renderedNodes.map(entry => (
        <TopicNodeBox
          key={entry.node.id}
          x={entry.centerX - entry.node.width / 2}
          y={entry.centerY - entry.node.height / 2}
          width={entry.node.width}
          height={entry.node.height}
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
