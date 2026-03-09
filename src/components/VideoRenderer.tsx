import { useEffect, useRef, useState } from 'react'
import type { VideoElement } from '../videos'

interface VideoRendererProps {
  element: VideoElement
  scale: number
  resourceMap: Record<string, string>
  isCurrentSlide: boolean
  currentSlideNumber: number
  sourceSlideNumber: number
}

/**
 * 视频渲染器（浏览器原生控件）
 */
export function VideoRenderer({
  element,
  scale,
  resourceMap,
  isCurrentSlide,
  currentSlideNumber,
  sourceSlideNumber
}: VideoRendererProps) {
  const {
    x,
    y,
    width,
    height,
    sourceId,
    mediaName,
    rotation,
    volume,
    clipStart,
    isLoopPlay,
    isAutoPlay,
    isCrossSlidePlay,
    stopPlayPageNumber
  } = element
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  const canCrossSlideContinue = isCrossSlidePlay
    && currentSlideNumber > sourceSlideNumber
    && (
      stopPlayPageNumber <= 0
      || currentSlideNumber < stopPlayPageNumber
    )
  const shouldKeepPlaying = isCurrentSlide || canCrossSlideContinue

  useEffect(() => {
    const url = resourceMap[sourceId]
    setVideoUrl(url || null)
  }, [sourceId, resourceMap])

  useEffect(() => {
    if (!videoRef.current) return
    videoRef.current.volume = Math.max(0, Math.min(1, volume))
  }, [volume, videoUrl])

  useEffect(() => {
    if (!videoRef.current || shouldKeepPlaying) return
    videoRef.current.pause()
  }, [shouldKeepPlaying])

  if (!videoUrl) {
    return (
      <div
        style={{
          position: 'absolute',
          left: x * scale,
          top: y * scale,
          width: width * scale,
          height: height * scale,
          backgroundColor: '#1a202c',
          border: `${Math.max(1, scale)}px solid #4a5568`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12 * scale,
          color: '#e2e8f0'
        }}
      >
        视频资源未加载
      </div>
    )
  }

  return (
    <video
      ref={videoRef}
      src={videoUrl}
      controls
      loop={isLoopPlay}
      autoPlay={isAutoPlay}
      playsInline
      preload='metadata'
      aria-label={mediaName || '视频'}
      onLoadedMetadata={() => {
        if (!videoRef.current) return
        if (clipStart > 0 && Number.isFinite(clipStart)) {
          videoRef.current.currentTime = Math.max(0, clipStart)
        }
      }}
      style={{
        position: 'absolute',
        left: x * scale,
        top: y * scale,
        width: width * scale,
        height: height * scale,
        transform: rotation ? `rotate(${rotation}deg)` : undefined,
        transformOrigin: 'center center',
        backgroundColor: '#000000'
      }}
    />
  )
}
