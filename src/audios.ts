import type { AudioElement } from './types'
import { getDirectChildElement, getDirectChildText } from './xml-utils'

/** Cvte.Storage.Standard.TimeSpan 以 100ns ticks 序列化。 */
export function parseMediaTime(value: string | null): number | null {
  if (!value?.trim()) return null
  const ticks = Number(value)
  return Number.isFinite(ticks) && ticks >= 0 ? ticks / 10_000_000 : null
}

export function parseAudioElement(node: Element): AudioElement {
  const text = (name: string) => getDirectChildText(node, name)
  const number = (name: string, fallback: number) => {
    const value = text(name)
    const parsed = value?.trim() ? Number(value) : NaN
    return Number.isFinite(parsed) ? parsed : fallback
  }
  const behavior = getDirectChildElement(node, 'ElementBehavior')
  const flag = (name: string) => behavior
    ? getDirectChildText(behavior, name)?.trim().toLowerCase() === 'true'
    : false
  const points = getDirectChildElement(node, 'PlayPoints')
  const stop = Number(behavior && getDirectChildText(behavior, 'StopPlayPageNumber'))
  return {
    type: 'audio',
    id: text('Id') || 'unknown',
    x: number('X', 0), y: number('Y', 0),
    width: 111, height: 64,
    rotation: number('Rotation', 0),
    sourceId: (text('Source') || '').replace(/^id:\/\//, ''),
    mediaName: text('MediaName') || '音频',
    volume: Math.max(0, Math.min(1, number('Volume', 0.5))),
    clipStart: parseMediaTime(text('ClipStart')) || 0,
    clipEnd: parseMediaTime(text('ClipEnd')),
    playPoints: points ? Array.from(points.children)
      .map(item => parseMediaTime(item.textContent))
      .filter((time): time is number => time !== null).sort((a, b) => a - b) : [],
    isHidden: text('IsHidden')?.trim().toLowerCase() === 'true',
    isAutoPlay: flag('IsAutoPlay'), isLoopPlay: flag('IsLoopPlay'),
    isCrossSlidePlay: flag('IsCrossSlidePlay'),
    stopPlayPageNumber: Number.isFinite(stop) ? Math.max(0, Math.trunc(stop)) : 0
  }
}

export function audioRange(element: AudioElement, duration: number) {
  const end = Math.min(duration, element.clipEnd ?? duration)
  return { start: Math.min(element.clipStart, end), end }
}
