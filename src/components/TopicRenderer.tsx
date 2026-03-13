import { useState } from 'react'
import type { TopicElement } from '../types'
import { TopicNodeBox } from './topic-renderer/TopicNodeBox'
import {
  buildRenderedNodes,
  getNodeVisualSize,
  renderHorizontalBranchPath,
  renderVerticalBranchPath
} from './topic-renderer/layout'

interface TopicRendererProps {
  element: TopicElement
  scale: number
}

type TopicLayoutMode = 'horizontal' | 'vertical'

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

  const renderedNodes = !rootExpanded
    ? []
    : buildRenderedNodes(
      element.children,
      rootCenterX,
      rootCenterY,
      rootWidth,
      rootHeight,
      layoutMode,
      isNodeExpanded
    )

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
