import type { ActivityCategory } from '../../types'
import { getDirectChildElement as child, getDirectChildText as text } from '../xml-utils'

export function parseClassificationConfig(config: Element) {
  let categories: ActivityCategory[]
  let mode = 'Classical'
  if (!config.children.length) {
    const json = JSON.parse(config.textContent || '')
    if (!Array.isArray(json?.Classifies)) throw new Error('缺少 Classifies')
    categories = json.Classifies.map((category: { Id: unknown; Name?: unknown; Items: unknown }) => {
      if (typeof category?.Id !== 'string' || !Array.isArray(category.Items)) throw new Error('分类格式无效')
      return { id: category.Id, name: String(category.Name || ''),
        items: category.Items.map((item: { Id?: unknown; Name?: unknown }) => {
          if (typeof item?.Id !== 'string') throw new Error('素材格式无效')
          return { id: item.Id, name: String(item.Name || '') }
        }) }
    })
    mode = String(json.ClassifyActivityMode ?? mode)
  } else {
    const typed = child(config, 'ClassifyConfig') || config
    const classifies = child(typed, 'Classifies')
    if (!classifies) throw new Error('缺少 Classifies')
    categories = Array.from(classifies.children).filter(node => node.tagName !== 'SaveInfoMetadata')
      .map(category => ({ id: text(category, 'Id') || '', name: text(category, 'Name') || '',
        items: Array.from(child(category, 'Items')?.children || []).filter(node => node.tagName !== 'SaveInfoMetadata')
          .map(item => ({ id: text(item, 'Id') || '', name: text(item, 'Name') || '' })) }))
    mode = text(typed, 'ClassifyActivityMode') || mode
  }
  return { categories, mode }
}

export function validateActivityMembers(id: string, categories: ActivityCategory[],
  elements: import('../../types').SlideElement[]) {
  const diagnostics: string[] = []
  const ids = categories.flatMap(category => [category.id, ...category.items.map(item => item.id)])
  if (!categories.length || !categories.some(category => category.items.length)) diagnostics.push('分类或素材为空')
  if (ids.some(value => !value) || new Set(ids).size !== ids.length) diagnostics.push('分类或素材 ID 缺失或重复')
  for (const category of categories) {
    for (const [elementId, role] of [[category.id, 'container'], ...category.items.map(item => [item.id, 'material'])]) {
      const matches = elements.filter(element => element.id === elementId)
      if (matches.length !== 1 || matches[0].type !== 'activity' || matches[0].role !== role
        || matches[0].activityId !== id) diagnostics.push(`无法关联 ${role}: ${elementId}`)
      else if (matches[0].groupId) diagnostics.push(`组合内活动成员暂不支持答题: ${elementId}`)
    }
  }
  return diagnostics
}
