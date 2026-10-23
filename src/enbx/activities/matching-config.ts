import type { ActivityCategory } from '../../types'
import { getDirectChildElement as child, getDirectChildText as text } from '../xml-utils'

export interface MatchingMaterial {
  id: string
  name: string
  distractor: boolean
}

export interface MatchingTarget {
  /** 填空目标使用合成 ID；containerId 才是幻灯片元素 ID。 */
  id: string
  containerId: string
  name: string
  answerIds: string[]
  tieNumber?: number
  hotspotIndex: number
}

export type MatchingStemPart = { kind: 'text'; text: string } | { kind: 'blank'; targetId: string }

export interface MatchingConfig {
  kind: 'TextMatch' | 'GapFilling'
  targets: MatchingTarget[]
  materials: MatchingMaterial[]
  stemId?: string
  paragraphs: MatchingStemPart[][]
}

export interface MatchingConfigResult {
  categories: ActivityCategory[]
  diagnostics: string[]
  matching: MatchingConfig
  /** 包括干扰项；不要用合成的填空目标 ID 查找元素。 */
  linkedElements: { id: string; role: 'container' | 'material' }[]
}

type SavedNode = Element | Record<string, unknown>

function isXml(node: SavedNode): node is Element {
  return typeof (node as Element).tagName === 'string'
}

function value(node: SavedNode, key: string): unknown {
  return isXml(node) ? text(node, key) : node[key]
}

function string(node: SavedNode, key: string): string {
  const result = value(node, key)
  return typeof result === 'string' ? result : ''
}

function object(node: SavedNode, key: string): SavedNode | undefined {
  const result = isXml(node) ? child(node, key) : node[key]
  return result && typeof result === 'object' && !Array.isArray(result) ? result as SavedNode : undefined
}

function list(node: SavedNode, key: string): SavedNode[] {
  if (isXml(node)) return Array.from(child(node, key)?.children || [])
  const result = node[key]
  if (!Array.isArray(result)) return []
  return result.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object' && !Array.isArray(item))
}

/** 解析官方 TextMatchConfig / GapFillingConfig；不生成或猜测画布热点矩形。 */
export function parseMatchingConfig(key: string, config: Element): MatchingConfigResult {
  const kind = key === 'GapFilling' ? 'GapFilling' : 'TextMatch'
  const matching: MatchingConfig = { kind, targets: [], materials: [], paragraphs: [] }
  const result: MatchingConfigResult = { categories: [], diagnostics: [], matching, linkedElements: [] }
  const diagnostics = result.diagnostics
  if (key !== 'TextMatch' && key !== 'GapFilling') {
    diagnostics.push(`不支持的配对活动类型: ${key}`)
    return result
  }
  let root: SavedNode = child(config, `${key}Config`) || config
  if (!config.children.length) {
    try {
      const parsed: unknown = JSON.parse(config.textContent || '')
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error()
      root = parsed as Record<string, unknown>
    } catch {
      diagnostics.push('配对活动配置 JSON 无效')
      return result
    }
  }
  const addMaterial = (node: SavedNode, idKey: string, nameKey: string, distractor: boolean) => {
    const material = { id: string(node, idKey), name: string(node, nameKey), distractor }
    matching.materials.push(material)
    result.linkedElements.push({ id: material.id, role: 'material' })
    return material
  }
  if (key === 'TextMatch') {
    for (const item of list(root, 'MatchItems')) {
      const invalid = value(item, 'IsInvalid')
      if (invalid !== undefined && invalid !== null && ![true, false, 'true', 'false', 'True', 'False'].includes(invalid as string)) {
        diagnostics.push('TextMatch 的 IsInvalid 值无效')
      }
      const distractor = invalid === true || String(invalid).toLowerCase() === 'true'
      const material = addMaterial(item, 'MatchId', 'MatchText', distractor)
      if (distractor) continue
      const id = string(item, 'Id')
      const name = string(item, 'Text')
      matching.targets.push({ id, containerId: id, name, answerIds: [material.id], hotspotIndex: 0 })
      result.categories.push({ id, name, items: [{ id: material.id, name: material.name }] })
      result.linkedElements.push({ id, role: 'container' })
    }
  } else {
    const stem = object(root, 'Stem')
    if (!stem) {
      diagnostics.push('填空活动缺少 Stem')
      return result
    }
    const stemId = string(stem, 'Id')
    matching.stemId = stemId
    result.linkedElements.push({ id: stemId, role: 'container' })
    for (const paragraph of list(stem, 'Paragraphs')) {
      const parts: MatchingStemPart[] = []
      for (const content of list(paragraph, 'Contents')) {
        const contentKind = isXml(content) ? content.tagName : ('Items' in content ? 'FillingContent' : 'Text' in content ? 'PlainContent' : '')
        if (contentKind === 'PlainContent') {
          parts.push({ kind: 'text', text: string(content, 'Text').replace(/[\r\n]/g, '') })
        } else if (contentKind === 'FillingContent') {
          const index = matching.targets.length
          const id = `${stemId}:gap:${index}`
          const answers = list(content, 'Items').map(item => addMaterial(item, 'Id', 'Name', false))
          const rawTie = value(content, 'TieNumber')
          let tieNumber: number | undefined
          if (rawTie !== undefined && rawTie !== null && rawTie !== '') {
            const number = Number(rawTie)
            if (Number.isSafeInteger(number) && number >= -2147483648 && number <= 2147483647) tieNumber = number
            else diagnostics.push(`填空 ${index + 1} 的 TieNumber 无效`)
          }
          matching.targets.push({ id, containerId: stemId, name: '', answerIds: answers.map(item => item.id),
            hotspotIndex: index, ...(tieNumber === undefined ? {} : { tieNumber }) })
          parts.push({ kind: 'blank', targetId: id })
          if (!answers.length) diagnostics.push(`填空 ${index + 1} 缺少答案素材`)
        } else {
          diagnostics.push(`尚未支持的题干内容: ${contentKind || '未知'}`)
        }
      }
      matching.paragraphs.push(parts)
    }
    for (const item of list(root, 'InvalidItems')) addMaterial(item, 'Id', 'Name', true)
    result.categories.push({ id: stemId, name: '', items: matching.materials.map(({ id, name }) => ({ id, name })) })
  }
  if (!matching.targets.length) diagnostics.push('配对或填空目标为空')
  const ids = result.linkedElements.map(link => link.id)
  if (ids.some(id => !id.trim())) diagnostics.push('配对或填空素材 ID 缺失')
  if (new Set(ids).size !== ids.length) diagnostics.push('配对或填空素材 ID 重复')
  return result
}
