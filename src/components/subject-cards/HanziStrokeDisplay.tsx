import { useEffect, useId, useRef, useState } from 'react'
import { hasHanziStrokes, loadHanziStrokes } from '../../rendering/hanzi-strokes'
import type { HanziStroke } from '../../rendering/hanzi-strokes'
import { HanziStrokePlayer } from '../../rendering/hanzi-stroke-player'
import type { StrokeFrame } from '../../rendering/hanzi-stroke-player'
import { subjectStyles as styles } from './styles'

const empty: StrokeFrame = { completed: [], current: -1, progress: 0, highlights: [], manual: false }

/** 300 内部坐标缩放至 120 像素，逐笔遮罩只揭示当前轮廓。 */
export function HanziStrokeDisplay({ character, active, children }: {
  character: string; active: boolean; children: React.ReactNode
}) {
  const [strokes, setStrokes] = useState<HanziStroke[] | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [frame, setFrame] = useState<StrokeFrame>(empty)
  const player = useRef<HanziStrokePlayer | null>(null)
  const mask = `hanzi-${useId().replace(/:/g, '')}`
  useEffect(() => {
    let cancelled = false
    setStrokes(null)
    setError('')
    void loadHanziStrokes(character).then(data => { if (!cancelled) setStrokes(data) })
      .catch(() => { if (!cancelled) setError('笔顺加载失败，点击重试') })
    return () => { cancelled = true }
  }, [character, attempt])
  useEffect(() => {
    setFrame(empty)
    if (!strokes || !active) return
    const current = new HanziStrokePlayer(strokes, setFrame)
    player.current = current
    const handleVisibility = () => { if (document.hidden) current.reset() }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      current.dispose()
      player.current = null
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [strokes, active])
  const supported = hasHanziStrokes(character)
  const available = !!strokes && active
  const title = error || (!supported ? '暂无该字的笔顺数据' : !strokes ? '正在加载笔顺' : undefined)
  const current = strokes?.[frame.current]
  const color = frame.manual ? '#2e7de6' : '#dc143c'
  const handlePlay = (mode: 'auto' | 'step') => {
    if (error) { setAttempt(value => value + 1); return }
    if (active && !document.hidden) player.current?.play(mode)
  }
  return <>
    <div style={{ ...styles.grid, width: 156, height: 156, margin: '0 12px 3px' }}>
      <svg aria-hidden="true" viewBox="0 0 156 156" width="156" height="156" style={{ position: 'absolute', inset: 0 }}>
        <rect x="1" y="1" width="154" height="154" fill="none" stroke="#00c881" strokeWidth="2" />
        <path d="M78 1V155M1 78H155" fill="none" stroke="#00c881" strokeWidth="2" strokeDasharray="3 3" />
      </svg>
      {strokes ? <svg viewBox="0 0 300 300" width="120" height="120" role="img" aria-label={`${character} 笔顺`}
        style={styles.hanziStroke} data-stroke-index={frame.current} data-completed-strokes={frame.completed.length}>
        <title>{character}</title>
        {strokes.map((stroke, index) => <path key={index} d={stroke.outline} fill="#000000" />)}
        {frame.completed.map(index => <path key={`done-${index}`} d={strokes[index].outline} fill="#dc143c" />)}
        {frame.highlights.map(index => <path key={`highlight-${index}`} d={strokes[index].outline} fill="#2e7de6" />)}
        {current && <>
          <defs><mask id={mask} maskUnits="userSpaceOnUse" x="0" y="0" width="300" height="300"
            style={{ maskType: 'luminance' }}>
            <path d={current.animationPath} fill="none" stroke="#ffffff" strokeWidth="40" strokeLinecap="round"
              strokeLinejoin="round" strokeDasharray={`${current.length * frame.progress} ${current.length + 1}`} />
          </mask></defs>
          <path d={current.outline} fill={color} mask={`url(#${mask})`} />
        </>}
        {active && strokes.map((stroke, index) => <path key={`hit-${index}`} d={stroke.outline} fill="transparent"
          style={{ cursor: 'pointer' }} onClick={() => { if (!document.hidden) player.current?.highlight(index) }} />)}
      </svg> : <span style={styles.hanzi}>{character}</span>}
    </div>
    <div style={{ height: 46, display: 'flex', alignItems: 'center', padding: '0 12px', gap: 10 }}>
      {children}
      {(['auto', 'step'] as const).map(mode => <button key={mode} type="button" disabled={!available && !(error && active)}
        title={title} aria-label={`${character} ${mode === 'auto' ? '连写' : '单步'}`} onClick={() => handlePlay(mode)}
        style={{ ...styles.button, width: 40, height: 26 }}>{mode === 'auto' ? '连写' : '单步'}</button>)}
    </div>
  </>
}
