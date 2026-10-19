import { useEffect, useState } from 'react'
import type { AudioElement } from '../types'
import { AudioControls } from './audio-player/AudioControls'
import { useAudioPlayback } from './audio-player/useAudioPlayback'

interface Props {
  element: AudioElement
  scale: number
  resourceMap: Record<string, string>
  isCurrentSlide: boolean
  currentSlideNumber: number
  sourceSlideNumber: number
  isEditMode: boolean
  isVisible: boolean
  slideWidth: number
  slideHeight: number
  onEditAudioUpdate?: (elementId: string, edit: import('../viewer/audio-editing').AudioEdit) => void
}

export function AudioRenderer({ element, scale, resourceMap, isCurrentSlide,
  currentSlideNumber, sourceSlideNumber, isEditMode, isVisible, slideWidth, onEditAudioUpdate }: Props) {
  const [expanded, setExpanded] = useState(false)
  const crossPlay = element.isCrossSlidePlay && currentSlideNumber > sourceSlideNumber
    && (element.stopPlayPageNumber <= 0 || currentSlideNumber < element.stopPlayPageNumber)
  const active = isCurrentSlide && isVisible && !isEditMode
  const url = resourceMap[element.sourceId]
  const player = useAudioPlayback({ element, url, active,
    keepPlaying: !isEditMode && (active || crossPlay) || isCurrentSlide && isEditMode,
    autoPlay: element.isAutoPlay && !element.isHidden })
  const audioRef = player.ref
  useEffect(() => { if (isEditMode) audioRef.current?.pause() }, [isEditMode, audioRef])
  // 官方 AudioBar 清除显式宽高，以内容尺寸布局；只允许平移。
  const width = expanded ? 400 : 111
  const left = expanded ? Math.max(0, Math.min(element.x, slideWidth - width)) : element.x
  return <>
    <audio ref={player.ref} src={url} preload={url?.includes('/courseware/') ? 'none' : 'metadata'} aria-label={element.mediaName} />
    {isVisible && isCurrentSlide && !element.isHidden && <div
      style={{ position: 'absolute', left: left * scale, top: element.y * scale,
        transform: `scale(${scale})`, transformOrigin: 'top left' }}>
      <AudioControls element={element} player={player} expanded={expanded}
        onExpand={setExpanded} isEditMode={isEditMode} missing={!url}
        onEdit={edit => onEditAudioUpdate?.(element.id, edit)} />
    </div>}
  </>
}
