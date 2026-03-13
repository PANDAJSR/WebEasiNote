import type { SlideData } from '../../parser'

export type SupportedAnimationTrigger = 'click' | 'before' | 'after'

export type TimelineAnimation = SlideData['animations'][number] & {
  normalizedTrigger: SupportedAnimationTrigger
}

export interface AnimationStartBatch {
  atMs: number
  indexes: number[]
}

function normalizeAnimationTrigger(trigger: string): SupportedAnimationTrigger | null {
  const normalizedTrigger = trigger.trim().toLowerCase()
  if (normalizedTrigger === 'click' || normalizedTrigger === 'before' || normalizedTrigger === 'after') {
    return normalizedTrigger
  }
  return null
}

export function resolveTimelineAnimations(
  animations: SlideData['animations'],
  elementIdSet: Set<string>,
  isConsumableAnimation: (animation: SlideData['animations'][number]) => boolean
): TimelineAnimation[] {
  const result = animations
    .map(animation => {
      const normalizedTrigger = normalizeAnimationTrigger(animation.trigger)
      if (!normalizedTrigger) return null
      if (!isConsumableAnimation(animation)) return null
      const targetId = elementIdSet.has(animation.targetId)
        ? animation.targetId
        : elementIdSet.has(animation.sourceElementId)
          ? animation.sourceElementId
          : animation.targetId
      return {
        ...animation,
        targetId,
        normalizedTrigger
      }
    })
    .filter((animation): animation is TimelineAnimation => Boolean(animation))
  return result
}

export function resolveClickGroupStartIndexes(timelineAnimations: TimelineAnimation[]): number[] {
  const groupStarts: number[] = []
  timelineAnimations.forEach((animation, index) => {
    if (animation.normalizedTrigger === 'click') {
      groupStarts.push(index)
    }
  })

  if (groupStarts.length === 0 && timelineAnimations.length > 0) {
    groupStarts.push(0)
  }
  return groupStarts
}

export function getGroupEndIndex(
  groupStartIndexes: number[],
  groupIndex: number,
  totalAnimations: number
): number {
  const nextGroupStart = groupStartIndexes[groupIndex + 1]
  if (nextGroupStart === undefined) return totalAnimations - 1
  return nextGroupStart - 1
}

export function getExecutedCountForClickStep(
  clickStep: number,
  groupStartIndexes: number[],
  totalAnimations: number
): number {
  if (clickStep <= 0) return 0
  if (clickStep >= groupStartIndexes.length) return totalAnimations
  return groupStartIndexes[clickStep]
}

export function buildAnimationStartBatches(
  timelineAnimations: TimelineAnimation[],
  groupStartIndex: number,
  groupEndIndex: number
): AnimationStartBatch[] {
  if (groupStartIndex > groupEndIndex) return []

  const animationIndexesByTime = new Map<number, number[]>()
  let previousStartMs = 0
  let previousEndMs = 0

  for (let index = groupStartIndex; index <= groupEndIndex; index += 1) {
    const animation = timelineAnimations[index]
    let startMs = 0
    if (index === groupStartIndex || animation.normalizedTrigger === 'click') {
      startMs = 0
    } else if (animation.normalizedTrigger === 'before') {
      startMs = previousStartMs
    } else {
      startMs = previousEndMs
    }
    startMs += Math.max(0, animation.delayMs || 0)

    const durationMs = Math.max(0, animation.durationMs || 0)
    previousStartMs = startMs
    previousEndMs = startMs + durationMs

    const existingIndexes = animationIndexesByTime.get(startMs)
    if (existingIndexes) {
      existingIndexes.push(index)
    } else {
      animationIndexesByTime.set(startMs, [index])
    }
  }

  return Array.from(animationIndexesByTime.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([atMs, indexes]) => ({ atMs, indexes }))
}
