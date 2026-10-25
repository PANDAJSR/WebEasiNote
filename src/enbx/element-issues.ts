import type { SlideIssue } from '../types'
import { KNOWN_PARAMETERS } from './slide-elements-known-parameters'
import { getDirectChildElement, getDirectChildText } from './xml-utils'

export function previewValue(node: Element): string {
  // 诊断只取短预览，避免为几万节点的几何扩展拼接完整 textContent。
  const walker = node.ownerDocument.createTreeWalker(node, 4)
  let text = ''
  let child = walker.nextNode()
  while (child && text.length <= 80) {
    const part = child.nodeValue || ''
    text += (text ? part : part.trimStart()).slice(0, 81 - text.length)
    child = walker.nextNode()
  }
  text = text.trim()
  return text.length <= 80 ? text : `${text.slice(0, 80)}...`
}

export function collectUnknownParameters(node: Element, elementType: string, slideId: string,
  elementId: string, issues: SlideIssue[]) {
  const knownParams = KNOWN_PARAMETERS[elementType]
  Array.from(node.children).forEach(child => {
    if (knownParams.has(child.tagName) || child.tagName === 'IsLocked' || child.tagName === 'CanClone') return
    issues.push({ kind: 'unknown-parameter', slideId, elementType, elementId,
      name: child.tagName, value: previewValue(child) })
  })
  if (elementType === 'Picture') collectPictureStyleIssues(node, slideId, elementId, issues)
}

/** 已支持的 Style 不再误报；未知相框/特效仍明确保留诊断。 */
function collectPictureStyleIssues(node: Element, slideId: string, elementId: string, issues: SlideIssue[]) {
  const style = getDirectChildElement(node, 'Style')
  if (!style) return
  const report = (name: string, value: string) => issues.push({ kind: 'unknown-parameter',
    slideId, elementId, elementType: 'Picture', name, value })
  const frame = getDirectChildElement(style, 'PictureRahmenStyle')
  const type = frame && getDirectChildText(frame, 'RahmenStyle')
  if (type && !['None', 'Empty', 'NormalFrame', 'DotDashFrame', 'LongDashFrame', 'RectFrame',
    'RoundRectFrame', 'EllipseFrame', 'CurveRhombusFrame'].includes(type)) {
    report('Style/PictureRahmenStyle/RahmenStyle', type)
  }
  const effects = getDirectChildElement(style, 'Effects')
  for (const effect of Array.from(effects?.children || [])) {
    if (!['DropShadow', 'PerspectiveShadow', 'Reflection'].includes(effect.tagName)) {
      report(`Style/Effects/${effect.tagName}`, previewValue(effect))
    }
  }
}
