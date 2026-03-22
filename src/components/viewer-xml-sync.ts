import type { SlideElement, TextLine } from '../parser'
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

export function syncElementBoundsXml(
  xmlContent: string,
  nextX: number,
  nextY: number,
  nextWidth: number,
  nextHeight: number
): string {
  const parser = new DOMParser()
  const xmlDoc = parser.parseFromString(xmlContent, 'text/xml')
  if (xmlDoc.querySelector('parsererror')) return xmlContent

  const root = xmlDoc.documentElement
  const formattedX = formatCoordinate(nextX)
  const formattedY = formatCoordinate(nextY)
  const formattedWidth = formatCoordinate(nextWidth)
  const formattedHeight = formatCoordinate(nextHeight)
  let patchedXml = xmlContent

  const xNode = getDirectChildElement(root, 'X')
  const yNode = getDirectChildElement(root, 'Y')
  const widthNode = getDirectChildElement(root, 'Width')
  const heightNode = getDirectChildElement(root, 'Height')

  if (xNode) {
    const nextXml = patchNodeTextByFragment(patchedXml, xNode, formattedX)
    if (nextXml) patchedXml = nextXml
    else xNode.textContent = formattedX
  }
  if (yNode) {
    const nextXml = patchNodeTextByFragment(patchedXml, yNode, formattedY)
    if (nextXml) patchedXml = nextXml
    else yNode.textContent = formattedY
  }
  if (widthNode) {
    const nextXml = patchNodeTextByFragment(patchedXml, widthNode, formattedWidth)
    if (nextXml) patchedXml = nextXml
    else widthNode.textContent = formattedWidth
  }
  if (heightNode) {
    const nextXml = patchNodeTextByFragment(patchedXml, heightNode, formattedHeight)
    if (nextXml) patchedXml = nextXml
    else heightNode.textContent = formattedHeight
  }

  const locationNode = getDirectChildElement(root, 'Location')
  if (locationNode) {
    const nextLocation = `${formattedX},${formattedY}`
    const locationPatchedXml = patchNodeTextByFragment(patchedXml, locationNode, nextLocation)
    if (locationPatchedXml) patchedXml = locationPatchedXml
    else locationNode.textContent = nextLocation
  }

  const sizeNode = getDirectChildElement(root, 'Size')
  if (sizeNode) {
    const nextSize = `${formattedWidth},${formattedHeight}`
    const sizePatchedXml = patchNodeTextByFragment(patchedXml, sizeNode, nextSize)
    if (sizePatchedXml) patchedXml = sizePatchedXml
    else sizeNode.textContent = nextSize
  }

  // 任一片段替换失败后，至少确保更新后的 DOM 可被序列化写回
  if (patchedXml === xmlContent) {
    return new XMLSerializer().serializeToString(root)
  }
  return patchedXml
}

function getOrCreateDirectChild(root: Element, tagName: string): Element {
  const current = getDirectChildElement(root, tagName)
  if (current) return current
  const created = root.ownerDocument.createElement(tagName)
  root.appendChild(created)
  return created
}

function updateDirectChildText(root: Element, tagName: string, value: string) {
  const node = getOrCreateDirectChild(root, tagName)
  node.textContent = value
}

function getTextLinePlainText(line: TextLine): string {
  return line.textRuns.map(run => (run.text || '').replace(/\r?\n/g, '')).join('')
}

