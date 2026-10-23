import type { SlideElement } from '../types'
import { rotatePoint, selectionMembers, type SelectionPoint } from './selection-geometry'

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

function enclosesElement(points: SelectionPoint[], element: SlideElement) {
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => {
    const offset = rotatePoint({ x: x * element.width / 2, y: y * element.height / 2 },
      ('rotation' in element && element.rotation) || 0)
    return { x: element.x + element.width / 2 + offset.x, y: element.y + element.height / 2 + offset.y }
  })
  if (!corners.every(corner => lassoContains(points, corner))) return false
  // A concave lasso can contain all corners while cutting through a box edge.
  return corners.every((a, index) => {
    const b = corners[(index + 1) % corners.length]
    return points.every((c, i) => {
      const d = points[(i + 1) % points.length]
      return !(cross(a, b, c) * cross(a, b, d) < -epsilon
        && cross(c, d, a) * cross(c, d, b) < -epsilon)
    })
  })
}

/** Enclose every member's rotated bounds. Locked/hidden groups remain atomic. */
export function lassoSelection(elements: SlideElement[], points: SelectionPoint[],
  eligible: (element: SlideElement) => boolean = element => !element.isLocked && element.type !== 'unknown') {
  if (points.length < 3) return []
  const visited = new Set<string>()
  const result: SlideElement[] = []
  for (const element of elements) {
    if (visited.has(element.id)) continue
    const members = selectionMembers(elements, element)
    members.forEach(member => visited.add(member.id))
    if (members.every(member => eligible(member) && enclosesElement(points, member))) result.push(...members)
  }
  const ids = new Set(result.map(element => element.id))
  return elements.filter(element => ids.has(element.id))
}
