import type { ActivityCategory, ActivityDefinition, SlideElement, SlideIssue } from '../../types'
import { getDirectChildElement as child, getDirectChildText as text } from '../xml-utils'
import { parseClassificationConfig, validateActivityMembers } from './classification-config'
import { parseMatchingConfig } from './matching-config'
import { parseQuestionConfig } from './question-config'
import { parseCompetitionConfig } from './competition-config'

export function parseActivities(slide: Element, elements: SlideElement[], slideId: string, issues: SlideIssue[]): ActivityDefinition[] {
  const extensions = child(slide, 'Extensions')
  const nodes = [...Array.from(extensions?.children || []), ...Array.from(slide.children)]
    .filter(node => node.tagName === 'Activity')
  const definitions = nodes.map(node => {
    const diagnostics: string[] = []
    const id = text(node, 'Id') || ''
    const key = text(node, 'Key') || ''
    const config = child(node, 'Config')
    const hotspotOffsets: Record<string, number> = {}
    const resources = child(child(node, 'ActivitySetting') || node, 'Resources')
    for (const resource of Array.from(resources?.children || [])) {
      const type = text(resource, 'Type')
      const offset = text(child(resource, 'HotspotInfo') || resource, 'RelativeOffset')
      if (type && offset?.trim() && Number.isFinite(Number(offset))) hotspotOffsets[type] = Number(offset)
    }
    let categories: ActivityCategory[] = []
    let matching: ActivityDefinition['matching']
    let questions: ActivityDefinition['questions']
    let judge: ActivityDefinition['judge']
    let competition: ActivityDefinition['competition']
    let mode = 'Classical'
    try {
      if (!config) throw new Error('缺少 Config')
      if (key === 'Classify' || key === 'SuperClassify') {
        ;({ categories, mode } = parseClassificationConfig(config))
        if (mode !== 'Classical' && mode !== '0') diagnostics.push('暂不支持分类对抗模式')
        diagnostics.push(...validateActivityMembers(id, categories, elements))
      } else if (key === 'TextMatch' || key === 'GapFilling') {
        const parsed = parseMatchingConfig(key, config)
        categories = parsed.categories
        matching = parsed.matching
        diagnostics.push(...parsed.diagnostics)
        for (const link of parsed.linkedElements) {
          const matches = elements.filter(element => element.id === link.id)
          if (matches.length !== 1 || matches[0].type !== 'activity' || matches[0].role !== link.role
            || matches[0].activityId !== id) diagnostics.push(`无法关联 ${link.role}: ${link.id}`)
          else if (matches[0].groupId) diagnostics.push(`组合内活动成员暂不支持答题: ${link.id}`)
        }
      } else if (key === 'GroupCompetition') {
        const parsed = parseCompetitionConfig(config)
        competition = parsed.competition
        diagnostics.push(...parsed.diagnostics)
        for (const item of competition?.items || []) {
          const matches = elements.filter(element => element.id === item.id)
          if (matches.length !== 1 || matches[0].type !== 'activity' || matches[0].activityId !== id || matches[0].groupId) {
            diagnostics.push(`无法关联竞争素材: ${item.id}`)
          }
        }
      } else if (key === 'Choice' || key === 'Judge') {
        const parsed = parseQuestionConfig(key, config)
        questions = parsed.questions
        judge = parsed.judge
        diagnostics.push(...parsed.diagnostics)
      } else diagnostics.push(`玩法 ${key || '未知'} 暂仅静态展示`)
    } catch {
      diagnostics.push('活动配置缺失或格式尚未支持')
    }
    if (!id || nodes.some(other => other !== node && text(other, 'Id') === id)) diagnostics.push('活动 ID 缺失或重复')
    return { id, key, mode, categories, matching, questions, judge, competition, hotspotOffsets, diagnostics, playable: !diagnostics.length,
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
