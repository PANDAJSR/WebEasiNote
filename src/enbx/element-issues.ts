import type { SlideIssue } from '../types'
import { KNOWN_PARAMETERS } from './slide-elements-known-parameters'

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
}
