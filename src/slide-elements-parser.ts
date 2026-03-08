import type { SlideElement, ShapeElement, PictureElement } from './types'
import { parseShapeElement } from './shapes'
import { parsePictureElement } from './pictures'
import { parseTextElement } from './text-parser'
import { getDirectChildElement, getDirectChildText } from './xml-utils'

interface ParseElementsOptions {
  slideId: string
  offsetX?: number
  offsetY?: number
}

function parseNumber(value: string | null, fallback = 0): number {
  if (!value) return fallback
  const parsed = parseFloat(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function applyOffset<T extends SlideElement>(element: T, offsetX: number, offsetY: number): T {
  return {
    ...element,
    x: element.x + offsetX,
    y: element.y + offsetY
  }
}

export function parseSlideElements(elementsNode: Element, options: ParseElementsOptions): SlideElement[] {
  const { slideId, offsetX = 0, offsetY = 0 } = options
  const parsedElements: SlideElement[] = []
  const allChildNodes = Array.from(elementsNode.children)

  allChildNodes.forEach((node, index) => {
    const tagName = node.tagName

    switch (tagName) {
      case 'Text': {
        const textElement = parseTextElement(node)
        if (textElement) {
          parsedElements.push(applyOffset(textElement, offsetX, offsetY))
        }
        break
      }
      case 'Shape': {
        const shapeElement = parseShapeElement(node)
        if (shapeElement) {
          parsedElements.push(applyOffset(shapeElement as ShapeElement, offsetX, offsetY))
        }
        break
      }
      case 'Picture': {
        const pictureElement = parsePictureElement(node)
        if (pictureElement) {
          parsedElements.push(applyOffset(pictureElement as PictureElement, offsetX, offsetY))
        }
        break
      }
      case 'Group': {
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
        parsedElements.push(...groupChildren)
        break
      }
      default: {
        const elementId = getDirectChildText(node, 'Id') || `${tagName.toLowerCase()}-${index}`
        const x = parseNumber(getDirectChildText(node, 'X')) + offsetX
        const y = parseNumber(getDirectChildText(node, 'Y')) + offsetY
        const width = parseNumber(getDirectChildText(node, 'Width'), 200)
        const height = parseNumber(getDirectChildText(node, 'Height'), 100)

        console.warn(`[Slide ${slideId}] ⚠️ 未支持的元素类型: ${tagName}`)

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

  return parsedElements
}
