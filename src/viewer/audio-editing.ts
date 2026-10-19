import type { AudioElement } from '../types'
import { getDirectChildElement } from '../enbx/xml-utils'

export interface AudioEdit {
  volume?: number
  playPoints?: number[]
}

/** 仅改写媒体编辑字段，保留原始动画和扩展节点。 */
export function applyAudioEdit(element: AudioElement, edit: AudioEdit): AudioElement {
  const next = { ...element, ...edit }
  if (!element.rawXml) return next
  const document = new DOMParser().parseFromString(element.rawXml, 'text/xml')
  const root = document.documentElement
  const ensure = (name: string) => {
    const node = getDirectChildElement(root, name) || document.createElement(name)
    if (!node.parentNode) root.appendChild(node)
    return node
  }
  if (edit.volume !== undefined) ensure('Volume').textContent = String(edit.volume)
  if (edit.playPoints) {
    const points = ensure('PlayPoints')
    points.replaceChildren(...edit.playPoints.map(time => {
      const item = document.createElement('Item')
      item.textContent = String(Math.round(time * 10_000_000))
      return item
    }))
  }
  return { ...next, rawXml: new XMLSerializer().serializeToString(root) }
}
