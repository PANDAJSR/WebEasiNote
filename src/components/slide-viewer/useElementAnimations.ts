import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { SlideData } from '../../parser'
import {
  buildAnimationStartBatches,
  getExecutedCountForClickStep,
  getGroupEndIndex,
  resolveClickGroupStartIndexes,
  resolveTimelineAnimations,
  type TimelineAnimation
} from './element-animation-timeline'
import {
  DEFAULT_ELEMENT_ANIMATION_DURATION_MS,
  ENABLE_ELEMENT_ANIMATION_DEBUG_LOG,
  FLICKER_KEYFRAME_ID,
  FLICKER_KEYFRAME_NAME,
  isAppearanceAnimation,
  isDisappearanceAnimation,
  isFadeAnimation,
  isFlickerAnimation
} from './constants'

interface UseElementAnimationsParams {
  slide: SlideData
}

const FADE_IN_KEYFRAME_NAME = 'seewo-element-fade-in'
const FADE_OUT_KEYFRAME_NAME = 'seewo-element-fade-out'

function isConsumableAnimation(animation: SlideData['animations'][number]): boolean {
  return isFadeAnimation(animation.type) || isFlickerAnimation(animation.type, animation.category)
}

export function useElementAnimations({ slide }: UseElementAnimationsParams) {
  const [slideClickSteps, setSlideClickSteps] = useState<Record<string, number>>({})
  const [slideExecutedCounts, setSlideExecutedCounts] = useState<Record<string, number>>({})
  const [recentlyTriggeredAnimationIds, setRecentlyTriggeredAnimationIds] = useState<Record<string, string[]>>({})
  const timerIdsRef = useRef<number[]>([])
  const lastStepChangeDirectionRef = useRef<'forward' | 'backward' | 'none'>('none')
  const elementIdSet = useMemo(() => new Set(slide.elements.map(element => element.id)), [slide.elements])

  const logElementAnimationDebug = useCallback((message: string, payload?: Record<string, unknown>) => {
    if (!ENABLE_ELEMENT_ANIMATION_DEBUG_LOG) return
    if (payload) {
      console.log(`[SlideViewer][ElementAnimation] ${message}`, payload)
      return
    }
    console.log(`[SlideViewer][ElementAnimation] ${message}`)
  }, [])

  const clearPendingTimers = useCallback(() => {
    timerIdsRef.current.forEach(timerId => window.clearTimeout(timerId))
    timerIdsRef.current = []
  }, [])

  useEffect(() => {
    if (typeof document === 'undefined') return
    if (document.getElementById(FLICKER_KEYFRAME_ID)) return
    const styleElement = document.createElement('style')
    styleElement.id = FLICKER_KEYFRAME_ID
    styleElement.textContent = `
      @keyframes ${FLICKER_KEYFRAME_NAME} {
        0% { opacity: 1; }
        15% { opacity: 0.2; }
        30% { opacity: 1; }
        45% { opacity: 0.2; }
        60% { opacity: 1; }
        75% { opacity: 0.2; }
        100% { opacity: 1; }
      }
      @keyframes ${FADE_IN_KEYFRAME_NAME} {
        0% { opacity: 0; }
        100% { opacity: 1; }
      }
      @keyframes ${FADE_OUT_KEYFRAME_NAME} {
        0% { opacity: 1; }
        100% { opacity: 0; }
      }
    `
    document.head.appendChild(styleElement)
  }, [])

  useEffect(() => {
    return () => clearPendingTimers()
  }, [clearPendingTimers])

  useEffect(() => {
    clearPendingTimers()
  }, [slide.id, clearPendingTimers])

  const timelineAnimations = useMemo(() => {
    return resolveTimelineAnimations(slide.animations, elementIdSet, isConsumableAnimation)
  }, [slide.animations, elementIdSet])

  const clickGroupStartIndexes = useMemo(() => {
    return resolveClickGroupStartIndexes(timelineAnimations)
  }, [timelineAnimations])

  const currentClickStep = slideClickSteps[slide.id] || 0
  const currentExecutedCount = slideExecutedCounts[slide.id] || 0
  const hasRemainingClickAnimations = currentClickStep < clickGroupStartIndexes.length

  const currentTriggeredAnimations = useMemo(() => {
    const animationIdSet = new Set(recentlyTriggeredAnimationIds[slide.id] || [])
    if (animationIdSet.size === 0) return []
    return timelineAnimations.filter(animation => animationIdSet.has(animation.id))
  }, [slide.id, timelineAnimations, recentlyTriggeredAnimationIds])

  const currentTriggeredAnimationByElementId = useMemo(() => {
    const animationByElementId = new Map<string, TimelineAnimation>()
    currentTriggeredAnimations.forEach(animation => {
      animationByElementId.set(animation.targetId, animation)
    })
    return animationByElementId
  }, [currentTriggeredAnimations])

  const executedAnimations = useMemo(() => {
    return timelineAnimations.slice(0, currentExecutedCount)
  }, [timelineAnimations, currentExecutedCount])

  const elementRenderStates = useMemo(() => {
    const result: Record<string, boolean> = {}
    if (timelineAnimations.length === 0) return result

    const firstAppearanceAnimationByElement = new Map<string, TimelineAnimation>()
    const appearedElementIds = new Set<string>()

    timelineAnimations.forEach(animation => {
      if (
        !firstAppearanceAnimationByElement.has(animation.targetId)
        && isAppearanceAnimation(animation.type, animation.category)
      ) {
        firstAppearanceAnimationByElement.set(animation.targetId, animation)
      }
    })

    executedAnimations.forEach(animation => {
      if (isAppearanceAnimation(animation.type, animation.category)) {
        appearedElementIds.add(animation.targetId)
      }
    })

    firstAppearanceAnimationByElement.forEach((_, elementId) => {
      result[elementId] = appearedElementIds.has(elementId)
    })

    return result
  }, [timelineAnimations, executedAnimations])

  const elementDisplayStyles = useMemo(() => {
    const allAnimatedElementIds = new Set(timelineAnimations.map(animation => animation.targetId))
    if (allAnimatedElementIds.size === 0) return {}

    const firstAppearanceAnimationByElement = new Map<string, TimelineAnimation>()
    const latestAnimationByElement = new Map<string, TimelineAnimation>()
    const shouldInstantApply = lastStepChangeDirectionRef.current === 'backward'

    timelineAnimations.forEach(animation => {
      if (
        !firstAppearanceAnimationByElement.has(animation.targetId)
        && isAppearanceAnimation(animation.type, animation.category)
      ) {
        firstAppearanceAnimationByElement.set(animation.targetId, animation)
      }
    })
    executedAnimations.forEach(animation => {
      latestAnimationByElement.set(animation.targetId, animation)
    })

    const result: Record<string, CSSProperties> = {}
    allAnimatedElementIds.forEach(elementId => {
      const firstAppearanceAnimation = firstAppearanceAnimationByElement.get(elementId)
      const latestAnimation = latestAnimationByElement.get(elementId)
      const startHidden = Boolean(firstAppearanceAnimation)
      let opacity = startHidden ? 0 : 1
      let durationMs = 0

      if (latestAnimation) {
        durationMs = Math.max(0, latestAnimation.durationMs || DEFAULT_ELEMENT_ANIMATION_DURATION_MS)
        if (isAppearanceAnimation(latestAnimation.type, latestAnimation.category)) {
          opacity = 1
        } else if (isDisappearanceAnimation(latestAnimation.type, latestAnimation.category)) {
          opacity = 0
        } else if (isFlickerAnimation(latestAnimation.type, latestAnimation.category)) {
          opacity = 1
          durationMs = 0
        }
      }
      if (shouldInstantApply) {
        durationMs = 0
      }

      const style: CSSProperties = {
        opacity,
        transition: durationMs > 0 ? `opacity ${durationMs}ms ease` : 'none',
        willChange: 'opacity'
      }

      const triggeredAnimation = currentTriggeredAnimationByElementId.get(elementId)
      if (
        !shouldInstantApply
        && triggeredAnimation
        && isFlickerAnimation(triggeredAnimation.type, triggeredAnimation.category)
      ) {
        const flickerDurationMs = Math.max(1, triggeredAnimation.durationMs || 1000)
        style.animation = `${FLICKER_KEYFRAME_NAME} ${flickerDurationMs}ms ease-in-out 1`
        style.animationFillMode = 'forwards'
      } else if (
        !shouldInstantApply
        && triggeredAnimation
        && isAppearanceAnimation(triggeredAnimation.type, triggeredAnimation.category)
      ) {
        const fadeInDurationMs = Math.max(1, triggeredAnimation.durationMs || DEFAULT_ELEMENT_ANIMATION_DURATION_MS)
        style.animation = `${FADE_IN_KEYFRAME_NAME} ${fadeInDurationMs}ms ease 1`
        style.animationFillMode = 'forwards'
      } else if (
        !shouldInstantApply
        && triggeredAnimation
        && isDisappearanceAnimation(triggeredAnimation.type, triggeredAnimation.category)
      ) {
        const fadeOutDurationMs = Math.max(
          1,
          triggeredAnimation.durationMs || DEFAULT_ELEMENT_ANIMATION_DURATION_MS
        )
        style.animation = `${FADE_OUT_KEYFRAME_NAME} ${fadeOutDurationMs}ms ease 1`
        style.animationFillMode = 'forwards'
      }
      result[elementId] = style
    })

    return result
  }, [timelineAnimations, executedAnimations, currentTriggeredAnimationByElementId])

  const stepForwardElementAnimation = useCallback((): boolean => {
    if (!hasRemainingClickAnimations) return false
    clearPendingTimers()
    lastStepChangeDirectionRef.current = 'forward'

    const groupIndex = currentClickStep
    const groupStartIndex = clickGroupStartIndexes[groupIndex]
    const groupEndIndex = getGroupEndIndex(clickGroupStartIndexes, groupIndex, timelineAnimations.length)
    const startBatches = buildAnimationStartBatches(timelineAnimations, groupStartIndex, groupEndIndex)

    const applyBatch = (batchIndexes: number[]) => {
      setSlideExecutedCounts(previous => ({
        ...previous,
        [slide.id]: Math.max(previous[slide.id] || 0, batchIndexes[batchIndexes.length - 1] + 1)
      }))
      const animationIds = batchIndexes.map(index => timelineAnimations[index].id)
      setRecentlyTriggeredAnimationIds(previous => ({
        ...previous,
        [slide.id]: animationIds
      }))
      logElementAnimationDebug('触发动画批次', {
        slideId: slide.id,
        clickStep: groupIndex + 1,
        batchIndexes,
        animationIds
      })
    }

    startBatches.forEach(batch => {
      if (batch.atMs <= 0) {
        applyBatch(batch.indexes)
        return
      }
      const timerId = window.setTimeout(() => {
        applyBatch(batch.indexes)
      }, batch.atMs)
      timerIdsRef.current.push(timerId)
    })

    setSlideClickSteps(previous => ({
      ...previous,
      [slide.id]: currentClickStep + 1
    }))
    logElementAnimationDebug('动画点击步进已推进', {
      slideId: slide.id,
      previousStep: currentClickStep,
      nextStep: currentClickStep + 1
    })
    return true
  }, [
    slide.id,
    currentClickStep,
    clickGroupStartIndexes,
    timelineAnimations,
    hasRemainingClickAnimations,
    clearPendingTimers,
    logElementAnimationDebug
  ])

  const stepBackwardElementAnimation = useCallback((): boolean => {
    if (currentClickStep <= 0) return false
    clearPendingTimers()
    lastStepChangeDirectionRef.current = 'backward'

    const nextClickStep = Math.max(0, currentClickStep - 1)
    const nextExecutedCount = getExecutedCountForClickStep(
      nextClickStep,
      clickGroupStartIndexes,
      timelineAnimations.length
    )

    setSlideClickSteps(previous => ({
      ...previous,
      [slide.id]: nextClickStep
    }))
    setSlideExecutedCounts(previous => ({
      ...previous,
      [slide.id]: nextExecutedCount
    }))
    setRecentlyTriggeredAnimationIds(previous => ({
      ...previous,
      [slide.id]: []
    }))

    logElementAnimationDebug('动画点击步进已回退', {
      slideId: slide.id,
      previousStep: currentClickStep,
      nextStep: nextClickStep,
      nextExecutedCount
    })
    return true
  }, [slide.id, currentClickStep, clickGroupStartIndexes, timelineAnimations.length, clearPendingTimers, logElementAnimationDebug])

  useEffect(() => {
    const animationSequence = timelineAnimations.map((animation, index) => ({
      index: index + 1,
      id: animation.id,
      type: animation.type,
      category: animation.category,
      trigger: animation.normalizedTrigger,
      targetId: animation.targetId,
      durationMs: animation.durationMs,
      delayMs: animation.delayMs
    }))
    logElementAnimationDebug('当前页动画时间线', {
      slideId: slide.id,
      currentClickStep,
      currentExecutedCount,
      clickGroupCount: clickGroupStartIndexes.length,
      animationSequence
    })
  }, [
    slide.id,
    timelineAnimations,
    currentClickStep,
    currentExecutedCount,
    clickGroupStartIndexes,
    logElementAnimationDebug
  ])

  useEffect(() => {
    const styleSummary = Object.entries(elementDisplayStyles).map(([elementId, style]) => ({
      elementId,
      opacity: style.opacity,
      transition: style.transition,
      animation: style.animation
    }))
    logElementAnimationDebug('当前页元素动画样式状态', {
      slideId: slide.id,
      currentClickStep,
      currentExecutedCount,
      styleSummary
    })
  }, [slide.id, currentClickStep, currentExecutedCount, elementDisplayStyles, logElementAnimationDebug])

  const clearStepDirection = useCallback(() => {
    lastStepChangeDirectionRef.current = 'none'
  }, [])

  return {
    elementDisplayStyles,
    elementRenderStates,
    hasRemainingClickAnimations,
    currentAnimationStep: currentClickStep,
    totalClickAnimations: clickGroupStartIndexes.length,
    stepForwardElementAnimation,
    stepBackwardElementAnimation,
    clearStepDirection
  }
}
