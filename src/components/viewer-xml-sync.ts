import type { SlideElement } from '../parser'
import { parseSlideElements } from '../slide-elements-parser'
import { getDirectChildElement } from '../xml-utils'

export function parseSingleElementXml(xmlContent: string, slideId: string): SlideElement {
  const parser = new DOMParser()
  const xmlDoc = parser.parseFromString(`<Elements>${xmlContent}</Elements>`, 'text/xml')
  if (xmlDoc.querySelector('parsererror')) {
    throw new Error('XML 格式有误，请检查标签是否闭合')
  }

  const elementsNode = xmlDoc.documentElement
  const elementNodes = Array.from(elementsNode.children)
  if (elementNodes.length === 0) {
    throw new Error('未识别到可渲染元素，请确认 XML 节点内容')
  }
  if (elementNodes.length > 1) {
    throw new Error('仅支持单个元素 XML，请不要一次粘贴多个节点')
  }
  const [elementNode] = elementNodes
  if (elementNode.tagName === 'Slide') {
    throw new Error('当前是页面 XML，请先选中具体元素后再编辑')
  }

  const parseResult = parseSlideElements(elementsNode, { slideId })
  if (parseResult.elements.length === 0) {
    throw new Error('未识别到可渲染元素，请确认 XML 节点内容')
  }
  if (parseResult.elements.length > 1) {
    throw new Error('仅支持单个元素 XML，请不要一次粘贴多个节点')
  }

  return parseResult.elements[0]
}

function formatCoordinate(value: number): string {
  if (!Number.isFinite(value)) return '0'
  return Number(value.toFixed(3)).toString()
}

function replaceFirstFragment(source: string, target: string, replacement: string): string | null {
  const targetIndex = source.indexOf(target)
  if (targetIndex === -1) return null
  return `${source.slice(0, targetIndex)}${replacement}${source.slice(targetIndex + target.length)}`
}

function patchNodeTextByFragment(xmlContent: string, node: Element, nextValue: string): string | null {
  const serializer = new XMLSerializer()
  const previousNodeXml = serializer.serializeToString(node)
  node.textContent = nextValue
  const nextNodeXml = serializer.serializeToString(node)
  return replaceFirstFragment(xmlContent, previousNodeXml, nextNodeXml)
}

export function syncElementPositionXml(xmlContent: string, nextX: number, nextY: number): string {
  const parser = new DOMParser()
  const xmlDoc = parser.parseFromString(xmlContent, 'text/xml')
  if (xmlDoc.querySelector('parsererror')) return xmlContent

  const root = xmlDoc.documentElement
  const formattedX = formatCoordinate(nextX)
  const formattedY = formatCoordinate(nextY)
  const xNode = getDirectChildElement(root, 'X')
  const yNode = getDirectChildElement(root, 'Y')
  if (xNode && yNode) {
    const xPatchedXml = patchNodeTextByFragment(xmlContent, xNode, formattedX)
    if (xPatchedXml) {
      const yPatchedXml = patchNodeTextByFragment(xPatchedXml, yNode, formattedY)
      if (yPatchedXml) return yPatchedXml
    }

    // 片段替换失败时回退到整节点序列化，确保坐标仍可写回
    xNode.textContent = formattedX
    yNode.textContent = formattedY
    return new XMLSerializer().serializeToString(root)
  }

  const locationNode = getDirectChildElement(root, 'Location')
  if (!locationNode) return xmlContent
  const nextLocation = `${formattedX},${formattedY}`
  const locationPatchedXml = patchNodeTextByFragment(xmlContent, locationNode, nextLocation)
  if (locationPatchedXml) return locationPatchedXml

  locationNode.textContent = nextLocation
  return new XMLSerializer().serializeToString(root)
}
