import type { SlideElement } from '../types'
import { getDirectChildText } from './xml-utils'

/** Group 被展开后，组上的锁定/克隆标记仍约束所有后代。 */
export function applySelectionFlags(node: Element, elements: SlideElement[], start: number) {
  const isLocked = getDirectChildText(node, 'IsLocked')?.trim().toLowerCase() === 'true'
  const canClone = getDirectChildText(node, 'CanClone')?.trim().toLowerCase() === 'true'
  for (let index = start; index < elements.length; index += 1) {
    const element = elements[index]
    elements[index] = { ...element, isLocked: isLocked || element.isLocked,
      canClone: canClone || element.canClone }
  }
}
