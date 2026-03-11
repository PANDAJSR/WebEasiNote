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
import { getDirectChildElement, getDirectChildText } from './xml-utils'

interface ParseElementsOptions {
  slideId: string
  offsetX?: number
  offsetY?: number
}

interface ParseSlideElementsResult {
  elements: SlideElement[]
  issues: SlideIssue[]
}

const KNOWN_PARAMETERS: Record<string, Set<string>> = {
  Text: new Set(['Id', 'X', 'Y', 'Width', 'Height', 'Rotation', 'BorderThickness', 'BorderType', 'RichText']),
  Shape: new Set([
    'Id',
    'X',
    'Y',
    'Width',
    'Height',
    'Rotation',
    'Opacity',
    'Background',
    'Foreground',
    'Path',
    'FillRule',
    'PathFillRule',
    'Geometry',
    'Thickness',
    'LineType',
    'InlineText',
    'Effects'
  ]),
  Picture: new Set([
    'Id',
    'X',
    'Y',
    'Width',
    'Height',
    'Source',
    'PictureName',
    'Alpha',
    'Rotation',
    'DisplayRegion',
    'MetaData'
  ]),
  Video: new Set([
    'Id',
    'X',
    'Y',
    'Width',
    'Height',
    'Source',
    'MediaName',
    'ClipStart',
    'Volume',
    'Rotation',
    'PlayPoints',
    'NaturalVideoRotation',
    'NaturalVideoRotationAdapted',
    'ElementBehavior',
    'Thumbnail'
  ]),
  Table: new Set([
    'Id',
    'X',
    'Y',
    'Width',
    'Height',
    'Rotation',
    'CellHPadding',
    'CellVPadding',
    'Skin',
    'ColumnWidths',
    'Rows',
    'RotateOrigin',
    'ShowRotateOrigin',
    'IsLocked',
    'SaveInfoMetadata',
    'CanClone'
  ]),
  Group: new Set(['Id', 'X', 'Y', 'Width', 'Height', 'Rotation', 'Elements']),
  Topic: new Set([
    'Title',
    'Type',
    'Skin',
    'SkinInfo',
    'NodeLink',
    'RelationalId',
    'ContentWidth',
    'ContentHeight',
    'ExpandBehavior',
    'RightSubHide',
    'IsSymmetry',
    'Erasable',
    'NodeStyle',
    'NodeStyleInfo',
    'BranchType',
    'Children',
    'Rotation',
    'RotateOrigin',
    'X',
    'Y',
    'Width',
    'Height',
    'ShowRotateOrigin',
    'IsLocked',
    'SaveInfoMetadata',
    'Id',
    'CanClone'
  ]),
  Cylinder: new Set([
    'ExpandType',
    'ExpandDuration',
    'ExpandedViewport',
    'FoldedViewport',
    'Size',
    'Transform3D',
    'EdgeThickness',
    'EdgeBrush',
    'Surfaces',
    'Edges',
    'Id',
    'X',
    'Y',
    'Width',
    'Height',
    'Rotation',
    'IsLocked',
    'CanClone',
    'Hyperlink',
    'HasMask',
    'RotateOrigin',
    'SaveInfoMetadata'
  ]),
  Cone: new Set([
    'ExpandType',
    'ExpandDuration',
    'ExpandedViewport',
    'FoldedViewport',
    'Size',
    'Transform3D',
    'EdgeThickness',
    'EdgeBrush',
    'Surfaces',
    'Edges',
    'Id',
    'X',
    'Y',
    'Width',
    'Height',
    'Rotation',
    'IsLocked',
    'CanClone',
    'Hyperlink',
    'HasMask',
    'RotateOrigin',
    'SaveInfoMetadata'
  ]),
  Cube: new Set([
    'ExpandType',
    'ExpandDuration',
    'ExpandedViewport',
    'FoldedViewport',
    'Size',
    'Transform3D',
    'EdgeThickness',
    'EdgeBrush',
    'Surfaces',
    'Edges',
    'Id',
    'X',
    'Y',
    'Width',
    'Height',
    'Rotation',
    'IsLocked',
    'CanClone',
    'Hyperlink',
    'HasMask',
    'RotateOrigin',
    'SaveInfoMetadata'
  ])
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
  const { slideId, offsetX = 0, offsetY = 0 } = options
  const parsedElements: SlideElement[] = []
  const issues: SlideIssue[] = []
  const allChildNodes = Array.from(elementsNode.children)

  allChildNodes.forEach((node, index) => {
    const tagName = node.tagName
    const elementId = getDirectChildText(node, 'Id') || `${tagName.toLowerCase()}-${index}`

    switch (tagName) {
      case 'Text': {
        collectUnknownParameters(node, 'Text', slideId, elementId, issues)
        const textElement = parseTextElement(node)
        if (textElement) {
          parsedElements.push(applyOffset(textElement, offsetX, offsetY))
        }
        break
      }
      case 'Shape': {
        collectUnknownParameters(node, 'Shape', slideId, elementId, issues)
        const shapeElement = parseShapeElement(node)
        if (shapeElement) {
          parsedElements.push(applyOffset(shapeElement as ShapeElement, offsetX, offsetY))
        }
        break
      }
      case 'Picture': {
        collectUnknownParameters(node, 'Picture', slideId, elementId, issues)
        const pictureElement = parsePictureElement(node)
        if (pictureElement) {
          parsedElements.push(applyOffset(pictureElement as PictureElement, offsetX, offsetY))
        }
        break
      }
      case 'Video': {
        collectUnknownParameters(node, 'Video', slideId, elementId, issues)
        const videoElement = parseVideoElement(node)
        if (videoElement) {
          parsedElements.push(applyOffset(videoElement as VideoElement, offsetX, offsetY))
        }
        break
      }
      case 'Table': {
        collectUnknownParameters(node, 'Table', slideId, elementId, issues)
        const tableElement = parseTableElement(node)
        if (tableElement) {
          parsedElements.push(applyOffset(tableElement, offsetX, offsetY))
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
          parsedElements.push(applyOffset(topicElement, offsetX, offsetY))
        }
        break
      }
      case 'Cylinder': {
        collectUnknownParameters(node, 'Cylinder', slideId, elementId, issues)
        const cylinderElement = parseCylinderElement(node)
        if (cylinderElement) {
          parsedElements.push(applyOffset(cylinderElement, offsetX, offsetY))
        }
        break
      }
      case 'Cone': {
        collectUnknownParameters(node, 'Cone', slideId, elementId, issues)
        const coneElement = parseConeElement(node)
        if (coneElement) {
          parsedElements.push(applyOffset(coneElement, offsetX, offsetY))
        }
        break
      }
      case 'Cube': {
        collectUnknownParameters(node, 'Cube', slideId, elementId, issues)
        const cubeElement = parseCubeElement(node)
        if (cubeElement) {
          parsedElements.push(applyOffset(cubeElement, offsetX, offsetY))
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
