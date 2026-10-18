import { useMemo } from 'react'
import type { CSSProperties } from 'react'
import type { TimelineAnimation } from './element-animation-timeline'
import {
  DEFAULT_ELEMENT_ANIMATION_DURATION_MS,
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
import { FADE_IN_KEYFRAME_NAME, FADE_OUT_KEYFRAME_NAME } from './element-animation-keyframes'
import { buildTranslateFadeInKeyframeName, resolveTranslateFadeInOffset, TRANSLATE_FADE_IN_OFFSET_X_VAR, TRANSLATE_FADE_IN_OFFSET_Y_VAR } from './translate-fade-animation'
import { buildTranslateInKeyframeName, resolveTranslateInOffset, TRANSLATE_IN_OFFSET_X_VAR, TRANSLATE_IN_OFFSET_Y_VAR } from './translate-animation'
import { buildBlindInKeyframeName, buildWipeInKeyframeName } from './wipe-animation'
import { resolvePresetInitialMotion, resolvePresetPlayback } from './animation-presets'
import { buildRandomizedLinesInKeyframeName, isRandomizedLinesInAnimation } from './randomized-lines-animation'

function resolveAnimationTransformOrigin(center?: { x: number; y: number }): string {
  if (!center || !Number.isFinite(center.x) || !Number.isFinite(center.y)) return 'center center'
  if (center.x >= 0 && center.x <= 1 && center.y >= 0 && center.y <= 1) {
    return `${center.x * 100}% ${center.y * 100}%`
  }
  return `${center.x}px ${center.y}px`
}

function resolveAnimationTimingFunction(acceleration = 0, deceleration = 0): string {
  const clamp = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
  const x1 = clamp(acceleration)
  const x2 = Math.max(x1, 1 - clamp(deceleration))
  if (x1 === 0 && x2 === 1) return 'ease'
  return `cubic-bezier(${x1}, 0, ${x2}, 1)`
}

interface ElementAnimationStylesParams {
  timelineAnimations: TimelineAnimation[]
  executedAnimations: TimelineAnimation[]
  currentTriggeredAnimationByElementId: Map<string, TimelineAnimation>
  stickyVisibleElementIdSet: Set<string>
  resolveTargetElementIds: (targetId: string) => string[]
  shouldInstantApply: boolean
}

export function useElementAnimationStyles({
  timelineAnimations, executedAnimations, currentTriggeredAnimationByElementId,
  stickyVisibleElementIdSet, resolveTargetElementIds, shouldInstantApply
}: ElementAnimationStylesParams): Record<string, CSSProperties> {
  return useMemo(() => {
    const allAnimatedElementIds = new Set<string>()
    const firstAppearanceAnimationByElement = new Map<string, TimelineAnimation>()
    const latestAnimationByElement = new Map<string, TimelineAnimation>()

    timelineAnimations.forEach(animation => {
      const targetIds = resolveTargetElementIds(animation.targetId)
      targetIds.forEach(id => {
        allAnimatedElementIds.add(id)
        if (
          !firstAppearanceAnimationByElement.has(id)
          && isAppearanceAnimation(animation.type, animation.category, animation.effect)
        ) {
          firstAppearanceAnimationByElement.set(id, animation)
        }
      })
    })

    if (allAnimatedElementIds.size === 0) return {}

    executedAnimations.forEach(animation => {
      const targetIds = resolveTargetElementIds(animation.targetId)
      targetIds.forEach(id => {
        latestAnimationByElement.set(id, animation)
      })
    })

    const result: Record<string, CSSProperties> = {}
    allAnimatedElementIds.forEach(elementId => {
      const firstAppearanceAnimation = firstAppearanceAnimationByElement.get(elementId)
      const latestAnimation = latestAnimationByElement.get(elementId)
      const startHidden = Boolean(firstAppearanceAnimation)
      let opacity = startHidden ? 0 : 1
      let durationMs = 0
      if (latestAnimation) {
        const rawDur = typeof latestAnimation.durationMs === 'number'
          ? latestAnimation.durationMs
          : DEFAULT_ELEMENT_ANIMATION_DURATION_MS
        durationMs = rawDur <= 10 ? 0 : rawDur
        if (isAppearanceAnimation(latestAnimation.type, latestAnimation.category, latestAnimation.effect)) {
          opacity = 1
        } else if (isDisappearanceAnimation(latestAnimation.type, latestAnimation.category, latestAnimation.effect)) {
          opacity = 0
        } else if (isFlickerAnimation(latestAnimation.type, latestAnimation.category)) {
          opacity = 1
          durationMs = 0
        }
      }
      if (
        stickyVisibleElementIdSet.has(elementId)
        && !(latestAnimation && isDisappearanceAnimation(latestAnimation.type, latestAnimation.category, latestAnimation.effect))
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
        const translateOffset = resolveTranslateInOffset(triggeredAnimation.path, translateOrientation)
        style.animation = `${translateKeyframeName} ${translateInDurationMs}ms ease-out 1`
        style.animationFillMode = 'forwards'
        if (translateOffset) {
          const translateStyle = style as CSSProperties & Record<string, string>
          translateStyle[TRANSLATE_IN_OFFSET_X_VAR] = `${translateOffset.x}px`
          translateStyle[TRANSLATE_IN_OFFSET_Y_VAR] = `${translateOffset.y}px`
        }
      } else if (
        !shouldInstantApply
        && triggeredAnimation
        && isScaleInAnimation(triggeredAnimation.type)
      ) {
        const scaleInDurationMs = Math.max(1, triggeredAnimation.durationMs || DEFAULT_ELEMENT_ANIMATION_DURATION_MS)
        const scaleInKeyframeName = buildScaleInKeyframeName()
        const scaleRange = resolveScaleInRange(triggeredAnimation)
        style.transition = 'none'
        style.transformOrigin = resolveAnimationTransformOrigin(triggeredAnimation.center)
        style.animation = `${scaleInKeyframeName} ${scaleInDurationMs}ms ease-out 1`
        style.animationFillMode = 'forwards'
        ;(style as CSSProperties & Record<string, string>)[SCALE_IN_START_X_VAR] = `${scaleRange.start.x}`
        ;(style as CSSProperties & Record<string, string>)[SCALE_IN_START_Y_VAR] = `${scaleRange.start.y}`
        ;(style as CSSProperties & Record<string, string>)[SCALE_IN_END_X_VAR] = `${scaleRange.end.x}`
        ;(style as CSSProperties & Record<string, string>)[SCALE_IN_END_Y_VAR] = `${scaleRange.end.y}`
      } else if (
        !shouldInstantApply
        && triggeredAnimation
        && isRandomizedLinesInAnimation(triggeredAnimation.type)
      ) {
        const name = buildRandomizedLinesInKeyframeName(normalizeBlindDirection(triggeredAnimation.direction))
        const duration = Math.max(1, triggeredAnimation.durationMs || DEFAULT_ELEMENT_ANIMATION_DURATION_MS)
        style.transition = 'none'
        style.animation = `${name} ${duration}ms linear 1 forwards`
      } else if (
        !shouldInstantApply
        && triggeredAnimation
        && resolvePresetPlayback(triggeredAnimation)
        && !isFadeAnimation(triggeredAnimation.type)
        && !isFlickerAnimation(triggeredAnimation.type, triggeredAnimation.category)
        && !isDiagonalWipeInAnimation(triggeredAnimation.type)
        && !isBlindInAnimation(triggeredAnimation.type)
        && !isTranslateFadeInAnimation(triggeredAnimation.type)
        && !isTranslateInAnimation(triggeredAnimation.type)
        && !isScaleInAnimation(triggeredAnimation.type)
      ) {
        const playback = resolvePresetPlayback(triggeredAnimation)
        if (playback) {
          const durationMs = Math.max(1, triggeredAnimation.durationMs || DEFAULT_ELEMENT_ANIMATION_DURATION_MS)
          const initialMotion = resolvePresetInitialMotion(triggeredAnimation)
          style.transition = 'none'
          style.animation = `${playback.name} ${durationMs}ms ease-in-out 1`
          style.animationFillMode = 'forwards'
          const presetStyle = style as CSSProperties & Record<string, string>
          presetStyle['--seewo-preset-initial-transform'] = initialMotion.transform
          presetStyle['--seewo-preset-initial-clip'] = initialMotion.clip
          presetStyle['--seewo-preset-initial-filter'] = initialMotion.filter
        }
      } else if (
        !shouldInstantApply
        && triggeredAnimation
        && isAppearanceAnimation(triggeredAnimation.type, triggeredAnimation.category, triggeredAnimation.effect)
      ) {
        const fadeInDurationMs = Math.max(1, triggeredAnimation.durationMs || DEFAULT_ELEMENT_ANIMATION_DURATION_MS)
        style.animation = `${FADE_IN_KEYFRAME_NAME} ${fadeInDurationMs}ms ease 1`
        style.animationFillMode = 'forwards'
      } else if (
        !shouldInstantApply
        && triggeredAnimation
        && isDisappearanceAnimation(triggeredAnimation.type, triggeredAnimation.category, triggeredAnimation.effect)
      ) {
        const fadeOutDurationMs = Math.max(1, triggeredAnimation.durationMs || DEFAULT_ELEMENT_ANIMATION_DURATION_MS)
        style.animation = `${FADE_OUT_KEYFRAME_NAME} ${fadeOutDurationMs}ms ease 1`
        style.animationFillMode = 'forwards'
      }
      if (triggeredAnimation && style.animation) {
        const repeatCount = Number.isFinite(triggeredAnimation.repeatCount) && (triggeredAnimation.repeatCount || 0) > 0
          ? Math.max(1, triggeredAnimation.repeatCount || 1)
          : triggeredAnimation.frequency && triggeredAnimation.frequency > 0
            ? Math.max(1, triggeredAnimation.frequency)
            : 1
        style.animationIterationCount = String(Math.min(repeatCount, 100))
        style.animationTimingFunction = resolveAnimationTimingFunction(
          triggeredAnimation.accelerationRatio,
          triggeredAnimation.decelerationRatio
        )
        if (triggeredAnimation.center && !style.transformOrigin) {
          style.transformOrigin = resolveAnimationTransformOrigin(triggeredAnimation.center)
        }
      }
      result[elementId] = style
    })
    return result
  }, [timelineAnimations, executedAnimations, currentTriggeredAnimationByElementId, stickyVisibleElementIdSet, resolveTargetElementIds, shouldInstantApply])
}
