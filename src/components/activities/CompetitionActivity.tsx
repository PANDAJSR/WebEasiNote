import { useEffect, useReducer, useState } from 'react'
import { Button, Radio } from 'antd'
import type { ActivityDefinition, ActivityElement, SlideElement } from '../../types'
import { ActivityElementRenderer } from './ActivityElementRenderer'
import { advanceCompetition, competitionDuration, competitionSession, competitionTiming,
  createCompetitionPlayers, hitCompetitionMaterial } from '../../viewer/activities/competition'
import { competitionStyles as styles } from './competition-styles'

export function CompetitionActivity({ definition, elements, resourceMap, active }: {
  definition: ActivityDefinition; elements: SlideElement[]; resourceMap: Record<string, string>; active: boolean
}) {
  const [count, setCount] = useState<2 | 4>(() => competitionSession(definition).players.length === 4 ? 4 : 2)
  const [, refresh] = useReducer(value => value + 1, 0)
  const session = competitionSession(definition)
  const config = definition.competition!
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
  const start = () => {
    session.players = createCompetitionPlayers(config, count)
    session.elapsed = 0
    session.state = 'running'
    refresh()
  }
  const content = (id: string, fallback: string) => {
    const element = elements.find(item => item.id === id)
    if (element?.type !== 'activity') return fallback
    const factor = Math.min(1, 160 / element.width, 80 / element.height)
    return <span style={{ display: 'block', position: 'relative', width: element.width * factor,
      maxWidth: '100%', height: element.height * factor, overflow: 'hidden', pointerEvents: 'none' }}>
      <ActivityElementRenderer element={{ ...element, x: 0, y: 0 } as ActivityElement} scale={factor}
        resourceMap={resourceMap} slideIndex={0} currentIndex={0} isEditMode={false} />
    </span>
  }
  const timing = competitionTiming[session.difficulty]
  return <section style={styles.panel} aria-label='分组竞争' data-activity-canvas='GroupCompetition' data-activity-control='true' data-prevent-swipe='true'
    onClick={event => event.stopPropagation()} onPointerDown={event => event.stopPropagation()}>
    <div style={styles.header}><strong>分组竞争</strong>
      <Radio.Group aria-label='组数' value={count} disabled={session.state === 'running' || !active}
        options={[{ value: 2, label: '两组' }, { value: 4, label: '四组' }]} onChange={event => setCount(event.target.value)} />
      <Radio.Group aria-label='难度' value={session.difficulty} disabled={session.state === 'running' || !active}
        options={[{ value: 'Low', label: '简单' }, { value: 'Medium', label: '普通' }, { value: 'High', label: '困难' }]}
        onChange={event => { session.difficulty = event.target.value; session.state = 'ready'; session.players = []; session.elapsed = 0; refresh() }} />
      <Button disabled={!active} onClick={start}>{session.state === 'ready' ? '开始' : '重新开始'}</Button>
      {session.state === 'running' && <Button onClick={() => { session.state = 'paused'; refresh() }}>暂停</Button>}
      {session.state === 'paused' && <Button disabled={!active} onClick={() => { session.state = 'running'; refresh() }}>继续</Button>}
      {session.players.length > 0 && <span role='timer'>剩余 {Math.ceil((competitionDuration(session) - session.elapsed) / 1000)} 秒</span>}
    </div>
    <span>点击本组下落的正确素材，避开错误素材。</span>
    <div style={styles.board}>
      {(session.players.length ? session.players : Array.from({ length: count }, () => null)).map((player, playerIndex) => <div key={playerIndex} style={styles.lane}>
        <div style={styles.score}>第 {playerIndex + 1} 组 · {player?.score || 0} 分 · 连击 {player?.combo || 0}</div>
        {player?.drops.map((item, i) => {
          const progress = (session.elapsed - i * timing.interval) / timing.drop
          if (item.hit || progress < 0 || progress >= 1) return null
          return <Button key={item.id} style={{ ...styles.drop, left: i % 2 ? '52%' : '2%',
            top: `${progress * 110 - 10}%` }} disabled={!active || session.state !== 'running'}
            data-competition-item={item.id} data-competition-player={playerIndex}
            onPointerDown={event => {
              if (event.button !== 0 || !active) return
              event.preventDefault()
              if (hitCompetitionMaterial(session, playerIndex, i)) refresh()
            }} onClick={() => { if (active && hitCompetitionMaterial(session, playerIndex, i)) refresh() }}>
            {content(item.id, item.text)}{item.double && <span>双倍</span>}
          </Button>
        })}
        {player && session.state === 'finished' && <div style={styles.summary}>
          <strong>第 {playerIndex + 1} 组：{player.score} 分</strong>
          <span>正确 {player.right} · 错误 {player.wrong}</span><span>最高连击 {player.maximumCombo}</span>
        </div>}
      </div>)}
      {session.state === 'ready' && <div role='status'>选择组数和难度，然后开始活动。</div>}
      {session.state === 'paused' && <div role='status'>活动已暂停</div>}
    </div>
  </section>
}