function syncTextLineRangeMeta(lineNode: Element, lineText: string) {
  const linesNode = getOrCreateDirectChild(lineNode, 'Lines')
  const existingProperties = Array.from(linesNode.querySelectorAll(':scope > LineProperty'))
  const fallbackProperty = existingProperties[existingProperties.length - 1] || lineNode.ownerDocument.createElement('LineProperty')
  const totalLength = lineText.length
  while (linesNode.firstChild) {
    linesNode.removeChild(linesNode.firstChild)
  }

  // 保留原有 LineProperty 分段数量，避免把官方多段结构压扁成单段
  const segmentTemplates = existingProperties.length > 0 ? existingProperties : [fallbackProperty]
  const originalLengths = segmentTemplates.map(property => {
    const lengthNode = getDirectChildElement(property, 'Length')
    const raw = lengthNode?.textContent?.trim() || '0'
    const value = Number.parseInt(raw, 10)
    return Number.isFinite(value) && value > 0 ? value : 0
  })
  const originalTotal = originalLengths.reduce((sum, value) => sum + value, 0)

  let nextLengths: number[]
  if (totalLength <= 0) {
    nextLengths = new Array(segmentTemplates.length).fill(0)
  } else if (segmentTemplates.length === 1) {
    nextLengths = [totalLength]
  } else if (originalTotal <= 0) {
    // 原始长度不可用时均分，余数前置
    const base = Math.floor(totalLength / segmentTemplates.length)
    const remainder = totalLength % segmentTemplates.length
    nextLengths = segmentTemplates.map((_, index) => base + (index < remainder ? 1 : 0))
  } else {
    // 按原分段比例分配新长度，并修正总和误差
    nextLengths = originalLengths.map(length => Math.floor((length / originalTotal) * totalLength))
    let assigned = nextLengths.reduce((sum, value) => sum + value, 0)
    let remaining = totalLength - assigned
    const sortedIndexes = originalLengths
      .map((length, index) => ({ length, index }))
      .sort((a, b) => b.length - a.length)
      .map(item => item.index)
    let pointer = 0
    while (remaining > 0) {
      const index = sortedIndexes[pointer % sortedIndexes.length]
      nextLengths[index] += 1
      remaining -= 1
      pointer += 1
    }
  }

  let startOffset = 0
  segmentTemplates.forEach((template, index) => {
    const linePropertyNode = template.cloneNode(true) as Element
    const lengthValue = Math.max(0, nextLengths[index] || 0)
    updateDirectChildText(linePropertyNode, 'StartOffset', String(startOffset))
    updateDirectChildText(linePropertyNode, 'Length', String(lengthValue))
    linesNode.appendChild(linePropertyNode)
    startOffset += lengthValue
  })
}

export function syncTextElementContentXml(xmlContent: string, nextTextLines: TextLine[]): string {
  const parser = new DOMParser()
  const xmlDoc = parser.parseFromString(xmlContent, 'text/xml')
  if (xmlDoc.querySelector('parsererror')) return xmlContent

  const root = xmlDoc.documentElement
  const richTextNode = getDirectChildElement(root, 'RichText') || root.querySelector('RichText')
  if (!richTextNode) return xmlContent

  const textLinesNode = getOrCreateDirectChild(richTextNode, 'TextLines')
  const currentLineNodes = Array.from(textLinesNode.querySelectorAll(':scope > TextLine'))
  const fallbackLineTemplate = currentLineNodes[currentLineNodes.length - 1] || xmlDoc.createElement('TextLine')

  while (textLinesNode.firstChild) {
    textLinesNode.removeChild(textLinesNode.firstChild)
  }

  const fallbackLine: TextLine = {
    textRuns: [{
      text: '',
      fontFamily: 'Arial',
      fontSize: 16,
      fontStyle: 'normal',
      fontWeight: 'normal',
      color: '#000000'
    }],
    textAlignment: 'Left',
    textMarker: 'None'
  }
  const safeLines: TextLine[] = nextTextLines.length > 0 ? nextTextLines : [fallbackLine]

  safeLines.forEach((line, lineIndex) => {
    const sourceLineTemplate = currentLineNodes[lineIndex] || fallbackLineTemplate
    const lineNode = sourceLineTemplate.cloneNode(true) as Element
    const sourceRunNodes = Array.from(lineNode.querySelectorAll(':scope > TextRuns > TextRun'))
    const fallbackRunTemplate = sourceRunNodes[sourceRunNodes.length - 1] || xmlDoc.createElement('TextRun')
    const textRunsNode = getOrCreateDirectChild(lineNode, 'TextRuns')

    updateDirectChildText(lineNode, 'TextAlignment', line.textAlignment || 'Left')
    if (line.textMarker) {
      updateDirectChildText(lineNode, 'TextMarker', line.textMarker)
    }

    while (textRunsNode.firstChild) {
      textRunsNode.removeChild(textRunsNode.firstChild)
    }

    const safeRuns = line.textRuns.length > 0 ? line.textRuns : [{
      text: '',
      fontFamily: 'Arial',
      fontSize: 16,
      fontStyle: 'normal' as const,
      fontWeight: 'normal' as const,
      color: '#000000'
    }]

    safeRuns.forEach((run, runIndex) => {
      const sourceRunTemplate = sourceRunNodes[runIndex] || fallbackRunTemplate
      const runNode = sourceRunTemplate.cloneNode(true) as Element
      updateDirectChildText(runNode, 'Text', run.text)
      textRunsNode.appendChild(runNode)
    })

    syncTextLineRangeMeta(lineNode, getTextLinePlainText(line))
    textLinesNode.appendChild(lineNode)
  })

  updateDirectChildText(
    richTextNode,
    'Text',
    // 希沃 RichText/Text 的换行通常是 CRLF（序列化后常见为 &#13; + 换行）
    safeLines.map(getTextLinePlainText).join('\r\n')
  )

  return new XMLSerializer().serializeToString(root)
}
