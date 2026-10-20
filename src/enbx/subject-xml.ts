import { getDirectChildElement, getDirectChildText, parseColor } from './xml-utils'

export const subjectText = (node: Element, name: string) => getDirectChildText(node, name) || ''
export const subjectItems = (node: Element, name: string) => Array.from(getDirectChildElement(node, name)?.children || [])
export function subjectNumber(node: Element, name: string, fallback = 0) {
  const value = Number.parseFloat(subjectText(node, name))
  return Number.isFinite(value) ? value : fallback
}
export const subjectBoolean = (node: Element, name: string, fallback = false) =>
  subjectText(node, name) ? subjectText(node, name).toLowerCase() === 'true' : fallback
export function subjectColor(node: Element, name: string, fallback: string) {
  const brush = getDirectChildElement(node, name)
  return brush ? parseColor(subjectText(brush, 'ColorBrush') || subjectText(brush, 'Color'), true) || fallback : fallback
}
export function subjectBounds(node: Element) {
  return { id: subjectText(node, 'Id') || 'unknown', x: subjectNumber(node, 'X'), y: subjectNumber(node, 'Y'),
    width: Math.max(1, subjectNumber(node, 'Width', 300)), height: Math.max(1, subjectNumber(node, 'Height', 240)),
    rotation: subjectNumber(node, 'Rotation') }
}
