import { getElementText } from './xml-utils'

export interface VideoElement {
  type: 'video'
  id: string
  x: number
  y: number
  width: number
  height: number
  sourceId: string
  mediaName: string
  rotation: number
  volume: number
  clipStart: number
  isLoopPlay: boolean
  isAutoPlay: boolean
  isCrossSlidePlay: boolean
  stopPlayPageNumber: number
  thumbnailSourceId?: string
}

function parseBoolean(value: string | null, fallback = false): boolean {
  if (!value) return fallback
  const normalized = value.trim().toLowerCase()
  if (normalized === 'true') return true
  if (normalized === 'false') return false
  return fallback
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/**
 * 解析视频元素
 */
export function parseVideoElement(videoNode: Element): VideoElement | null {
  try {
    const id = getElementText(videoNode, 'Id') || 'unknown'
    const x = parseFloat(getElementText(videoNode, 'X') || '0')
    const y = parseFloat(getElementText(videoNode, 'Y') || '0')
    const width = parseFloat(getElementText(videoNode, 'Width') || '100')
    const height = parseFloat(getElementText(videoNode, 'Height') || '100')
    const sourceText = getElementText(videoNode, 'Source') || ''
    const sourceId = sourceText.replace('id://', '')
    const mediaName = getElementText(videoNode, 'MediaName') || ''
    const rotation = parseFloat(getElementText(videoNode, 'Rotation') || '0')
    const volume = clamp(parseFloat(getElementText(videoNode, 'Volume') || '1'), 0, 1)
    const clipStart = Math.max(0, parseFloat(getElementText(videoNode, 'ClipStart') || '0'))
    const isLoopPlay = parseBoolean(getElementText(videoNode, 'ElementBehavior > IsLoopPlay'))
    const isAutoPlay = parseBoolean(getElementText(videoNode, 'ElementBehavior > IsAutoPlay'))
    const isCrossSlidePlay = parseBoolean(getElementText(videoNode, 'ElementBehavior > IsCrossSlidePlay'))
    const stopPlayPageNumber = Math.max(0, parseInt(getElementText(videoNode, 'ElementBehavior > StopPlayPageNumber') || '0', 10))
    const thumbnailSourceIdRaw = getElementText(videoNode, 'Thumbnail')
    const thumbnailSourceId = thumbnailSourceIdRaw?.replace('id://', '') || undefined

    return {
      type: 'video',
      id,
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
      stopPlayPageNumber,
      thumbnailSourceId
    }
  } catch (error) {
    console.error('  [Video] ✗ 解析异常:', error)
    return null
  }
}
