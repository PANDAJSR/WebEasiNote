import type { ActivityCategory, ActivityDefinition, SlideElement, SlideIssue } from '../../types'
import { getDirectChildElement as child, getDirectChildText as text } from '../xml-utils'

function categoriesFromJson(value: unknown): ActivityCategory[] {
  if (!value || typeof value !== 'object' || !('Classifies' in value) || !Array.isArray(value.Classifies)) {
    throw new Error('缺少 Classifies')
  }
  return value.Classifies.map(category => {
    if (typeof category?.Id !== 'string' || !Array.isArray(category.Items)) throw new Error('分类格式无效')
    return { id: category.Id, name: String(category.Name || ''), items: category.Items.map((item: { Id?: unknown; Name?: unknown }) => {
      if (typeof item?.Id !== 'string') throw new Error('素材格式无效')
      return { id: item.Id, name: String(item.Name || '') }
    }) }
  })
}

export function parseActivities(slide: Element, elements: SlideElement[], slideId: string, issues: SlideIssue[]): ActivityDefinition[] {
  const extensions = child(slide, 'Extensions')
  const nodes = [...Array.from(extensions?.children || []), ...Array.from(slide.children)]
    .filter(node => node.tagName === 'Activity')
  const definitions = nodes.map(node => {
    const diagnostics: string[] = []
    const config = child(node, 'Config')
    const typed = config && (child(config, 'ClassifyConfig') || config)
    let categories: ActivityCategory[] = []
    let mode = 'Classical'
    try {
      if (!config) throw new Error('缺少 Config')
      if (!config.children.length) {
        const json = JSON.parse(config.textContent || '')
        categories = categoriesFromJson(json)
        mode = String(json.ClassifyActivityMode ?? 'Classical')
      } else {
        const classifies = typed && child(typed, 'Classifies')
        if (!classifies) throw new Error('未知的 Config 结构')
        categories = Array.from(classifies.children).map(category => ({ id: text(category, 'Id') || '',
          name: text(category, 'Name') || '', items: Array.from(child(category, 'Items')?.children || [])
            .map(item => ({ id: text(item, 'Id') || '', name: text(item, 'Name') || '' })) }))
        mode = (typed && text(typed, 'ClassifyActivityMode')) || 'Classical'
      }
    } catch {
      diagnostics.push('活动配置缺失或格式尚未支持')
    }
    const id = text(node, 'Id') || ''
    const key = text(node, 'Key') || ''
    if (key !== 'Classify') diagnostics.push(`玩法 ${key || '未知'} 暂仅静态展示`)
    if (mode !== 'Classical' && mode !== '0') diagnostics.push('暂不支持分类对抗模式')
    if (!id || nodes.some(other => other !== node && text(other, 'Id') === id)) diagnostics.push('活动 ID 缺失或重复')
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
    return { id, key, mode, categories, diagnostics, playable: !diagnostics.length,
      isPlayAudio: text(node, 'IsPlayAudio')?.toLowerCase() === 'true', rawXml: new XMLSerializer().serializeToString(node) }
  })
  for (const definition of definitions) {
    for (const diagnostic of definition.diagnostics) issues.push({ kind: 'unknown-parameter', slideId,
      elementType: 'Activity', elementId: definition.id, name: '活动兼容性', value: diagnostic })
  }
  for (const element of elements) {
    if (element.type === 'activity' && !definitions.some(definition => definition.id === element.activityId)) {
      issues.push({ kind: 'unknown-parameter', slideId, elementType: 'ActivityItem', elementId: element.id,
        name: 'ActivityId', value: '没有匹配的活动定义，仅静态展示' })
    }
  }
  return definitions
}
