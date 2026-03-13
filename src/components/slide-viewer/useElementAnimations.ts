import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { SlideData } from '../../parser'
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

export function useElementAnimations({ slide }: UseElementAnimationsParams) {
  const [slideAnimationSteps, setSlideAnimationSteps] = useState<Record<string, number>>({})
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

  const resolvedClickAnimations = useMemo(() => {
    return slide.animations
      .filter(
        animation =>
          animation.trigger.toLowerCase() === 'click'
          && (isFadeAnimation(animation.type) || isFlickerAnimation(animation.type, animation.category))
      )
      .map(animation => {
        const targetId = elementIdSet.has(animation.targetId)
          ? animation.targetId
          : elementIdSet.has(animation.sourceElementId)
            ? animation.sourceElementId
            : animation.targetId
        return {
          ...animation,
          targetId
        }
      })
  }, [slide.animations, elementIdSet])

  const currentClickAnimations = useMemo(() => resolvedClickAnimations, [resolvedClickAnimations])
  const currentAnimationStep = slideAnimationSteps[slide.id] || 0
  const hasRemainingClickAnimations = currentAnimationStep < currentClickAnimations.length

  const elementRenderStates = useMemo(() => {
    const result: Record<string, boolean> = {}
    if (resolvedClickAnimations.length === 0) return result

    const firstAppearanceAnimationByElement = new Map<string, SlideData['animations'][number]>()
    const appearedElementIds = new Set<string>()
    const executedAnimations = currentClickAnimations.slice(0, currentAnimationStep)

    currentClickAnimations.forEach(animation => {
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

    firstAppearanceAnimationByElement.forEach((animation, elementId) => {
      if (animation.trigger.toLowerCase() !== 'click') return
      result[elementId] = appearedElementIds.has(elementId)
    })

    return result
  }, [resolvedClickAnimations, currentClickAnimations, currentAnimationStep])

  const elementDisplayStyles = useMemo(() => {
    const allAnimatedElementIds = new Set(
      resolvedClickAnimations
        .map(animation => animation.targetId)
    )
    if (allAnimatedElementIds.size === 0) return {}

    const firstAppearanceAnimationByElement = new Map<string, SlideData['animations'][number]>()
    const executedAnimations = currentClickAnimations.slice(0, currentAnimationStep)
    const latestAnimationByElement = new Map<string, SlideData['animations'][number]>()
    const shouldInstantApply = lastStepChangeDirectionRef.current === 'backward'
    const triggeredAnimation =
      lastStepChangeDirectionRef.current === 'forward'
      && currentAnimationStep > 0
        ? currentClickAnimations[currentAnimationStep - 1]
        : null

    currentClickAnimations.forEach(animation => {
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
    const activeFlickerAnimation = executedAnimations[executedAnimations.length - 1]

    const result: Record<string, CSSProperties> = {}
    allAnimatedElementIds.forEach(elementId => {
      const firstAppearanceAnimation = firstAppearanceAnimationByElement.get(elementId)
      const latestAnimation = latestAnimationByElement.get(elementId)
      const startHidden = Boolean(
        firstAppearanceAnimation
        && firstAppearanceAnimation.trigger.toLowerCase() === 'click'
      )
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
      if (
        !shouldInstantApply
        && activeFlickerAnimation
        && activeFlickerAnimation.targetId === elementId
        && isFlickerAnimation(activeFlickerAnimation.type, activeFlickerAnimation.category)
      ) {
        const flickerDurationMs = Math.max(1, activeFlickerAnimation.durationMs || 1000)
        style.animation = `${FLICKER_KEYFRAME_NAME} ${flickerDurationMs}ms ease-in-out 1`
        style.animationFillMode = 'forwards'
      } else if (
        !shouldInstantApply
        &&
        triggeredAnimation
        && triggeredAnimation.targetId === elementId
        && isAppearanceAnimation(triggeredAnimation.type, triggeredAnimation.category)
      ) {
        const fadeInDurationMs = Math.max(1, triggeredAnimation.durationMs || DEFAULT_ELEMENT_ANIMATION_DURATION_MS)
        style.animation = `${FADE_IN_KEYFRAME_NAME} ${fadeInDurationMs}ms ease 1`
        style.animationFillMode = 'forwards'
      } else if (
        !shouldInstantApply
        &&
        triggeredAnimation
        && triggeredAnimation.targetId === elementId
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
  }, [resolvedClickAnimations, currentClickAnimations, currentAnimationStep])

  const stepForwardElementAnimation = useCallback((): boolean => {
    if (!hasRemainingClickAnimations) return false
    lastStepChangeDirectionRef.current = 'forward'

    const baseOpacityByElement = new Map<string, number>()
    currentClickAnimations.forEach(animation => {
      if (!baseOpacityByElement.has(animation.targetId)) {
        baseOpacityByElement.set(
          animation.targetId,
          isAppearanceAnimation(animation.type, animation.category) ? 0 : 1
        )
      }
    })

    const runAnimation = (animation: SlideData['animations'][number], opacityByElement: Map<string, number>) => {
      const before = opacityByElement.get(animation.targetId) ?? 1
      let after = before
      if (isAppearanceAnimation(animation.type, animation.category)) {
        after = 1
      } else if (isDisappearanceAnimation(animation.type, animation.category)) {
        after = 0
      } else if (isFlickerAnimation(animation.type, animation.category)) {
        opacityByElement.set(animation.targetId, 1)
        return true
      }
      opacityByElement.set(animation.targetId, after)
      return before !== after
    }

    const opacityByElement = new Map(baseOpacityByElement)
    currentClickAnimations.slice(0, currentAnimationStep).forEach(animation => {
      runAnimation(animation, opacityByElement)
    })

    let nextStep = currentAnimationStep
    while (nextStep < currentClickAnimations.length) {
      const hasVisualChange = runAnimation(currentClickAnimations[nextStep], opacityByElement)
      logElementAnimationDebug('尝试推进动画步骤', {
        slideId: slide.id,
        fromStep: nextStep,
        animationId: currentClickAnimations[nextStep].id,
        type: currentClickAnimations[nextStep].type,
        category: currentClickAnimations[nextStep].category,
        targetId: currentClickAnimations[nextStep].targetId,
        hasVisualChange
      })
      nextStep += 1
      if (hasVisualChange) break
    }

    setSlideAnimationSteps(previous => ({
      ...previous,
      [slide.id]: Math.min(currentClickAnimations.length, nextStep)
    }))
    logElementAnimationDebug('动画步骤已推进', {
      slideId: slide.id,
      previousStep: currentAnimationStep,
      nextStep
    })
    return true
  }, [slide.id, currentClickAnimations, currentAnimationStep, hasRemainingClickAnimations, logElementAnimationDebug])

  const stepBackwardElementAnimation = useCallback((): boolean => {
    if (currentAnimationStep <= 0) return false
    lastStepChangeDirectionRef.current = 'backward'
    setSlideAnimationSteps(previous => ({
      ...previous,
      [slide.id]: Math.max(0, (previous[slide.id] || 0) - 1)
    }))
    logElementAnimationDebug('动画步骤已回退', {
      slideId: slide.id,
      previousStep: currentAnimationStep,
      nextStep: Math.max(0, currentAnimationStep - 1)
    })
    return true
  }, [slide.id, currentAnimationStep, logElementAnimationDebug])

  useEffect(() => {
    const animationSequence = currentClickAnimations.map((animation, index) => ({
      index: index + 1,
      id: animation.id,
      type: animation.type,
      category: animation.category,
      targetId: animation.targetId,
      durationMs: animation.durationMs
    }))
    logElementAnimationDebug('当前页动画序列', {
      slideId: slide.id,
      currentAnimationStep,
      total: currentClickAnimations.length,
      animationSequence
    })
  }, [slide.id, currentClickAnimations, currentAnimationStep, logElementAnimationDebug])

  useEffect(() => {
    const styleSummary = Object.entries(elementDisplayStyles).map(([elementId, style]) => ({
      elementId,
      opacity: style.opacity,
      transition: style.transition,
      animation: style.animation
    }))
    logElementAnimationDebug('当前页元素动画样式状态', {
      slideId: slide.id,
      currentAnimationStep,
      styleSummary
    })
  }, [slide.id, currentAnimationStep, elementDisplayStyles, logElementAnimationDebug])

  const clearStepDirection = useCallback(() => {
    lastStepChangeDirectionRef.current = 'none'
  }, [])

  return {
    elementDisplayStyles,
    elementRenderStates,
    hasRemainingClickAnimations,
    currentAnimationStep,
    totalClickAnimations: currentClickAnimations.length,
    stepForwardElementAnimation,
    stepBackwardElementAnimation,
    clearStepDirection
  }
}
