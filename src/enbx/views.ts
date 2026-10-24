import type { ViewElement } from '../types/view'
import { subjectBounds, subjectText, subjectBoolean } from './subject-xml'

export function parseViewElement(node: Element): ViewElement {
  const origin = subjectText(node, 'RotateOrigin').split(',').map(Number)
  return {
    ...subjectBounds(node), type: 'view', elements: [],
    localId: subjectText(node, 'LocalId'),
    layoutType: subjectText(node, 'LayoutType') || 'Default',
    permittedTransforms: subjectText(node, 'PermittedTransforms'),
    isHidden: subjectBoolean(node, 'IsHidden'),
    rotateOrigin: origin.length === 2 && origin.every(Number.isFinite) ? [origin[0], origin[1]] : [.5, .5]
  }
}
