import { useCallback, useEffect, useRef, useState } from 'react'
import type { AudioElement } from '../../types'
import { audioRange } from '../../audios'

interface PlaybackOptions {
  element: AudioElement
  url?: string
  active: boolean
  keepPlaying: boolean
  autoPlay: boolean
}

/** 播放实例留在页面元素内，跨页保活时不重建。 */
export function useAudioPlayback({ element, url, active, keepPlaying, autoPlay }: PlaybackOptions) {
  const ref = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [position, setPosition] = useState(0)
  const [volume, setVolume] = useState(element.volume)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const generation = useRef(0)
  const allowed = useRef(keepPlaying)
  allowed.current = keepPlaying
  const range = audioRange(element, duration)

  const play = useCallback(async () => {
    const audio = ref.current
    if (!audio || !url || !allowed.current) return
    const request = ++generation.current
    setError('')
    if (audio.error) audio.load()
    if (Number.isFinite(audio.duration)) {
      const { start, end } = audioRange(element, audio.duration)
      if (end <= start) {
        setError('音频裁剪范围无效')
        return
      }
      if (audio.currentTime < start || audio.currentTime >= end) audio.currentTime = start
    }
    try {
      await audio.play()
      if (request !== generation.current || !allowed.current) audio.pause()
    } catch (reason) {
      if (request !== generation.current) return
      setLoading(false)
      const name = reason instanceof Error ? reason.name : ''
      if (name === 'AbortError') return
      setError(name === 'NotAllowedError' ? '自动播放被阻止，请点击播放' : '音频无法播放，请重试或检查文件格式')
    }
  }, [element, url])

  useEffect(() => {
    const audio = ref.current
    if (!audio) return
    setDuration(0)
    setPosition(0)
    setError('')
    setLoading(false)
    setPlaying(false)
    const metadata = () => {
      if (!Number.isFinite(audio.duration)) return
      const { start, end } = audioRange(element, audio.duration)
      setDuration(audio.duration)
      if (audio.currentTime < start || audio.currentTime > end) audio.currentTime = start
      setPosition(audio.currentTime)
      if (end <= start) setError('音频裁剪范围无效')
    }
    const stopAtEnd = () => {
      const { start, end } = audioRange(element, audio.duration)
      if (!Number.isFinite(end)) return
      if (audio.currentTime < start) audio.currentTime = start
      if (audio.currentTime >= end) {
        if (element.isLoopPlay && allowed.current && end > start) {
          audio.currentTime = start
          if (audio.paused) void play()
        } else {
          audio.pause()
          audio.currentTime = start
        }
      }
      setPosition(audio.currentTime)
    }
    const onPlay = () => {
      if (!allowed.current) { audio.pause(); return }
      setPlaying(true)
      setError('')
    }
    const onPause = () => { setPlaying(false); setLoading(false) }
    const onWaiting = () => setLoading(true)
    const onPlaying = () => setLoading(false)
    const onError = () => {
      setLoading(false)
      setPlaying(false)
      setError('音频损坏或当前浏览器不支持此格式')
    }
    const onVolume = () => setVolume(audio.volume)
    const events: [string, EventListener][] = [
      ['loadedmetadata', metadata], ['durationchange', metadata], ['timeupdate', stopAtEnd],
      ['ended', stopAtEnd], ['play', onPlay], ['pause', onPause], ['waiting', onWaiting],
      ['playing', onPlaying], ['error', onError], ['volumechange', onVolume]
    ]
    events.forEach(([name, listener]) => audio.addEventListener(name, listener))
    // timeupdate 间隔由浏览器决定，补充检查以限制短裁剪片段。
    const timer = window.setInterval(() => { if (!audio.paused) stopAtEnd() }, 40)
    return () => {
      generation.current++
      audio.pause()
      window.clearInterval(timer)
      events.forEach(([name, listener]) => audio.removeEventListener(name, listener))
    }
  }, [url, element, play])

  useEffect(() => {
    if (ref.current) ref.current.volume = element.volume
  }, [element.volume, url])

  useEffect(() => {
    if (!keepPlaying) {
      generation.current++
      ref.current?.pause()
    }
  }, [keepPlaying])

  useEffect(() => {
    if (active && autoPlay) void play()
  }, [active, autoPlay, play])

  const seek = (time: number) => {
    if (!ref.current || range.end <= range.start) return
    const next = Math.max(range.start, Math.min(range.end, time))
    ref.current.currentTime = next
    setPosition(next)
  }
  return {
    ref, playing, loading, error, volume, position, range, play, seek,
    toggle: () => { if (ref.current?.paused) void play(); else ref.current?.pause() },
    replay: () => { seek(range.start); void play() },
    changeVolume: (next: number) => { if (ref.current) ref.current.volume = next }
  }
}
