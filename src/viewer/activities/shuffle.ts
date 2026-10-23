import type { ActivityDefinition, SlideElement } from '../../types'

/** 超级分类重置仅打乱素材起点，容器、尺寸及保存定义保持不变。 */
export function shuffledMaterialPositions(definition: ActivityDefinition, elements: SlideElement[], random = Math.random) {
  const ids = new Set(definition.categories.flatMap(category => category.items.map(item => item.id)))
  const materials = elements.filter(element => element.type === 'activity'
    && element.activityId === definition.id && ids.has(element.id))
  const points = materials.map(element => ({ x: element.x, y: element.y }))
  for (let i = points.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[points[i], points[j]] = [points[j], points[i]]
  }
  return new Map(materials.map((element, i) => [element.id, points[i]]))
}
