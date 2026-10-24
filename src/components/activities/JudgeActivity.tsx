import { useEffect, useReducer } from 'react'
import type { ActivityDefinition } from '../../types'
import type { ActivityQuestion } from '../../enbx/activities/question-config'
import { advanceJudge, judgeSession, resetJudge, selectJudge, startJudge } from '../../viewer/activities/judge'
import { ElementRenderer } from '../slide-renderer/ElementRenderer'
import { judgeStyles as styles } from './judge-styles'

function JudgeContent({ question, resourceMap }: { question: ActivityQuestion; resourceMap: Record<string, string> }) {
  const elements = question.contents
  if (!elements?.length) return <>{question.text}</>
  const left = Math.min(...elements.map(element => element.x))
  const top = Math.min(...elements.map(element => element.y))
  const width = Math.max(...elements.map(element => element.x + element.width)) - left
  const height = Math.max(...elements.map(element => element.y + element.height)) - top
  const scale = Math.min(460 / Math.max(1, width), 380 / Math.max(1, height))
  return <div data-judge-content='true' style={{ position: 'relative', width: width * scale, height: height * scale, pointerEvents: 'none' }}>
    {elements.map((element, index) => <ElementRenderer key={index} element={{ ...element, x: element.x - left, y: element.y - top }}
      scale={scale} resourceMap={resourceMap} slideIndex={0} currentIndex={0} />)}
  </div>
}

export function JudgeActivity({ definition, active, width, height, resourceMap }: {
  definition: ActivityDefinition; active: boolean; width: number; height: number; resourceMap: Record<string, string>
}) {
  const [, refresh] = useReducer(value => value + 1, 0)
  const session = judgeSession(definition)
  const questions = definition.questions!
  const scale = width / 1920
  const stageHeight = height / scale
  useEffect(() => {
    const pause = () => { if (session.state === 'running') { session.state = 'paused'; refresh() } }
    if (!active) pause()
    window.addEventListener('blur', pause)
    document.addEventListener('visibilitychange', pause)
    return () => { pause(); window.removeEventListener('blur', pause); document.removeEventListener('visibilitychange', pause) }
  }, [definition, active])
  useEffect(() => {
    if (!active || session.state !== 'running') return
    let last = performance.now()
    const timer = window.setInterval(() => {
      const now = performance.now()
      advanceJudge(definition, now - last)
      last = now
      refresh()
    }, 50)
    return () => window.clearInterval(timer)
  }, [definition, active, session.state])
  if (!active) return null
  const magic = questions.length > 1 && session.index === questions.length - 1
  const handleReset = () => { resetJudge(definition); refresh() }
  return <section aria-label='判断对错' data-activity-canvas='Judge' data-activity-control='true' data-prevent-swipe='true'
    style={styles.panel} onClick={event => event.stopPropagation()} onPointerDown={event => event.stopPropagation()}>
    <div style={{ ...styles.stage, width: 1920, height: stageHeight, transform: `scale(${scale})` }}>
      {[0, 1].map(index => {
        const player = session.players[index]
        const question = questions[player?.order[Math.min(session.index, questions.length - 1)] ?? 0]
        return <div key={index} data-judge-player={index} style={{ ...styles.answerPanel, gridColumn: index ? 3 : 1, gridRow: 1 }}>
          <strong style={{ fontSize: 32 }}>第 {index + 1} 组 · {player?.score || 0} 分</strong>
          <div role='timer' style={{ ...styles.timer, background: session.remaining <= 3000 ? '#ec7056' : '#df943f' }}>
            {session.phase === 'answer' ? Math.ceil(session.remaining / 1000) : '•'}</div>
          <div style={styles.question}><JudgeContent question={question} resourceMap={resourceMap} /></div>
          <div style={{ ...styles.feedback, color: player?.result === 'correct' ? '#308a48' : '#c84f3f' }} role='status'>
            {session.phase === 'feedback' && (player?.result === 'correct' ? `回答正确 +${magic ? 2 : 1}`
              : player?.result === 'timeout' ? '未作答，时间到' : '回答错误')}
          </div>
          <div role='group' aria-label={`第 ${index + 1} 组答案`} style={styles.answers}>
            {[true, false].map(answer => <button key={String(answer)} type='button' aria-label={answer ? '正确' : '错误'}
              aria-pressed={player?.selected === answer} disabled={session.state !== 'running' || session.phase !== 'answer'}
              style={{ ...styles.answer, background: answer ? '#59b875' : '#e76e5c',
                outline: player?.selected === answer ? '10px solid #ffb922' : undefined,
                transform: player?.selected === answer ? 'scale(1.04)' : undefined }}
              onClick={() => { selectJudge(definition, index, answer); refresh() }}>{answer ? '✓' : '×'}</button>)}
          </div>
        </div>
      })}
      <div style={{ ...styles.runway, gridColumn: 2, gridRow: 1 }}>
        <h2 style={styles.title}>{definition.judge?.title || '判断对错'}</h2>
        <div style={{ fontSize: 32, textAlign: 'center' }}>第 {Math.min(session.index + 1, questions.length)} / {questions.length} 题</div>
        <div style={{ fontSize: 32, textAlign: 'center', minHeight: 50 }}>{magic && '★ 最后一题 · 双倍得分 ★'}</div>
        {session.players.map((player, index) => <div key={index} style={styles.track} aria-label={`第 ${index + 1} 组赛道`}>
          <div style={{ ...styles.runner, left: `${player.score / (questions.length + (questions.length > 1 ? 1 : 0)) * 80}%`,
            background: index ? '#ef8864' : '#549fc9' }}>第{index + 1}组</div>
          <span style={{ position: 'absolute', right: 12, top: 25, fontSize: 50 }}>⚑</span>
        </div>)}
        <button type='button' style={{ ...styles.action, marginTop: 'auto', alignSelf: 'center' }}
          disabled={session.state !== 'running'} onClick={() => { session.state = 'paused'; refresh() }}>暂停</button>
      </div>
      {session.state === 'ready' && <div style={styles.overlay}><div style={styles.card}>
        <h2>{definition.judge?.title || '判断对错'}</h2><p>两组竞赛 · 每题 {(definition.judge?.interval || 7000) / 1000} 秒</p>
        <p>时间到统一判分，最后一题双倍得分</p>
        <button type='button' style={styles.action} onClick={() => { startJudge(definition); refresh() }}>▶ 开始</button>
      </div></div>}
      {session.state === 'running' && session.phase === 'countdown' && <div style={{ ...styles.overlay, fontSize: 220,
        fontWeight: 900, color: '#ffe49a' }} role='status'>{Math.ceil(session.remaining / 1000)}</div>}
      {session.state === 'paused' && <div style={styles.overlay}><div style={styles.card}><h2>活动已暂停</h2>
        <button type='button' style={styles.action} onClick={() => { session.state = 'running'; refresh() }}>继续</button>{' '}
        <button type='button' style={styles.action} onClick={handleReset}>重新开始</button>
      </div></div>}
      {session.state === 'finished' && <div style={styles.overlay}><div style={styles.card}><h2>
        {session.players[0].score === session.players[1].score ? '平局' : `第 ${session.players[0].score > session.players[1].score ? 1 : 2} 组获胜`}</h2>
        {session.players.map((player, index) => <p key={index}>第 {index + 1} 组：{player.score} 分 · 答对 {player.right} · 答错 {player.wrong}（未答 {player.timeouts}）</p>)}
        <button type='button' style={styles.action} onClick={handleReset}>重新开始</button>
      </div></div>}
    </div>
  </section>
}
