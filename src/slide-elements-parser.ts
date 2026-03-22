import type { SlideElement, ShapeElement, PictureElement, VideoElement, SlideIssue } from './types'
import { parseShapeElement } from './shapes'
import { parsePictureElement } from './pictures'
import { parseVideoElement } from './videos'
import { parseTextElement } from './text-parser'
import { parseTableElement } from './tables'
import { parseTopicElement } from './topics'
import { parseCylinderElement } from './cylinders'
import { parseConeElement } from './cones'
import { parseCubeElement } from './cubes'
import { parseGeometryElement } from './geometries'
import { parseMathFormulaElement } from './math-formulas'
import { parseRuledPaperElement } from './ruled-papers'
import { getDirectChildElement, getDirectChildText } from './xml-utils'
import { KNOWN_PARAMETERS } from './slide-elements-known-parameters'

interface ParseElementsOptions {
  slideId: string
  offsetX?: number
  offsetY?: number
  rawXmlByIndex?: string[]
}

interface ParseSlideElementsResult {
  elements: SlideElement[]
  issues: SlideIssue[]
}

function formatXml(xml: string): string {
  const normalized = xml
    .replace(/>\s*</g, '><')
    .replace(/(>)(<)(\/*)/g, '$1\n$2$3')
    .trim()
  const lines = normalized.split('\n')
  let indentLevel = 0

  return lines
    .map(rawLine => {
      const line = rawLine.trim()
      if (!line) return ''
      if (line.startsWith('</')) {
        indentLevel = Math.max(0, indentLevel - 1)
      }
      const indentedLine = `${'  '.repeat(indentLevel)}${line}`
      if (line.startsWith('<') && !line.startsWith('</') && !line.endsWith('/>') && !line.includes('</')) {
        indentLevel += 1
      }
      return indentedLine
    })
    .join('\n')
}

function serializeElementXml(node: Element): string {
  const serializer = new XMLSerializer()
  return formatXml(serializer.serializeToString(node))
}

function parseNumber(value: string | null, fallback = 0): number {
  if (!value) return fallback
  const parsed = parseFloat(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function previewValue(node: Element): string {
  const text = node.textContent?.trim() || ''
  if (text.length <= 80) return text
  return `${text.slice(0, 80)}...`
}

function collectUnknownParameters(
  node: Element,
  elementType: keyof typeof KNOWN_PARAMETERS,
  slideId: string,
  elementId: string,
  issues: SlideIssue[]
) {
  const knownParams = KNOWN_PARAMETERS[elementType]
  Array.from(node.children).forEach(child => {
    if (knownParams.has(child.tagName)) return
    issues.push({
      kind: 'unknown-parameter',
      slideId,
      elementType,
      elementId,
      name: child.tagName,
      value: previewValue(child)
    })
  })
}

function applyOffset<T extends SlideElement>(element: T, offsetX: number, offsetY: number): T {
  return {
    ...element,
    x: element.x + offsetX,
    y: element.y + offsetY
  }
}

export function parseSlideElements(elementsNode: Element, options: ParseElementsOptions): ParseSlideElementsResult {
  const { slideId, offsetX = 0, offsetY = 0, rawXmlByIndex } = options
  const parsedElements: SlideElement[] = []
  const issues: SlideIssue[] = []
  const allChildNodes = Array.from(elementsNode.children)

  allChildNodes.forEach((node, index) => {
    const tagName = node.tagName
    const elementId = getDirectChildText(node, 'Id') || `${tagName.toLowerCase()}-${index}`
    const rawXml = rawXmlByIndex?.[index] || serializeElementXml(node)

    switch (tagName) {
      case 'Text': {
        collectUnknownParameters(node, 'Text', slideId, elementId, issues)
        const textElement = parseTextElement(node)
        if (textElement) {
          parsedElements.push({
            ...applyOffset(textElement, offsetX, offsetY),
            rawXml
          })
        }
        break
      }
      case 'Shape': {
        collectUnknownParameters(node, 'Shape', slideId, elementId, issues)
        const shapeElement = parseShapeElement(node)
        if (shapeElement) {
          parsedElements.push({
            ...applyOffset(shapeElement as ShapeElement, offsetX, offsetY),
            rawXml
          })
        }
        break
      }
      case 'Picture': {
        collectUnknownParameters(node, 'Picture', slideId, elementId, issues)
        const pictureElement = parsePictureElement(node)
        if (pictureElement) {
          parsedElements.push({
            ...applyOffset(pictureElement as PictureElement, offsetX, offsetY),
            rawXml
          })
        }
        break
      }
      case 'Video': {
        collectUnknownParameters(node, 'Video', slideId, elementId, issues)
        const videoElement = parseVideoElement(node)
        if (videoElement) {
          parsedElements.push({
            ...applyOffset(videoElement as VideoElement, offsetX, offsetY),
            rawXml
          })
        }
        break
      }
      case 'Table': {
        collectUnknownParameters(node, 'Table', slideId, elementId, issues)
        const tableElement = parseTableElement(node)
        if (tableElement) {
          parsedElements.push({
            ...applyOffset(tableElement, offsetX, offsetY),
            rawXml
          })
        }
        break
      }
      case 'Group': {
        collectUnknownParameters(node, 'Group', slideId, elementId, issues)
        const groupX = parseNumber(getDirectChildText(node, 'X'))
        const groupY = parseNumber(getDirectChildText(node, 'Y'))
        const groupRotation = parseNumber(getDirectChildText(node, 'Rotation'))

        if (groupRotation !== 0) {
          console.warn(`[Slide ${slideId}] ⚠️ Group 旋转暂未支持，将按未旋转处理（rotation=${groupRotation}）`)
        }

        const childElementsNode = getDirectChildElement(node, 'Elements')
        if (!childElementsNode) {
          console.warn(`[Slide ${slideId}] ⚠️ Group 缺少 Elements 节点，已跳过`)
          break
        }

        const groupChildren = parseSlideElements(childElementsNode, {
          slideId,
          offsetX: offsetX + groupX,
          offsetY: offsetY + groupY
        })
        parsedElements.push(...groupChildren.elements)
        issues.push(...groupChildren.issues)
        break
      }
      case 'Topic': {
        collectUnknownParameters(node, 'Topic', slideId, elementId, issues)
        const topicElement = parseTopicElement(node)
        if (topicElement) {
          parsedElements.push({
            ...applyOffset(topicElement, offsetX, offsetY),
            rawXml
          })
        }
        break
      }
      case 'Cylinder': {
        collectUnknownParameters(node, 'Cylinder', slideId, elementId, issues)
        const cylinderElement = parseCylinderElement(node)
        if (cylinderElement) {
          parsedElements.push({
            ...applyOffset(cylinderElement, offsetX, offsetY),
            rawXml
          })
        }
        break
      }
      case 'Cone': {
        collectUnknownParameters(node, 'Cone', slideId, elementId, issues)
        const coneElement = parseConeElement(node)
        if (coneElement) {
          parsedElements.push({
            ...applyOffset(coneElement, offsetX, offsetY),
            rawXml
          })
        }
        break
      }
      case 'Cube': {
        collectUnknownParameters(node, 'Cube', slideId, elementId, issues)
        const cubeElement = parseCubeElement(node)
        if (cubeElement) {
          parsedElements.push({
            ...applyOffset(cubeElement, offsetX, offsetY),
            rawXml
          })
        }
        break
      }
      case 'GeometryElement': {
        collectUnknownParameters(node, 'GeometryElement', slideId, elementId, issues)
        const geometryElement = parseGeometryElement(node)
        if (geometryElement) {
          parsedElements.push({
            ...applyOffset(geometryElement, offsetX, offsetY),
            rawXml
          })
        }
        break
      }
      case 'MathFormula': {
        collectUnknownParameters(node, 'MathFormula', slideId, elementId, issues)
        const mathFormulaElement = parseMathFormulaElement(node)
        if (mathFormulaElement) {
          parsedElements.push({
            ...applyOffset(mathFormulaElement, offsetX, offsetY),
            rawXml
          })
        }
        break
      }
      case 'RuledPaper': {
        collectUnknownParameters(node, 'RuledPaper', slideId, elementId, issues)
        const ruledPaperElement = parseRuledPaperElement(node)
        if (ruledPaperElement) {
          parsedElements.push({
            ...applyOffset(ruledPaperElement, offsetX, offsetY),
            rawXml
          })
        }
        break
      }
      default: {
        const x = parseNumber(getDirectChildText(node, 'X')) + offsetX
        const y = parseNumber(getDirectChildText(node, 'Y')) + offsetY
        const width = parseNumber(getDirectChildText(node, 'Width'), 200)
        const height = parseNumber(getDirectChildText(node, 'Height'), 100)

        console.warn(`[Slide ${slideId}] ⚠️ 未支持的元素类型: ${tagName}`)
        issues.push({
          kind: 'unknown-element',
          slideId,
          elementType: tagName,
          elementId,
          name: tagName
        })
        Array.from(node.children).forEach(child => {
          issues.push({
            kind: 'unknown-parameter',
            slideId,
            elementType: tagName,
            elementId,
            name: child.tagName,
            value: previewValue(child)
          })
        })

        parsedElements.push({
          type: 'unknown',
          id: elementId,
          rawXml,
          x,
          y,
          width,
          height,
          originalType: tagName
        })
        break
      }
    }
  })

  return {
    elements: parsedElements,
    issues
  }
}
