import type { SlideElement } from '../types'
import { rotatePoint, selectionMembers, type SelectionPoint } from './selection-geometry'
import { inkToSlide } from './annotation/ink-geometry'

const epsilon = 1e-7
const cross = (a: SelectionPoint, b: SelectionPoint, p: SelectionPoint) =>
  (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)

function onSegment(a: SelectionPoint, b: SelectionPoint, p: SelectionPoint) {
  return Math.abs(cross(a, b, p)) <= epsilon
    && p.x >= Math.min(a.x, b.x) - epsilon && p.x <= Math.max(a.x, b.x) + epsilon
    && p.y >= Math.min(a.y, b.y) - epsilon && p.y <= Math.max(a.y, b.y) + epsilon
}

/** Boundary points count as enclosed; the open gesture is implicitly closed. */
export function lassoContains(points: SelectionPoint[], point: SelectionPoint) {
  if (points.length < 3) return false
  let inside = false
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[j], b = points[i]
    if (onSegment(a, b, point)) return true
    if ((a.y > point.y) !== (b.y > point.y)
      && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}

export const LASSO_SELECTION_COVERAGE = 0.5

/** 在元素局部坐标按 64 条扫描线估算覆盖面积；凹形/自交套索使用奇偶填充。 */
export function lassoCoverage(points: SelectionPoint[], element: SlideElement) {
  if (points.length < 3) return 0
  if (element.type === 'ink') {
    if (element.points.length === 1) return lassoContains(points, inkToSlide(element, element.points[0])) ? 1 : 0
    let length = 0, covered = 0
    for (let i = 1; i < element.points.length; i++) {
      const a = inkToSlide(element, element.points[i - 1]), b = inkToSlide(element, element.points[i])
      const distance = Math.hypot(b.x - a.x, b.y - a.y)
      const steps = Math.max(1, Math.min(512, Math.ceil(distance / 2)))
      length += distance
      for (let j = 0; j < steps; j++) {
        const t = (j + 0.5) / steps
        if (lassoContains(points, { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })) covered += distance / steps
      }
    }
    return length ? covered / length : lassoContains(points, inkToSlide(element, element.points[0])) ? 1 : 0
  }
  const width = Math.max(1, Math.abs(element.width))
  const height = Math.max(1, Math.abs(element.height))
  const local = points.map(point => rotatePoint({
    x: point.x - element.x - element.width / 2,
    y: point.y - element.y - element.height / 2
  }, -(('rotation' in element && element.rotation) || 0)))
  if (Math.max(...local.map(point => point.x)) <= -width / 2
    || Math.min(...local.map(point => point.x)) >= width / 2
    || Math.max(...local.map(point => point.y)) <= -height / 2
    || Math.min(...local.map(point => point.y)) >= height / 2) return 0
  let covered = 0
  const rows = 64
  for (let row = 0; row < rows; row++) {
    const y = height * ((row + 0.5) / rows - 0.5)
    const crossings: number[] = []
    for (let i = 0, j = local.length - 1; i < local.length; j = i++) {
      const a = local[j], b = local[i]
      if ((a.y > y) !== (b.y > y)) crossings.push(a.x + (b.x - a.x) * (y - a.y) / (b.y - a.y))
    }
    crossings.sort((a, b) => a - b)
    for (let i = 0; i + 1 < crossings.length; i += 2) {
      covered += Math.max(0, Math.min(width / 2, crossings[i + 1]) - Math.max(-width / 2, crossings[i]))
    }
  }
  return Math.min(1, covered / (rows * width))
}

/** 覆盖至少一半即可选中；组合按成员面积加权，始终整体选择且全部成员必须可选。 */
export function lassoSelection(elements: SlideElement[], points: SelectionPoint[],
  eligible: (element: SlideElement) => boolean = element => !element.isLocked && element.type !== 'unknown'
    && !(element.type === 'ink' && element.brush.kind === 'laser')) {
  if (points.length < 3) return []
  const visited = new Set<string>()
  const result: SlideElement[] = []
  for (const element of elements) {
    if (visited.has(element.id)) continue
    const members = selectionMembers(elements, element)
    members.forEach(member => visited.add(member.id))
    if (!members.every(eligible)) continue
    let area = 0
    let coveredArea = 0
    for (const member of members) {
      const memberArea = Math.max(1, Math.abs(member.width)) * Math.max(1, Math.abs(member.height))
      area += memberArea
      coveredArea += memberArea * lassoCoverage(points, member)
    }
    if (coveredArea / area + epsilon >= LASSO_SELECTION_COVERAGE) result.push(...members)
  }
  const ids = new Set(result.map(element => element.id))
  return elements.filter(element => ids.has(element.id))
}
