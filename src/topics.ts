import type { TopicElement, TopicNode } from './types'
import { getDirectChildElement, getDirectChildText, parseColor } from './xml-utils'
import { convertSeewoFontSizeToCssPx } from './font-utils'

interface ParsedTitleStyle {
  text: string
  fontFamily: string
  fontSize: number
  textColor: string
}

function parseNumber(value: string | null, fallback = 0): number {
  if (!value) return fallback
  const parsed = parseFloat(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function parsePoint(value: string | null): { x: number; y: number } {
  if (!value) {
    return { x: 0, y: 0 }
  }

  const parts = value.split(',').map(part => parseFloat(part.trim()))
  if (parts.length !== 2 || parts.some(part => !Number.isFinite(part))) {
    return { x: 0, y: 0 }
  }

  return {
    x: parts[0],
    y: parts[1]
  }
}

function parseTitleStyle(titleNode: Element | null): ParsedTitleStyle {
  if (!titleNode) {
    return {
      text: '',
      fontFamily: 'Arial',
      fontSize: 24,
      textColor: '#000000'
    }
  }

  const text =
    getDirectChildText(titleNode, 'Text')
    || titleNode.querySelector('TextRuns > TextRun > Text')?.textContent
    || ''

  const fontFamily =
    titleNode.querySelector('TextRuns > TextRun > FontFamily > Source')?.textContent
    || titleNode.querySelector('DefaultRunProperty > TextRun > FontFamily > Source')?.textContent
    || 'Arial'

  const fontSizeRaw = parseNumber(
    titleNode.querySelector('TextRuns > TextRun > FontSize')?.textContent
    || titleNode.querySelector('DefaultRunProperty > TextRun > FontSize')?.textContent
    || null,
    24
  )

  const colorRaw =
    titleNode.querySelector('TextRuns > TextRun > Foreground > ColorBrush')?.textContent
    || titleNode.querySelector('DefaultRunProperty > TextRun > Foreground > ColorBrush')?.textContent
    || '#ff000000'

  return {
    text: text.trim(),
    fontFamily: fontFamily.trim() || 'Arial',
    fontSize: convertSeewoFontSizeToCssPx(fontSizeRaw),
    textColor: parseColor(colorRaw, true)
  }
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
