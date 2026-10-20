import { useEffect, useRef, useState } from 'react'
import { subjectStyles as styles } from './styles'

/** 同时兼容课件资源 ID、逻辑路径和已保存的网络地址。 */
export function resolvePronounceUrl(source: string, resourceMap: Record<string, string>) {
  const key = source.trim().replace(/^id:\/\//i, '').replace(/\\/g, '/')
  return resourceMap[key] || (/^https?:\/\//i.test(key) ? key : undefined)
}

export function PronounceButton({ source, resourceMap, active, label = '播放发音' }: {
  source: string; resourceMap: Record<string, string>; active: boolean; label?: string
}) {
  const url = resolvePronounceUrl(source, resourceMap)
  const ref = useRef<HTMLAudioElement>(null)
  const request = useRef(0)
  const allowed = useRef(active)
  allowed.current = active
  const [playing, setPlaying] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    const audio = ref.current
    setPlaying(false)
    setError('')
    return () => { request.current++; audio?.pause() }
  }, [url, active])
  useEffect(() => {
    if (!active) { request.current++; ref.current?.pause(); setPlaying(false) }
  }, [active])
  const handlePlay = async () => {
    const audio = ref.current
    if (!audio || !url || !allowed.current) return
    const version = ++request.current
    if (!audio.paused) { audio.pause(); return }
    setError('')
    try {
      audio.currentTime = 0
      await audio.play()
      if (version !== request.current || !allowed.current) audio.pause()
    } catch {
      if (version === request.current) setError('发音无法播放，请重试')
    }
  }
  return <>
    {active && <audio ref={ref} src={url} preload="none" onPlay={() => {
      if (!allowed.current) { ref.current?.pause(); return }
      setPlaying(true)
    }} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}
      onError={() => { setPlaying(false); setError('发音资源无法加载') }} />}
    <button type="button" style={{ ...styles.icon, opacity: !url ? .35 : 1 }} disabled={!url || !active} onClick={() => void handlePlay()}
      aria-label={label} aria-pressed={playing} title={error || (!url ? '课件中缺少发音资源' : label)}>
      <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="currentColor">
        <path d="M3 9h4l5-4v14l-5-4H3z" />
        {playing ? <path d="M16 7h2v10h-2zM20 7h2v10h-2z" /> : <path fill="none" stroke="currentColor" strokeWidth="1.5"
          d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" />}
      </svg>
    </button>
    {error && <span role="status" style={styles.secondary}>{error}</span>}
  </>
}
