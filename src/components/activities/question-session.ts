import type { ActivityDefinition } from '../../types'
import type { ActivityQuestion } from '../../enbx/activities/question-config'

export interface QuestionSession {
  index: number
  selected: string[]
  results: boolean[]
}

const sessions = new WeakMap<ActivityDefinition, QuestionSession>()

export function getQuestionSession(definition: ActivityDefinition): QuestionSession {
  let session = sessions.get(definition)
  if (!session) {
    session = { index: 0, selected: [], results: [] }
    sessions.set(definition, session)
  }
  return session
}

export function resetQuestionSession(definition: ActivityDefinition): QuestionSession {
  const session = { index: 0, selected: [], results: [] }
  sessions.set(definition, session)
  return session
}

/** 多选必须与正确答案集合完全相同；未知 ID 和重复 ID 均无效。 */
export function gradeQuestion(question: ActivityQuestion, selected: readonly string[]): boolean {
  const ids = new Set(selected)
  return ids.size === selected.length && ids.size > 0
    && selected.every(id => question.options.some(option => option.id === id))
    && question.options.every(option => ids.has(option.id) === option.correct)
}
