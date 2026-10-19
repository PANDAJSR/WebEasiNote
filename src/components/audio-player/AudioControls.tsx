import { useEffect, useRef, useState } from 'react'
import type { AudioElement } from '../../types'
import type { AudioEdit } from '../../viewer/audio-editing'
import type { useAudioPlayback } from './useAudioPlayback'
import { audioStyles as styles, audioInteractionCss } from './styles'
import { AudioSlider } from './AudioSlider'

export function formatAudioTime(time: number) {
  const seconds = Math.max(0, Math.floor(time))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

// 从官方 MediaStyles.xaml / AudioBar.xaml 的 StreamGeometry 转为 SVG path。
const paths = {
  play: 'M7,4.70174353C7,3.04866756,8.08258085,2.5076349,9.41298834,3.48960533L19.3310686,10.8101154C20.2220188,11.4677235,20.223935,12.5325026,19.3310686,13.191525L9.41298834,20.5120351C8.08033168,21.4956656,7,20.9424511,7,19.2998969L7,4.70174353z',
  pause: 'M6,4.50370994C6,3.67323387,6.66579723,3,7.5,3 8.32842712,3 9,3.66197696 9,4.50370994L9,19.4962901C9,20.3267661,8.33420277,21,7.5,21 6.67157288,21 6,20.338023 6,19.4962901z M15,4.50370994C15,3.67323387,15.6657972,3,16.5,3 17.3284271,3 18,3.66197696 18,4.50370994L18,19.4962901C18,20.3267661,17.3342028,21,16.5,21 15.6715729,21 15,20.338023 15,19.4962901z',
  expand: 'M10 13H0v1h10v.5a1.5 1.5 0 003 0V14h3v-1h-3v-.5a1.5 1.5 0 00-3 0z M3 8H0v1h3v.5a1.5 1.5 0 003 0V9h10V8H6v-.5a1.5 1.5 0 00-3 0z M10 3H0v1h10v.5a1.5 1.5 0 003 0V4h3V3h-3v-.5a1.5 1.5 0 00-3 0z',
  shrink: 'M6.40153847 8.01633737L11.7700806 2.65148926A1 1 0 0010.2813159 1.30356766L4.2802124 7.30340576A1 1 0 004.43521356 8.82571015L10.2194375 14.6265036A1 1 0 0011.6453812 13.2362964z',
  volume: 'M0 9C0 9.5 .4 10 .9 10H3l2.5 2.5C6.3 13.3 7 13.1 7 11.9V2C7 .8 6.3 .6 5.5 1.4L3 4H.9C.4 4 0 4.4 0 4.9z M9 9.8C10.1 9.4 11 8.3 11 7S10.1 4.5 9 4.1z M9 13.7C11.8 12.8 14 10.1 14 7S11.8 1.1 9 .2v1.7C11 2.7 12.4 4.6 12.4 7S11 11.2 9 12z'
}

function Icon({ name, size = 16 }: { name: keyof typeof paths; size?: number }) {
  return <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden='true'>
    <path fill='currentColor' d={paths[name]} />
  </svg>
}

function displayPoint(time: number, duration: number) {
  const seconds = Math.floor(time)
  return formatAudioTime(time - seconds > 0.5 && seconds + 1 < duration ? seconds + 1 : seconds)
}

interface Props {
  element: AudioElement
  player: ReturnType<typeof useAudioPlayback>
  expanded: boolean
  onExpand: (value: boolean) => void
  isEditMode: boolean
  missing: boolean
  onEdit?: (edit: AudioEdit) => void
}

export function AudioControls({ element, player, expanded, onExpand, missing, isEditMode, onEdit }: Props) {
  const [hovered, setHovered] = useState(false)
  const [volumeOpen, setVolumeOpen] = useState(false)
  const container = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!volumeOpen) return
    const close = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setVolumeOpen(false)
    }
    document.addEventListener('pointerdown', close, true)
    return () => document.removeEventListener('pointerdown', close, true)
  }, [volumeOpen])
  const resume = useRef(false)
  const { range, position, playing } = player
  const length = range.end - range.start
  const progress = length > 0 ? Math.max(0, Math.min(1, (position - range.start) / length)) : 0
  const points = element.playPoints.filter(point => point >= range.start && point <= range.end)
  return <div ref={container} style={styles.bar} data-prevent-swipe='true' data-audio-control='true'
    onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
    onClick={event => event.stopPropagation()} onDoubleClick={event => event.stopPropagation()}
    onKeyDown={event => event.stopPropagation()}>
    <style>{audioInteractionCss}</style>
    <div style={{ ...styles.background, opacity: hovered || expanded ? 1 : 0.37 }} />
    <button style={styles.play} aria-label={playing ? '暂停音频' : '播放音频'}
      title={element.mediaName} disabled={missing} onMouseDown={event => event.stopPropagation()}
      onClick={player.toggle}>
      <Icon name={playing ? 'pause' : 'play'} size={24} />
      {!expanded && <svg width={48} height={48} viewBox='0 0 48 48' style={styles.ring}>
        <circle cx={24} cy={24} r={23} fill='none' stroke='#3f9fff' strokeWidth={2}
          strokeDasharray={`${progress * 2 * Math.PI * 23} ${2 * Math.PI * 23}`}
          transform='rotate(-90 24 24)' />
      </svg>}
    </button>
    <div style={{ display: 'flex', alignItems: 'center', position: 'relative', width: expanded ? 328 : 41,
      transition: 'width 150ms ease-in' }}>
      {expanded ? <>
        <div style={styles.main}>
          <div style={styles.row}>
            <AudioSlider label='音频进度' value={position - range.start} max={length}
              onChange={value => player.seek(value + range.start)}
              onStart={() => { resume.current = playing; player.ref.current?.pause() }}
              onFinish={() => { if (resume.current) void player.play(); resume.current = false }} />
            <span style={styles.time}>{displayPoint(position - range.start, length)}<span style={{ color: '#c4c6cc' }}> / {formatAudioTime(length)}</span></span>
            <div style={{ position: 'relative', marginLeft: 11 }}>
              <button style={styles.button} aria-label='音频音量' aria-expanded={volumeOpen}
                onMouseDown={event => event.stopPropagation()} onClick={() => setVolumeOpen(!volumeOpen)}><Icon name='volume' /></button>
              {volumeOpen && <div style={styles.volume} onBlur={event => {
                if (!event.currentTarget.contains(event.relatedTarget)) setVolumeOpen(false)
              }}>
                <AudioSlider label='调整音量' value={player.volume} max={1} onChange={value => {
                  player.changeVolume(value)
                  if (isEditMode) onEdit?.({ volume: value })
                }} />
                <span style={{ position: 'absolute', left: 50, bottom: -14, width: 0, height: 0,
                  borderLeft: '9px solid transparent', borderRight: '9px solid transparent', borderTop: '14px solid #333333cc' }} />
              </div>}
            </div>
          </div>
          {points.length > 0 && <div style={styles.points}>
            {points.map((point, index) => <button key={`${point}-${index}`} style={styles.point}
              title={formatAudioTime(point - range.start)} onMouseDown={event => event.stopPropagation()}
              onClick={() => { player.seek(Math.max(range.start, point - 0.1)); void player.play() }}>
              {points.length * 54 > 270 ? index + 1 : displayPoint(point - range.start, length)}
            </button>)}
          </div>}
        </div>
        <div style={styles.shrink}><button style={styles.button} aria-label='折叠音频控制条'
          onMouseDown={event => event.stopPropagation()} onClick={() => { setVolumeOpen(false); onExpand(false) }}><Icon name='shrink' /></button></div>
      </> : <button style={{ ...styles.button, marginRight: 17 }} aria-label='展开音频控制条'
        onMouseDown={event => event.stopPropagation()} onClick={() => onExpand(true)}><Icon name='expand' /></button>}
    </div>
    {(missing || player.error) && <div role='status' style={styles.error}>
      {missing ? '音频资源未加载' : player.error}
    </div>}
  </div>
}
