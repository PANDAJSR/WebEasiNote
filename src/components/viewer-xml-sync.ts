import type { SlideElement } from '../parser'
import { parseSlideElements } from '../slide-elements-parser'

export function parseSingleElementXml(xmlContent: string, slideId: string): SlideElement {
  const parser = new DOMParser()
  const xmlDoc = parser.parseFromString(`<Elements>${xmlContent}</Elements>`, 'text/xml')
  if (xmlDoc.querySelector('parsererror')) {
    throw new Error('XML 格式有误，请检查标签是否闭合')
  }

  const elementsNode = xmlDoc.documentElement
  const parseResult = parseSlideElements(elementsNode, { slideId })
  if (parseResult.elements.length === 0) {
    throw new Error('未识别到可渲染元素，请确认 XML 节点内容')
  }
  if (parseResult.elements.length > 1) {
    throw new Error('仅支持单个元素 XML，请不要一次粘贴多个节点')
  }

  return parseResult.elements[0]
}
