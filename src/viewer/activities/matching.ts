import type { MatchingConfig, MatchingTarget } from '../../enbx/activities/matching-config'

/** 每个目标最多一个素材；保存配置与会话中的摆放状态分别存储。 */
export type MatchingPlacements = Readonly<Record<string, string>>

export interface MatchingCheckResult {
  correctTargetIds: string[]
  wrongTargetIds: string[]
  emptyTargetIds: string[]
  complete: boolean
}

/** 拖放或无障碍点击选择均可调用；占用目标原素材退回素材区。 */
export function placeMatchingMaterial(config: MatchingConfig, placements: MatchingPlacements,
  materialId: string, targetId: string | null): MatchingPlacements {
  if (!config.materials.some(material => material.id === materialId)
    || (targetId !== null && !config.targets.some(target => target.id === targetId))) return placements
  const next: Record<string, string> = {}
  for (const target of config.targets) {
    const current = placements[target.id]
    if (current && current !== materialId && target.id !== targetId) next[target.id] = current
  }
  if (targetId !== null) next[targetId] = materialId
  return next
}

/**
 * 显式判题。plainText 只接收调用方已确认不含公式/内嵌对象的实际元素文本。
 * 未提供文本时按保存的元素 ID 判题，避免把公式占位文本误当成等价答案。
 */
export function checkMatchingAnswers(config: MatchingConfig, placements: MatchingPlacements,
  plainText: Readonly<Record<string, string>> = {}): MatchingCheckResult {
  const result: MatchingCheckResult = { correctTargetIds: [], wrongTargetIds: [], emptyTargetIds: [], complete: false }
  const used = new Set<string>()
  const tieUsage = new Map<number, Map<string, number>>()
  const materials = new Map(config.materials.map(material => [material.id, material]))
  const hasText = (id: string) => Object.prototype.hasOwnProperty.call(plainText, id)
  const answerTargets = (target: MatchingTarget) => config.targets.filter(other => {
    if (other.id === target.id) return true
    if (config.kind === 'GapFilling') return target.tieNumber !== undefined && other.tieNumber === target.tieNumber
    return hasText(target.containerId) && hasText(other.containerId)
      && !!plainText[target.containerId].trim()
      && plainText[target.containerId].trim() === plainText[other.containerId].trim()
  })
  for (const target of config.targets) {
    const materialId = placements[target.id]
    if (!materialId) {
      result.emptyTargetIds.push(target.id)
      continue
    }
    const answers = answerTargets(target).flatMap(other => other.answerIds)
    const name = hasText(materialId) ? plainText[materialId].trim() : ''
    let correct = materials.has(materialId) && !used.has(materialId) && (answers.includes(materialId)
      || (!!name && answers.some(id => hasText(id) && plainText[id].trim() === name)))
    used.add(materialId)
    // 同一并列编号按答案文本的原始出现次数计数，不能重复使用等价干扰项填满所有空。
    if (correct && config.kind === 'GapFilling' && target.tieNumber !== undefined && hasText(materialId)) {
      const usage = tieUsage.get(target.tieNumber) || new Map<string, number>()
      const quota = answers.filter(id => hasText(id) && plainText[id].trim() === name).length
      const count = usage.get(name) || 0
      correct = count < quota
      if (correct) usage.set(name, count + 1)
      tieUsage.set(target.tieNumber, usage)
    }
    if (correct) result.correctTargetIds.push(target.id)
    else result.wrongTargetIds.push(target.id)
  }
  result.complete = config.targets.length > 0 && result.correctTargetIds.length === config.targets.length
  return result
}

/** TextMatch 官方检查会退回错误素材；GapFilling 保留摆放并显示正误提示。 */
export function clearWrongMatchingPlacements(config: MatchingConfig, placements: MatchingPlacements,
  result: MatchingCheckResult): MatchingPlacements {
  if (config.kind !== 'TextMatch') return placements
  const wrong = new Set(result.wrongTargetIds)
  return Object.fromEntries(Object.entries(placements).filter(([targetId]) => !wrong.has(targetId)))
}
