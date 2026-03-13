import type { TopicElement, TopicNode } from './types'
import { getDirectChildElement, getDirectChildText, parseColor } from './xml-utils'
import { parsePoint, parseTitleStyle } from './topics-text-parser'

function parseNumber(value: string | null, fallback = 0): number {
  if (!value) return fallback
  const parsed = parseFloat(value)
  return Number.isFinite(parsed) ? parsed : fallback
}


function parseNodeStyle(node: Element, fallbackFill: string, fallbackStroke: string): { fillColor: string; strokeColor: string } {
  const fillRaw =
    getDirectChildElement(node, 'NodeStyle')?.querySelector('Fill > ColorBrush')?.textContent
    || getDirectChildElement(node, 'NodeStyleInfo')?.querySelector('Fill > ColorBrush')?.textContent

  const strokeRaw =
    getDirectChildElement(node, 'NodeStyle')?.querySelector('Stroke > ColorBrush')?.textContent
    || getDirectChildElement(node, 'NodeStyleInfo')?.querySelector('Stroke > ColorBrush')?.textContent

  return {
    fillColor: fillRaw ? parseColor(fillRaw, true) : fallbackFill,
    strokeColor: strokeRaw ? parseColor(strokeRaw, true) : fallbackStroke
  }
}

function parseTopicNode(nodeElement: Element, fallbackFill: string, fallbackStroke: string): TopicNode {
  const title = parseTitleStyle(getDirectChildElement(nodeElement, 'Title'))
  const location = parsePoint(getDirectChildText(nodeElement, 'Location'))
  const nodeStyle = parseNodeStyle(nodeElement, fallbackFill, fallbackStroke)
  const width = parseNumber(getDirectChildText(nodeElement, 'ContentWidth'), 140)
  const height = parseNumber(getDirectChildText(nodeElement, 'ContentHeight'), 46)
  const id =
    getDirectChildText(nodeElement, 'NodeId')
    || `node-${location.x.toFixed(1)}-${location.y.toFixed(1)}`

  const childrenContainer = getDirectChildElement(nodeElement, 'Children')
  const childNodes = childrenContainer
    ? Array.from(childrenContainer.children)
      .filter(child => child.tagName === 'Node')
      .map(child => parseTopicNode(child, fallbackFill, fallbackStroke))
    : []

  return {
    id,
    title: title.text,
    textLines: title.textLines,
    textAlignment: title.textAlignment,
    location,
    contentWidth: width,
    contentHeight: height,
    fillColor: nodeStyle.fillColor,
    strokeColor: nodeStyle.strokeColor,
    textColor: title.textColor,
    fontFamily: title.fontFamily,
    fontSize: title.fontSize,
    children: childNodes
  }
}

export function parseTopicElement(topicNode: Element): TopicElement | null {
  try {
    const id = getDirectChildText(topicNode, 'Id') || 'unknown-topic'
    const x = parseNumber(getDirectChildText(topicNode, 'X'))
    const y = parseNumber(getDirectChildText(topicNode, 'Y'))
    const width = parseNumber(getDirectChildText(topicNode, 'Width'), 320)
    const height = parseNumber(getDirectChildText(topicNode, 'Height'), 200)
    const rotation = parseNumber(getDirectChildText(topicNode, 'Rotation'))
    const topicType = getDirectChildText(topicNode, 'Type') || 'MindMap'
    const branchType = getDirectChildText(topicNode, 'BranchType') || 'Ellipse'

    const contentWidth = parseNumber(getDirectChildText(topicNode, 'ContentWidth'), 180)
    const contentHeight = parseNumber(getDirectChildText(topicNode, 'ContentHeight'), 56)

    const rootTitle = parseTitleStyle(getDirectChildElement(topicNode, 'Title'))
    const rootStyle = parseNodeStyle(topicNode, '#dce8ff', '#86a7dc')

    const branchColorRaw =
      getDirectChildElement(topicNode, 'Skin')?.querySelector('TreeStroke > ColorBrush')?.textContent
      || getDirectChildElement(topicNode, 'SkinInfo')?.querySelector('TreeStroke > ColorBrush')?.textContent
      || getDirectChildElement(topicNode, 'Skin')?.querySelector('HighLevelBranchFill > ColorBrush')?.textContent
      || '#ff6c8fda'

    const childrenContainer = getDirectChildElement(topicNode, 'Children')
    const children = childrenContainer
      ? Array.from(childrenContainer.children)
        .filter(child => child.tagName === 'Node')
        .map(child => parseTopicNode(child, '#f3f7ff', '#8ea7df'))
      : []

    return {
      type: 'topic',
      id,
      x,
      y,
      width,
      height,
      rotation,
      topicType,
      branchType,
      title: rootTitle.text,
      textLines: rootTitle.textLines,
      textAlignment: rootTitle.textAlignment,
      contentWidth,
      contentHeight,
      fillColor: rootStyle.fillColor,
      strokeColor: rootStyle.strokeColor,
      textColor: rootTitle.textColor,
      fontFamily: rootTitle.fontFamily,
      fontSize: rootTitle.fontSize,
      branchColor: parseColor(branchColorRaw, true),
      children
    }
  } catch (error) {
    console.error('[Topic] 解析失败', error)
    return null
  }
}
