import type { ActivityDefinition } from '../../types'

export interface JudgePlayer {
  order: number[]
  selected: boolean | null
  score: number
  right: number
  wrong: number
  timeouts: number
  result: 'correct' | 'wrong' | 'timeout' | null
}
export interface JudgeSession {
  state: 'ready' | 'running' | 'paused' | 'finished'
  phase: 'countdown' | 'answer' | 'feedback'
  index: number
  remaining: number
  players: JudgePlayer[]
}
const sessions = new WeakMap<ActivityDefinition, JudgeSession>()
export function judgeSession(definition: ActivityDefinition): JudgeSession {
  let session = sessions.get(definition)
  if (!session) {
    session = { state: 'ready', phase: 'countdown', index: 0, remaining: 3000, players: [] }
    sessions.set(definition, session)
  }
  return session
}
export function resetJudge(definition: ActivityDefinition) {
  const session = judgeSession(definition)
  Object.assign(session, { state: 'ready', phase: 'countdown', index: 0, remaining: 3000, players: [] })
}
export function startJudge(definition: ActivityDefinition, random = Math.random) {
  resetJudge(definition)
  const session = judgeSession(definition)
  const order = definition.questions!.map((_, index) => index)
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  const partitions = [order.filter((_, i) => i % 2 === 0), order.filter((_, i) => i % 2 === 1)]
  session.players = [0, 1].map(index => ({ order: [...partitions[index], ...partitions[1 - index]],
    selected: null, score: 0, right: 0, wrong: 0, timeouts: 0, result: null }))
  session.state = 'running'
}
export function selectJudge(definition: ActivityDefinition, playerIndex: number, answer: boolean) {
  const session = judgeSession(definition)
  const player = session.players[playerIndex]
  if (session.state !== 'running' || session.phase !== 'answer' || !player) return false
  player.selected = answer
  return true
}
/** 仅在统一倒计时结束后结算，选择 false 与未作答 null 必须区分。 */
export function advanceJudge(definition: ActivityDefinition, milliseconds: number) {
  const session = judgeSession(definition)
  if (session.state !== 'running' || !Number.isFinite(milliseconds) || milliseconds <= 0) return
  const questions = definition.questions!
  while (milliseconds > 0 && session.state === 'running') {
    const consumed = Math.min(milliseconds, session.remaining)
    session.remaining -= consumed
    milliseconds -= consumed
    if (session.remaining > 0) break
    if (session.phase === 'answer') {
      const points = session.index === questions.length - 1 && questions.length > 1 ? 2 : 1
      for (const player of session.players) {
        const answer = questions[player.order[session.index]].options.find(option => option.id === 'true')!.correct
        player.result = player.selected === null ? 'timeout' : player.selected === answer ? 'correct' : 'wrong'
        if (player.result === 'correct') { player.score += points; player.right++ }
        else { player.wrong++; if (player.result === 'timeout') player.timeouts++ }
      }
      session.phase = 'feedback'
      session.remaining = 2000
    } else {
      if (session.phase === 'feedback') session.index++
      if (session.index >= questions.length) { session.state = 'finished'; break }
      session.phase = 'answer'
      session.remaining = definition.judge?.interval || 7000
      for (const player of session.players) { player.selected = null; player.result = null }
    }
  }
}
