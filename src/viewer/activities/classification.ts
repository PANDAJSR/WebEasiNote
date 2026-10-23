import type { ActivityDefinition, ActivityElement, SlideElement } from '../../types'

/** 官方默认热点为 TransformedBounds；分类使用素材外接矩形中心。 */
export function classificationContainer(definition: ActivityDefinition, elements: SlideElement[], material: ActivityElement,
  x: number, y: number) {
  const center = { x: x + material.width / 2, y: y + material.height / 2 }
  return [...elements].reverse().find(element => {
    if (element.type !== 'activity' || element.role !== 'container' || element.activityId !== definition.id
      || !definition.categories.some(category => category.id === element.id)) return false
    const angle = element.rotation * Math.PI / 180
    const width = Math.abs(element.width * Math.cos(angle)) + Math.abs(element.height * Math.sin(angle))
    const height = Math.abs(element.width * Math.sin(angle)) + Math.abs(element.height * Math.cos(angle))
    return Math.abs(center.x - element.x - element.width / 2) <= width / 2
      && Math.abs(center.y - element.y - element.height / 2) <= height / 2
  })
}

export function classificationDrop(definition: ActivityDefinition, elements: SlideElement[], material: ActivityElement,
  x: number, y: number): 'correct' | 'wrong' | 'outside' {
  const container = classificationContainer(definition, elements, material, x, y)
  if (!container) return 'outside'
  const category = definition.categories.find(category => category.id === container.id)
  if (category?.items.some(item => item.id === material.id)) return 'correct'
  // 官方比较已关联素材的纯文字内容；图片或其他内嵌内容不能按同文接受。
  const plainText = (element: SlideElement | undefined) => element?.type === 'activity' && !element.contents.length
    ? element.text?.textLines.map(line => line.textRuns.map(run => run.text).join('')).join('\n').trim() : undefined
  const sourceText = plainText(material)
  return sourceText && category?.items.some(item => sourceText === plainText(elements.find(element => element.id === item.id)))
    ? 'correct' : 'wrong'
}
