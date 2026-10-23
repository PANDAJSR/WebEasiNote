import type { ActivityDefinition } from '../../types'
import type { CompetitionConfig, CompetitionItem } from '../../enbx/activities/competition-config'

export const competitionTiming = {
  Low: { drop: 11000, interval: 2750 }, Medium: { drop: 9000, interval: 2250 }, High: { drop: 7000, interval: 1750 }
}
export interface CompetitionDrop extends CompetitionItem { double: boolean; hit: boolean }
export interface CompetitionPlayer {
  drops: CompetitionDrop[]
  score: number
  combo: number
  maximumCombo: number
  right: number
  wrong: number
}
export interface CompetitionSession {
  players: CompetitionPlayer[]
  difficulty: CompetitionConfig['difficulty']
  elapsed: number
  state: 'ready' | 'running' | 'paused' | 'finished'
}
const sessions = new WeakMap<ActivityDefinition, CompetitionSession>()
export function competitionSession(definition: ActivityDefinition) {
  let session = sessions.get(definition)
  if (!session) {
    session = { players: [], difficulty: definition.competition!.difficulty, elapsed: 0, state: 'ready' }
    sessions.set(definition, session)
  }
  return session
}
export function createCompetitionPlayers(config: CompetitionConfig, count: 2 | 4, random = Math.random): CompetitionPlayer[] {
  return Array.from({ length: count }, () => {
    const drops: CompetitionDrop[] = config.items.map(item => ({ ...item, double: false, hit: false }))
    for (let i = drops.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1))
      ;[drops[i], drops[j]] = [drops[j], drops[i]]
    }
    // 官方每五个同类素材标记一次，正确/错误双倍数量分别四舍五入到 20%/10%。
    for (const correct of [true, false]) {
      const group = drops.filter(item => item.correct === correct)
      const amount = Math.round(group.length * (correct ? 0.2 : 0.1))
      for (let n = amount; n > 0; n--) group[Math.min(n * 5, group.length) - 1].double = true
    }
    return { drops, score: 0, combo: 0, maximumCombo: 0, right: 0, wrong: 0 }
  })
}
export function competitionDuration(session: CompetitionSession) {
  const { interval, drop } = competitionTiming[session.difficulty]
  return session.players[0]?.drops.length ? (session.players[0].drops.length - 1) * interval + drop : 0
}
export function hitCompetitionMaterial(session: CompetitionSession, playerIndex: number, index: number) {
  if (session.state !== 'running') return false
  const player = session.players[playerIndex]
  const item = player?.drops[index]
  const timing = competitionTiming[session.difficulty]
  const age = session.elapsed - index * timing.interval
  if (!item || item.hit || age < 0 || age >= timing.drop) return false
  item.hit = true
  if (item.correct) {
    player.right++
    player.combo++
    player.score += (item.double ? 20 : 10) + (player.combo >= 3 ? 2 : 0)
    player.maximumCombo = Math.max(player.maximumCombo, player.combo)
  } else {
    player.wrong++
    player.combo = 0
    player.score = Math.max(0, player.score - (item.double ? 10 : 5))
  }
  return true
}

/** 时间由前台活动组件推进；离页、选择、失焦均暂停，避免后台扣时。 */
export function advanceCompetition(session: CompetitionSession, milliseconds: number) {
  if (session.state !== 'running' || !Number.isFinite(milliseconds) || milliseconds <= 0) return
  session.elapsed = Math.min(competitionDuration(session), session.elapsed + milliseconds)
  if (session.elapsed >= competitionDuration(session)) session.state = 'finished'
}
