import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { SlideData } from '../../parser'
import {
  buildAnimationStartBatches,
  getExecutedCountForClickStep,
  resolveClickAnimationGroups,
  resolveTimelineAnimations,
  type TimelineAnimation
} from './element-animation-timeline'
import {
  DEFAULT_ELEMENT_ANIMATION_DURATION_MS,
  ENABLE_ELEMENT_ANIMATION_DEBUG_LOG,
  FLICKER_KEYFRAME_NAME,
  isAppearanceAnimation,
  isBlindInAnimation,
  isDiagonalWipeInAnimation,
  isDisappearanceAnimation,
  isFadeAnimation,
  isFlickerAnimation,
  isScaleInAnimation,
  isTranslateFadeInAnimation,
  isTranslateInAnimation,
  normalizeBlindDirection,
  normalizeWipeOrientation
} from './constants'
import {
  buildScaleInKeyframeName,
  resolveScaleInRange,
  SCALE_IN_END_X_VAR,
  SCALE_IN_END_Y_VAR,
  SCALE_IN_START_X_VAR,
  SCALE_IN_START_Y_VAR
} from './scale-animation'
import { FADE_IN_KEYFRAME_NAME, FADE_OUT_KEYFRAME_NAME, ensureElementAnimationKeyframes } from './element-animation-keyframes'
import { buildTranslateFadeInKeyframeName, resolveTranslateFadeInOffset, TRANSLATE_FADE_IN_OFFSET_X_VAR, TRANSLATE_FADE_IN_OFFSET_Y_VAR } from './translate-fade-animation'
import { buildTranslateInKeyframeName } from './translate-animation'
import { buildBlindInKeyframeName, buildWipeInKeyframeName } from './wipe-animation'
interface UseElementAnimationsParams { slide: SlideData }
interface PlayClickAnimationGroupOptions {
  advanceStep?: boolean
}

function areSameStringArray(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false
  }
  return true
}

