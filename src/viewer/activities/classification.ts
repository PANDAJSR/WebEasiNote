import type { ActivityDefinition, ActivityElement, SlideElement } from '../../types'

/** 官方默认热点为 TransformedBounds；分类使用素材外接矩形中心。 */
export function classificationDrop(definition: ActivityDefinition, elements: SlideElement[], material: ActivityElement,
  x: number, y: number): 'correct' | 'wrong' | 'outside' {
  const center = { x: x + material.width / 2, y: y + material.height / 2 }
  const container = [...elements].reverse().find(element => {
    if (element.type !== 'activity' || element.role !== 'container' || element.activityId !== definition.id
      || !definition.categories.some(category => category.id === element.id)) return false
    const angle = element.rotation * Math.PI / 180
    const width = Math.abs(element.width * Math.cos(angle)) + Math.abs(element.height * Math.sin(angle))
    const height = Math.abs(element.width * Math.sin(angle)) + Math.abs(element.height * Math.cos(angle))
    return Math.abs(center.x - element.x - element.width / 2) <= width / 2
      && Math.abs(center.y - element.y - element.height / 2) <= height / 2
  })
  if (!container) return 'outside'
  return definition.categories.find(category => category.id === container.id)?.items.some(item => item.id === material.id)
    ? 'correct' : 'wrong'
}
