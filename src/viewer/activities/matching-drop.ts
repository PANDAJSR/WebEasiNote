interface Rect { left: number; top: number; right: number; bottom: number; width: number; height: number }

/** 用移动后的素材矩形吸附，抓取点不必落进空位；重叠最多的目标优先。 */
export function matchingDropTarget(targets: { id: string; rect: Rect }[], material: Rect,
  pointer: { x: number; y: number }) {
  const center = { x: (material.left + material.right) / 2, y: (material.top + material.bottom) / 2 }
  return targets.map(target => {
    const rect = target.rect
    const overlap = Math.max(0, Math.min(rect.right, material.right) - Math.max(rect.left, material.left))
      * Math.max(0, Math.min(rect.bottom, material.bottom) - Math.max(rect.top, material.top))
    const contains = (point: { x: number; y: number }) => point.x >= rect.left && point.x <= rect.right
      && point.y >= rect.top && point.y <= rect.bottom
    const ratio = overlap / Math.max(1, Math.min(material.width * material.height, rect.width * rect.height))
    return { id: target.id, eligible: contains(center) || contains(pointer) || ratio >= 0.25,
      score: ratio + (contains(center) ? 1 : 0) }
  }).filter(target => target.eligible).sort((a, b) => b.score - a.score)[0]?.id || null
}