function isConsumableAnimation(animation: SlideData['animations'][number]): boolean {
  return isFadeAnimation(animation.type)
    || isFlickerAnimation(animation.type, animation.category)
    || isDiagonalWipeInAnimation(animation.type)
    || isBlindInAnimation(animation.type)
    || isTranslateFadeInAnimation(animation.type)
    || isTranslateInAnimation(animation.type)
    || isScaleInAnimation(animation.type)
}
export function useElementAnimations({ slide }: UseElementAnimationsParams) {
  const [slideClickSteps, setSlideClickSteps] = useState<Record<string, number>>({})
  const [slideExecutedCounts, setSlideExecutedCounts] = useState<Record<string, number>>({})
  const [slideSkippedGroupIndexes, setSlideSkippedGroupIndexes] = useState<Record<string, number[]>>({})
  const [slideStickyVisibleElementIds, setSlideStickyVisibleElementIds] = useState<Record<string, string[]>>({})
  const [recentlyTriggeredAnimationIds, setRecentlyTriggeredAnimationIds] = useState<Record<string, string[]>>({})
  const autoStartedSlideIdsRef = useRef(new Set<string>())
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
    ensureElementAnimationKeyframes()
  }, [])
  useEffect(() => () => clearPendingTimers(), [clearPendingTimers])
  useEffect(() => { clearPendingTimers() }, [slide.id, clearPendingTimers])
  useEffect(() => {
    setRecentlyTriggeredAnimationIds(previous => ({
      ...previous,
      [slide.id]: []
    }))
  }, [slide.id])
  const timelineAnimations = useMemo(() => {
    return resolveTimelineAnimations(slide.animations, elementIdSet, isConsumableAnimation)
  }, [slide.animations, elementIdSet])
  const clickAnimationGroups = useMemo(() => resolveClickAnimationGroups(timelineAnimations), [timelineAnimations])
  const currentClickStep = slideClickSteps[slide.id] || 0
  const currentExecutedCount = slideExecutedCounts[slide.id] || 0
  const skippedGroupIndexSet = new Set(slideSkippedGroupIndexes[slide.id] || [])
  const stickyVisibleElementIdSet = new Set(slideStickyVisibleElementIds[slide.id] || [])
  const hasRemainingClickAnimations = currentClickStep < clickAnimationGroups.length
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
    if (currentExecutedCount <= 0) return []
    if (skippedGroupIndexSet.size === 0) {
      return timelineAnimations.slice(0, currentExecutedCount)
    }
    const skippedAnimationIndexes = new Set<number>()
    skippedGroupIndexSet.forEach(groupIndex => {
      const group = clickAnimationGroups[groupIndex]
      if (!group) return
      for (let index = group.startIndex; index <= group.endIndex; index += 1) {
        skippedAnimationIndexes.add(index)
      }
    })
    return timelineAnimations
      .slice(0, currentExecutedCount)
      .filter((_, index) => !skippedAnimationIndexes.has(index))
  }, [timelineAnimations, currentExecutedCount, skippedGroupIndexSet, clickAnimationGroups])
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
      result[elementId] = appearedElementIds.has(elementId) || stickyVisibleElementIdSet.has(elementId)
    })
    return result
  }, [timelineAnimations, executedAnimations, stickyVisibleElementIdSet])
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
      if (
        stickyVisibleElementIdSet.has(elementId)
        && !(latestAnimation && isDisappearanceAnimation(latestAnimation.type, latestAnimation.category))
      ) {
        opacity = 1
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
        && isDiagonalWipeInAnimation(triggeredAnimation.type)
      ) {
        const wipeInDurationMs = Math.max(1, triggeredAnimation.durationMs || DEFAULT_ELEMENT_ANIMATION_DURATION_MS)
        const wipeOrientation = normalizeWipeOrientation(triggeredAnimation.orientation)
        const wipeKeyframeName = buildWipeInKeyframeName(wipeOrientation)
        style.animation = `${wipeKeyframeName} ${wipeInDurationMs}ms linear 1`
        style.animationFillMode = 'forwards'
      } else if (
        !shouldInstantApply
        && triggeredAnimation
        && isBlindInAnimation(triggeredAnimation.type)
      ) {
        const blindInDurationMs = Math.max(1, triggeredAnimation.durationMs || DEFAULT_ELEMENT_ANIMATION_DURATION_MS)
        const blindDirection = normalizeBlindDirection(triggeredAnimation.direction)
        const blindKeyframeName = buildBlindInKeyframeName(blindDirection)
        style.transition = 'none'
        style.animation = `${blindKeyframeName} ${blindInDurationMs}ms linear 1`
        style.animationFillMode = 'forwards'
      } else if (
        !shouldInstantApply
        && triggeredAnimation
        && isTranslateFadeInAnimation(triggeredAnimation.type)
      ) {
        const translateFadeInDurationMs = Math.max(1, triggeredAnimation.durationMs || DEFAULT_ELEMENT_ANIMATION_DURATION_MS)
        const translateFadeOrientation = normalizeWipeOrientation(triggeredAnimation.orientation)
        const translateFadeOffset = resolveTranslateFadeInOffset(triggeredAnimation.path, translateFadeOrientation)
        const translateFadeKeyframeName = buildTranslateFadeInKeyframeName()
        style.transition = 'none'
        style.animation = `${translateFadeKeyframeName} ${translateFadeInDurationMs}ms ease-out 1`
        style.animationFillMode = 'forwards'
        ;(style as CSSProperties & Record<string, string>)[TRANSLATE_FADE_IN_OFFSET_X_VAR] = `${translateFadeOffset.x}px`
        ;(style as CSSProperties & Record<string, string>)[TRANSLATE_FADE_IN_OFFSET_Y_VAR] = `${translateFadeOffset.y}px`
      } else if (
        !shouldInstantApply
        && triggeredAnimation
        && isTranslateInAnimation(triggeredAnimation.type)
      ) {
        const translateInDurationMs = Math.max(1, triggeredAnimation.durationMs || DEFAULT_ELEMENT_ANIMATION_DURATION_MS)
        const translateOrientation = normalizeWipeOrientation(triggeredAnimation.orientation)
        const translateKeyframeName = buildTranslateInKeyframeName(translateOrientation)
        style.animation = `${translateKeyframeName} ${translateInDurationMs}ms ease-out 1`
        style.animationFillMode = 'forwards'
      } else if (
        !shouldInstantApply
        && triggeredAnimation
        && isScaleInAnimation(triggeredAnimation.type)
      ) {
        const scaleInDurationMs = Math.max(1, triggeredAnimation.durationMs || DEFAULT_ELEMENT_ANIMATION_DURATION_MS)
        const scaleInKeyframeName = buildScaleInKeyframeName()
        const scaleRange = resolveScaleInRange(triggeredAnimation)
        style.transition = 'none'
        style.transformOrigin = 'center center'
        style.animation = `${scaleInKeyframeName} ${scaleInDurationMs}ms ease-out 1`
        style.animationFillMode = 'forwards'
        ;(style as CSSProperties & Record<string, string>)[SCALE_IN_START_X_VAR] = `${scaleRange.start.x}`
        ;(style as CSSProperties & Record<string, string>)[SCALE_IN_START_Y_VAR] = `${scaleRange.start.y}`
        ;(style as CSSProperties & Record<string, string>)[SCALE_IN_END_X_VAR] = `${scaleRange.end.x}`
        ;(style as CSSProperties & Record<string, string>)[SCALE_IN_END_Y_VAR] = `${scaleRange.end.y}`
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
        const fadeOutDurationMs = Math.max(1, triggeredAnimation.durationMs || DEFAULT_ELEMENT_ANIMATION_DURATION_MS)
        style.animation = `${FADE_OUT_KEYFRAME_NAME} ${fadeOutDurationMs}ms ease 1`
        style.animationFillMode = 'forwards'
      }
      result[elementId] = style
    })
    return result
  }, [timelineAnimations, executedAnimations, currentTriggeredAnimationByElementId, stickyVisibleElementIdSet])
  const playClickAnimationGroup = useCallback((groupIndex: number, options: PlayClickAnimationGroupOptions = {}) => {
    const shouldAdvanceStep = options.advanceStep !== false
    const group = clickAnimationGroups[groupIndex]
    if (!group) return false
    clearPendingTimers()
    lastStepChangeDirectionRef.current = 'forward'
    const startBatches = buildAnimationStartBatches(timelineAnimations, group)
    const applyBatch = (batchIndexes: number[]) => {
      setSlideExecutedCounts(previous => ({
        ...previous,
        [slide.id]: Math.max(previous[slide.id] || 0, batchIndexes[batchIndexes.length - 1] + 1)
      }))
      if (group.triggerSource) {
        const appearedElementIds = batchIndexes
          .map(index => timelineAnimations[index])
          .filter(animation => isAppearanceAnimation(animation.type, animation.category))
          .map(animation => animation.targetId)
        if (appearedElementIds.length > 0) {
          setSlideStickyVisibleElementIds(previous => ({
            ...previous,
            [slide.id]: Array.from(new Set([...(previous[slide.id] || []), ...appearedElementIds]))
          }))
        }
      }
      const animationIds = batchIndexes.map(index => timelineAnimations[index].id)
      setRecentlyTriggeredAnimationIds(previous => ({
        ...previous,
        [slide.id]: animationIds
      }))
      const clearDelayMs = batchIndexes.reduce((maxDurationMs, index) => {
        const durationMs = Math.max(0, timelineAnimations[index].durationMs || DEFAULT_ELEMENT_ANIMATION_DURATION_MS)
        return Math.max(maxDurationMs, durationMs)
      }, 0)
      const clearTimerId = window.setTimeout(() => {
        setRecentlyTriggeredAnimationIds(previous => {
          const currentIds = previous[slide.id] || []
          if (!areSameStringArray(currentIds, animationIds)) {
            return previous
          }
          return {
            ...previous,
            [slide.id]: []
          }
        })
      }, clearDelayMs + 34)
      timerIdsRef.current.push(clearTimerId)
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
    if (shouldAdvanceStep) {
      setSlideClickSteps(previous => ({
        ...previous,
        [slide.id]: groupIndex + 1
      }))
    }
    logElementAnimationDebug('动画点击步进已推进', {
      slideId: slide.id,
      previousStep: groupIndex,
      nextStep: groupIndex + 1,
      triggerSource: group.triggerSource,
      advanceStep: shouldAdvanceStep
    })
    return true
  }, [slide.id, clickAnimationGroups, timelineAnimations, clearPendingTimers, logElementAnimationDebug])
  useEffect(() => {
    const firstGroup = clickAnimationGroups[0]
    const firstAnimation = firstGroup ? timelineAnimations[firstGroup.startIndex] : null
    if (currentClickStep !== 0 || !firstGroup || !firstAnimation) return
    if (firstAnimation.normalizedTrigger === 'click' || firstGroup.triggerSource) return
    if (autoStartedSlideIdsRef.current.has(slide.id)) return
    autoStartedSlideIdsRef.current.add(slide.id)
    playClickAnimationGroup(0)
  }, [slide.id, currentClickStep, clickAnimationGroups, timelineAnimations, playClickAnimationGroup])
  const stepForwardElementAnimation = useCallback((): boolean => {
    if (!hasRemainingClickAnimations) return false
    let nextPlayableGroupIndex = currentClickStep
    const skippedGroupIndexes: number[] = []
    while (nextPlayableGroupIndex < clickAnimationGroups.length) {
      const group = clickAnimationGroups[nextPlayableGroupIndex]
      if (!group) return false
      if (!group.triggerSource) {
        if (skippedGroupIndexes.length > 0) {
          setSlideSkippedGroupIndexes(previous => {
            const previousIndexes = previous[slide.id] || []
            return {
              ...previous,
              [slide.id]: Array.from(new Set([...previousIndexes, ...skippedGroupIndexes]))
            }
          })
        }
        if (nextPlayableGroupIndex !== currentClickStep) {
          logElementAnimationDebug('普通点击跳过中间源触发动画分组，继续后续点击分组', {
            slideId: slide.id,
            currentClickStep,
            nextPlayableGroupIndex,
            skippedGroupIndexes
          })
        }
        return playClickAnimationGroup(nextPlayableGroupIndex, { advanceStep: true })
      }
      skippedGroupIndexes.push(nextPlayableGroupIndex)
      nextPlayableGroupIndex += 1
    }
    logElementAnimationDebug('剩余分组均为源触发动画，普通点击不再消费动画', {
      slideId: slide.id,
      currentClickStep
    })
    return false
  }, [
    currentClickStep,
    clickAnimationGroups,
    hasRemainingClickAnimations,
    playClickAnimationGroup,
    logElementAnimationDebug,
    slide.id
  ])
  const triggerElementSourceAnimation = useCallback((sourceElementId: string): boolean => {
    if (!sourceElementId) return false
    let targetGroupIndex = -1
    for (let index = 0; index < clickAnimationGroups.length; index += 1) {
      const group = clickAnimationGroups[index]
      if (!group?.triggerSource || group.triggerSource !== sourceElementId) continue
      const isSkipped = skippedGroupIndexSet.has(index)
      const isAlreadyExecuted = index < currentClickStep && !isSkipped
      if (isAlreadyExecuted) continue
      targetGroupIndex = index
      break
    }
    if (targetGroupIndex < 0) return false
    const shouldAdvanceStep = targetGroupIndex >= currentClickStep
    if (skippedGroupIndexSet.has(targetGroupIndex)) {
      setSlideSkippedGroupIndexes(previous => ({
        ...previous,
        [slide.id]: (previous[slide.id] || []).filter(groupIndex => groupIndex !== targetGroupIndex)
      }))
    }
    logElementAnimationDebug('源触发动画命中', {
      slideId: slide.id,
      sourceElementId,
      targetGroupIndex,
      currentClickStep,
      shouldAdvanceStep
    })
    return playClickAnimationGroup(targetGroupIndex, { advanceStep: shouldAdvanceStep })
  }, [clickAnimationGroups, skippedGroupIndexSet, currentClickStep, playClickAnimationGroup, logElementAnimationDebug, slide.id])
  const stepBackwardElementAnimation = useCallback((): boolean => {
    if (currentClickStep <= 0) return false
    clearPendingTimers()
    lastStepChangeDirectionRef.current = 'backward'
    const nextClickStep = Math.max(0, currentClickStep - 1)
    const nextExecutedCount = getExecutedCountForClickStep(
      nextClickStep,
      clickAnimationGroups,
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
    setSlideSkippedGroupIndexes(previous => ({
      ...previous,
      [slide.id]: (previous[slide.id] || []).filter(groupIndex => groupIndex < nextClickStep)
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
  }, [slide.id, currentClickStep, clickAnimationGroups, timelineAnimations.length, clearPendingTimers, logElementAnimationDebug])
  const clearStepDirection = useCallback(() => {
    lastStepChangeDirectionRef.current = 'none'
  }, [])
  return {
    elementDisplayStyles,
    elementRenderStates,
    hasRemainingClickAnimations,
    currentAnimationStep: currentClickStep,
    totalClickAnimations: clickAnimationGroups.length,
    stepForwardElementAnimation,
    triggerElementSourceAnimation,
    stepBackwardElementAnimation,
    clearStepDirection
  }
}
