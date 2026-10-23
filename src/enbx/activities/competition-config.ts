import { getDirectChildElement as child, getDirectChildText as text } from '../xml-utils'

export interface CompetitionItem { id: string; text: string; correct: boolean }
export interface CompetitionConfig {
  difficulty: 'Low' | 'Medium' | 'High'
  items: CompetitionItem[]
}

/** 分组竞争的每个条目必须关联实际 ActivityItem，不用描述文字替代缺失元素。 */
export function parseCompetitionConfig(config: Element): { competition?: CompetitionConfig; diagnostics: string[] } {
  try {
    let difficulty: unknown
    let items: CompetitionItem[]
    if (!config.children.length) {
      const json = JSON.parse(config.textContent || '')
      difficulty = json.Difficulty ?? 'Low'
      if (!Array.isArray(json.Items)) throw new Error('分组竞争缺少 Items')
      items = json.Items.map((item: { Id: unknown; Text?: unknown; IsCorrect: unknown }) => {
        if (typeof item?.Id !== 'string' || typeof item.IsCorrect !== 'boolean') throw new Error('分组竞争条目无效')
        return { id: item.Id, text: typeof item.Text === 'string' ? item.Text : '', correct: item.IsCorrect }
      })
    } else {
      const root = child(config, 'GroupCompetitionConfig') || config
      difficulty = text(root, 'Difficulty') ?? 'Low'
      const nodes = child(root, 'Items')
      if (!nodes) throw new Error('分组竞争缺少 Items')
      items = Array.from(nodes.children).filter(node => node.tagName !== 'SaveInfoMetadata').map(item => {
        if (item.tagName !== 'GroupCompetitionItem') throw new Error('分组竞争条目类型无效')
        const answer = text(item, 'IsCorrect')?.trim().toLowerCase()
        if (answer !== 'true' && answer !== 'false') throw new Error('分组竞争条目缺少有效答案')
        return { id: text(item, 'Id') || '', text: text(item, 'Text') || '', correct: answer === 'true' }
      })
    }
    const level = ({ '0': 'Low', '1': 'Medium', '2': 'High', Low: 'Low', Medium: 'Medium', High: 'High' } as const)
      [String(difficulty) as 'Low']
    if (!level) throw new Error('分组竞争难度无效')
    if (!items.length || items.some(item => !item.id.trim()) || new Set(items.map(item => item.id)).size !== items.length) {
      throw new Error('分组竞争素材为空或 ID 缺失、重复')
    }
    return { competition: { difficulty: level, items }, diagnostics: [] }
  } catch (error) {
    return { diagnostics: [error instanceof Error ? error.message : '分组竞争配置无效'] }
  }
}
