import { convertSeewoLineSpacingToMultiplier } from '../../line-spacing'
import type { TextLine, TopicNode } from '../../types'

export interface RenderNode {
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

const HORIZONTAL_NODE_PADDING = 6
const VERTICAL_NODE_PADDING = 4
const HORIZONTAL_NODE_GAP_X = 92
const HORIZONTAL_NODE_GAP_Y = 26
const VERTICAL_NODE_GAP_X = 34
const VERTICAL_NODE_GAP_Y = 68
const TOPIC_TEXT_LINE_HEIGHT = 1.1

function estimateSingleLineTextWidth(text: string, fontSize: number): number {
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

export function getNodeVisualSize(
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

export function sumWithGap(values: number[], gap: number): number {
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

export function buildRenderedNodes(
  children: TopicNode[],
  rootCenterX: number,
  rootCenterY: number,
  rootWidth: number,
  rootHeight: number,
  layoutMode: 'horizontal' | 'vertical',
  isNodeExpanded: (id: string) => boolean
): RenderNode[] {
  if (layoutMode === 'vertical') {
    const measured = children.map(child => measureVerticalNode(child, isNodeExpanded))
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

  const measured = children.map(child => measureHorizontalNode(child, isNodeExpanded))
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
}

export function renderHorizontalBranchPath(entry: RenderNode, scale: number) {
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
  const c2x = endX - dx * direction

  return `M ${startX} ${startY} C ${c1x} ${startY}, ${c2x} ${endY}, ${endX} ${endY}`
}

export function renderVerticalBranchPath(entry: RenderNode, scale: number) {
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
