import { useEffect, useReducer, useState } from 'react'
import type { ActivityDefinition, ActivityElement, SlideElement } from '../../types'
import { ActivityElementRenderer } from './ActivityElementRenderer'
import { advanceCompetition, competitionDuration, competitionSession, competitionTiming,
  createCompetitionPlayers, hitCompetitionMaterial } from '../../viewer/activities/competition'
import { CompetitionAction, CompetitionEntrance, CompetitionHeader, CompetitionParchment } from './CompetitionChrome'
import { competitionStyles as styles } from './competition-styles'

const difficulties = ['Low', 'Medium', 'High'] as const
const clock = (milliseconds: number) => {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000))
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

export function CompetitionActivity({ definition, elements, resourceMap, active, width, height }: {
  definition: ActivityDefinition; elements: SlideElement[]; resourceMap: Record<string, string>; active: boolean
  width: number; height: number
}) {
  const [count, setCount] = useState<2 | 4>(() => competitionSession(definition).players.length === 4 ? 4 : 2)
  const [feedback, setFeedback] = useState<{ player: number; text: string; correct: boolean; at: number } | null>(null)
  const [, refresh] = useReducer(value => value + 1, 0)
  const session = competitionSession(definition)
  const config = definition.competition!
  const title = config.title || '分组竞争'
  const pairs = session.players.length === 4 || (!session.players.length && count === 4) ? 2 : 1
  // 官方单套头部最小宽度 1920，四人时两套双人场地并排。
  const factor = width / (1920 * pairs)
  const stageHeight = height / factor
  useEffect(() => {
    const pause = () => {
      if (session.state === 'running') { session.state = 'paused'; refresh() }
    }
    if (!active) pause()
    window.addEventListener('blur', pause)
    document.addEventListener('visibilitychange', pause)
    return () => { pause(); window.removeEventListener('blur', pause); document.removeEventListener('visibilitychange', pause) }
  }, [active, definition])
  useEffect(() => {
    if (!active || session.state !== 'running') return
    let last = performance.now()
    const timer = window.setInterval(() => {
      const now = performance.now()
      advanceCompetition(session, now - last)
      last = now
      refresh()
    }, 50)
    return () => window.clearInterval(timer)
  }, [active, session.state, definition])
  useEffect(() => {
    if (!feedback) return
    const timer = window.setTimeout(() => setFeedback(null), 650)
    return () => window.clearTimeout(timer)
  }, [feedback])
  const start = () => {
    session.players = createCompetitionPlayers(config, count)
    session.elapsed = 0
    session.countdown = 3000
    session.state = 'running'
    setFeedback(null)
    refresh()
  }
  const reset = () => {
    session.players = []; session.elapsed = 0; session.countdown = 0; session.state = 'ready'
    setFeedback(null); refresh()
  }
  const content = (id: string, fallback: string, availableWidth: number) => {
    const element = elements.find(item => item.id === id)
    if (element?.type !== 'activity') return <span style={{ fontSize: 42 }}>{fallback}</span>
    const size = Math.min(availableWidth / element.width, 260 / element.height)
    return <span style={{ display: 'block', position: 'relative', width: element.width * size,
      height: element.height * size, pointerEvents: 'none' }}>
      <ActivityElementRenderer element={{ ...element, x: 0, y: 0 } as ActivityElement} scale={size}
        resourceMap={resourceMap} slideIndex={0} currentIndex={0} isEditMode={false} />
    </span>
  }
  const timing = competitionTiming[session.difficulty]
  const duration = (config.items.length - 1) * timing.interval + timing.drop
  const time = clock(session.players.length ? competitionDuration(session) - session.elapsed : duration)
  return <section style={styles.panel} aria-label='分组竞争' data-activity-canvas='GroupCompetition'
    data-activity-control='true' data-prevent-swipe='true' onClick={event => event.stopPropagation()}
    onPointerDown={event => event.stopPropagation()}>
    <div style={{ ...styles.stage, width: 1920 * pairs, height: stageHeight, transform: `scale(${factor})`, transformOrigin: 'top left' }}>
      {Array.from({ length: pairs }, (_, pair) => <div key={pair} data-competition-pair={pair}
        style={{ ...styles.pair, width: 1920, left: pair * 1920 }}>
        <div style={styles.divider} />
        {session.state !== 'ready' && <CompetitionHeader title={title} leftScore={session.players[pair * 2]?.score || 0}
          rightScore={session.players[pair * 2 + 1]?.score || 0} pair={pair} time={time}
          active={active && session.state === 'running' && !session.countdown}
          onPause={() => { session.state = 'paused'; refresh() }} />}
        {[0, 1].map(side => {
          const playerIndex = pair * 2 + side
          const player = session.players[playerIndex]
          return <div key={side} style={{ ...styles.lane, left: side * 960, width: 960 }}>
            {!session.countdown && player?.drops.map((item, i) => {
              const progress = (session.elapsed - i * timing.interval) / timing.drop
              if (item.hit || progress < 0 || progress >= 1) return null
              const hit = () => {
                const before = player.score
                if (hitCompetitionMaterial(session, playerIndex, i)) {
                  setFeedback({ player: playerIndex, text: `${item.correct ? '+' : '−'}${Math.abs(player.score - before)}`,
                    correct: item.correct, at: performance.now() })
                  refresh()
                }
              }
              return <button type='button' key={item.id} style={{ ...styles.drop, width: 440, height: 260,
                left: i % 2 ? 500 : 20, top: progress * (stageHeight + 100) - 120 }}
                aria-label={item.text || '素材'} disabled={!active || session.state !== 'running'}
                data-competition-item={item.id} data-competition-player={playerIndex}
                onPointerDown={event => { if (event.button === 0 && active) { event.preventDefault(); hit() } }}
                onClick={hit}>{content(item.id, item.text, 420)}{item.double && <span style={styles.double}>×2</span>}</button>
            })}
          </div>
        })}
        {feedback && Math.floor(feedback.player / 2) === pair && <div key={feedback.at} role='status'
          style={{ ...styles.feedback, left: feedback.player % 2 ? '50%' : 0, color: feedback.correct ? '#3caf51' : '#ef4740' }}>
          {feedback.text}{session.players[feedback.player].combo >= 3 && <div style={{ fontSize: 34 }}>连击 ×{session.players[feedback.player].combo}</div>}
        </div>}
        {!!session.countdown && session.state === 'running' && <div role='status' style={styles.countdown}
          data-competition-countdown='true'>{Math.ceil(session.countdown / 1000)}</div>}
        {session.state === 'paused' && <div style={styles.overlay}><CompetitionEntrance>
          <div style={{ ...styles.setup, padding: '30px 50px 45px' }}><CompetitionParchment />
            <h2 style={{ ...styles.setupTitle, minHeight: 85, margin: 0 }}>活动已暂停</h2>
            <div style={{ ...styles.actions, position: 'relative', marginTop: 80 }}>
              <CompetitionAction label='继续' icon='▶' disabled={!active} onClick={() => { session.state = 'running'; refresh() }} />
              <CompetitionAction label='重新开始' icon='↻' disabled={!active} onClick={reset} />
            </div>
          </div>
        </CompetitionEntrance></div>}
        {session.state === 'finished' && <div style={styles.overlay}><CompetitionEntrance>
          <div style={{ display: 'flex', gap: 166 }}>
            {[0, 1].map(side => {
              const player = session.players[pair * 2 + side]
              const rival = session.players[pair * 2 + 1 - side]
              return <div key={side} style={styles.result}><CompetitionParchment />
                <div style={styles.resultTitle}>{player.score === rival.score ? '平局' : player.score > rival.score ? '★ 获胜 ★' : '再接再厉'}</div>
                <div style={{ ...styles.resultDetail, fontWeight: 700 }}>第 {pair * 2 + side + 1} 组</div>
                <div style={styles.resultScore}>{player.score}<span style={{ fontSize: 32 }}> 分</span></div>
                <div style={styles.resultDetail}>正确 {player.right} · 错误 {player.wrong}<br />最高连击 {player.maximumCombo}</div>
              </div>
            })}
          </div>
          <div style={styles.actions}><CompetitionAction label='重新开始' icon='↻' disabled={!active} onClick={reset} /></div>
        </CompetitionEntrance></div>}
      </div>)}
    </div>
    {session.state === 'ready' && <div style={styles.overlay}>
      <div style={{ transform: `scale(${Math.min(width / 1920, height / 1080)})` }}><CompetitionEntrance>
        <div style={styles.setup}><CompetitionParchment /><div style={styles.setupTitle}>{title}</div>
          <div style={styles.duration}>活动时长 {clock(duration)}</div>
          <div style={styles.optionRow}><span>难度</span><div role='group' aria-label='难度'>
            {difficulties.map((difficulty, index) => <button type='button' key={difficulty} aria-label={['简单', '普通', '困难'][index]}
              aria-pressed={session.difficulty === difficulty} disabled={!active}
              style={{ ...styles.star, color: index <= difficulties.indexOf(session.difficulty) ? '#ffbd31' : '#d3b17b' }}
              onClick={() => { session.difficulty = difficulty; refresh() }}>★</button>)}
          </div></div>
          <div style={styles.optionRow}><span>组数</span><div role='group' aria-label='组数' style={{ display: 'flex', gap: 16 }}>
            {([2, 4] as const).map(value => <button type='button' key={value} aria-pressed={count === value} disabled={!active}
              style={{ ...styles.people, color: count === value ? '#ad6d25' : '#b89763', background: count === value ? '#ffe9a3' : '#e4c68a' }}
              onClick={() => setCount(value)}>{value === 2 ? '两组' : '四组'}</button>)}
          </div></div>
        </div>
        <div style={styles.actions}><CompetitionAction label='开始' icon='▶' disabled={!active} onClick={start} /></div>
      </CompetitionEntrance></div>
    </div>}
  </section>
}
