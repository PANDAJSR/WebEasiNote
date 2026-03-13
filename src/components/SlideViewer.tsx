import { useState, useEffect, useRef, useCallback, useLayoutEffect, useMemo } from 'react'
import type { CSSProperties } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons'
import { styles } from '../styles'
import { SlideRenderer } from './SlideRenderer'
import type { SlideData } from '../parser'
import type { SlideChangeSource } from './Viewer'
import type { PagerPosition } from '../viewer-settings'

interface SlideViewerProps {
  slide: SlideData
  slides: SlideData[]
  currentIndex: number
  onSlideChange: (index: number, source?: SlideChangeSource) => void
  slideChangeSource: SlideChangeSource
  resourceMap?: Record<string, string>
  clickToNextEnabled: boolean
  pagerPosition: PagerPosition
}

interface SlideThumbnailProps {
  slide: SlideData
  index: number
  isActive: boolean
  resourceMap: Record<string, string>
  onSlideChange: (index: number, source?: SlideChangeSource) => void
}

const thumbnailWidth = 96
const thumbnailHeight = 56
const slideInfoBarHeight = 40
const FADE_TRANSITION_KEY = 'Fade'
const SLIDE_TO_LEFT_TRANSITION_KEY = 'SlideToLeft'
const SLIDE_TO_RIGHT_TRANSITION_KEY = 'SlideToRight'
const SLIDE_TO_TOP_TRANSITION_KEY = 'SlideToTop'
const SLIDE_TO_BOTTOM_TRANSITION_KEY = 'SlideToBottom'
const CIRCLE_IN_TRANSITION_KEY = 'CircleIn'
const LINE_REVEAL_TRANSITION_KEY = 'LineReveal'
const DEFAULT_FADE_DURATION_MS = 300
const MAX_FADE_DURATION_MS = 8000
const DEFAULT_TRANSFORM = 'translate3d(0%, 0%, 0px)'
const CIRCLE_IN_START_CLIP_PATH = 'circle(150% at 50% 50%)'
const CIRCLE_IN_END_CLIP_PATH = 'circle(0% at 50% 50%)'
const ENABLE_TRANSITION_DEBUG_LOG = false
const ENABLE_ELEMENT_ANIMATION_DEBUG_LOG = true
const DEFAULT_ELEMENT_ANIMATION_DURATION_MS = 300
const FLICKER_KEYFRAME_ID = 'seewo-element-flicker-keyframes'
const FLICKER_KEYFRAME_NAME = 'seewo-element-flicker'

type LayerSnapshot = {
  opacity: number
  transform: string
}

interface TransitionState {
  id: number
  enteringIndex: number
  leavingIndex: number
  key: string
  durationMs: number
  isReverseBackTransition: boolean
  phase: 'prepare' | 'running'
}

function isAppearanceAnimation(type: string, category: string): boolean {
  const normalizedType = type.trim().toLowerCase()
  const normalizedCategory = category.trim().toLowerCase()
  return normalizedCategory === 'appearance'
    || normalizedType === 'fadein'
}

function isDisappearanceAnimation(type: string, category: string): boolean {
  const normalizedType = type.trim().toLowerCase()
  const normalizedCategory = category.trim().toLowerCase()
  return normalizedCategory === 'disappearance'
    || normalizedType === 'fadeout'
}

function isFadeAnimation(type: string): boolean {
  const normalizedType = type.trim().toLowerCase()
  return normalizedType === 'fadein' || normalizedType === 'fadeout'
}

function isFlickerAnimation(type: string, category: string): boolean {
  const normalizedType = type.trim().toLowerCase()
  const normalizedCategory = category.trim().toLowerCase()
  return normalizedType === 'flicker' || normalizedCategory === 'emphasis'
}

function normalizeTransitionKey(transitionKey: string): string {
  return transitionKey.trim()
}

function resolveEnteringStartTransform(transitionKey: string, isReverseBackTransition: boolean): string {
  const normalizedTransitionKey = normalizeTransitionKey(transitionKey)
  if (normalizedTransitionKey === SLIDE_TO_LEFT_TRANSITION_KEY) {
    return isReverseBackTransition ? 'translate3d(-100%, 0%, 0px)' : 'translate3d(100%, 0%, 0px)'
  }
  if (normalizedTransitionKey === SLIDE_TO_RIGHT_TRANSITION_KEY) {
    return isReverseBackTransition ? 'translate3d(100%, 0%, 0px)' : 'translate3d(-100%, 0%, 0px)'
  }
  if (normalizedTransitionKey === SLIDE_TO_TOP_TRANSITION_KEY) {
    return isReverseBackTransition ? 'translate3d(0%, -100%, 0px)' : 'translate3d(0%, 100%, 0px)'
  }
  if (normalizedTransitionKey === SLIDE_TO_BOTTOM_TRANSITION_KEY) {
    return isReverseBackTransition ? 'translate3d(0%, 100%, 0px)' : 'translate3d(0%, -100%, 0px)'
  }
  return DEFAULT_TRANSFORM
}

function resolveLeavingTargetTransform(transitionKey: string, isReverseBackTransition: boolean): string {
  const normalizedTransitionKey = normalizeTransitionKey(transitionKey)
  if (normalizedTransitionKey === SLIDE_TO_LEFT_TRANSITION_KEY) {
    return isReverseBackTransition ? 'translate3d(100%, 0%, 0px)' : 'translate3d(-100%, 0%, 0px)'
  }
  if (normalizedTransitionKey === SLIDE_TO_RIGHT_TRANSITION_KEY) {
    return isReverseBackTransition ? 'translate3d(-100%, 0%, 0px)' : 'translate3d(100%, 0%, 0px)'
  }
  if (normalizedTransitionKey === SLIDE_TO_TOP_TRANSITION_KEY) {
    return isReverseBackTransition ? 'translate3d(0%, 100%, 0px)' : 'translate3d(0%, -100%, 0px)'
  }
  if (normalizedTransitionKey === SLIDE_TO_BOTTOM_TRANSITION_KEY) {
    return isReverseBackTransition ? 'translate3d(0%, -100%, 0px)' : 'translate3d(0%, 100%, 0px)'
  }
  return DEFAULT_TRANSFORM
}

function isDirectionalSlideTransition(transitionKey: string): boolean {
  const normalizedTransitionKey = normalizeTransitionKey(transitionKey)
  return normalizedTransitionKey === SLIDE_TO_LEFT_TRANSITION_KEY
    || normalizedTransitionKey === SLIDE_TO_RIGHT_TRANSITION_KEY
    || normalizedTransitionKey === SLIDE_TO_TOP_TRANSITION_KEY
    || normalizedTransitionKey === SLIDE_TO_BOTTOM_TRANSITION_KEY
}

function isCircleInTransition(transitionKey: string): boolean {
  return normalizeTransitionKey(transitionKey) === CIRCLE_IN_TRANSITION_KEY
}

function isLineRevealTransition(transitionKey: string): boolean {
  return normalizeTransitionKey(transitionKey) === LINE_REVEAL_TRANSITION_KEY
}

function formatPercent(value: number): string {
  return `${Math.round(value * 1000) / 1000}%`
}

function buildPolygonClipPath(points: Array<{ x: number; y: number }>): string {
  if (points.length < 3) return 'polygon(0% 0%, 0% 0%, 0% 0%, 0% 0%, 0% 0%, 0% 0%)'

  // clip-path 动画要求前后顶点数量一致，否则会退化成离散切换
  const normalizedPoints = [...points]
  const lastPoint = normalizedPoints[normalizedPoints.length - 1]
  while (normalizedPoints.length < 6) {
    normalizedPoints.push(lastPoint)
  }

  const pointString = normalizedPoints
    .map(point => `${formatPercent(point.x)} ${formatPercent(point.y)}`)
    .join(', ')
  return `polygon(${pointString})`
}

function buildLineRevealClipPath(progress: number, isReverseDirection: boolean): string {
  const clampedProgress = Math.max(0, Math.min(progress, 1))
  const threshold = isReverseDirection
    ? 200 * (1 - clampedProgress)
    : 200 * clampedProgress

  // 正向：保留 x+y>=threshold 的区域（从左上往右下消失）
  // 反向：保留 x+y<=threshold 的区域（反向播放）
  if (!isReverseDirection) {
    if (threshold <= 0) {
      return buildPolygonClipPath([
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 }
      ])
    }
    if (threshold < 100) {
      return buildPolygonClipPath([
        { x: threshold, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
        { x: 0, y: threshold }
      ])
    }
    if (threshold < 200) {
      return buildPolygonClipPath([
        { x: 100, y: threshold - 100 },
        { x: 100, y: 100 },
        { x: threshold - 100, y: 100 }
      ])
    }
    return buildPolygonClipPath([{ x: 100, y: 100 }, { x: 100, y: 100 }, { x: 100, y: 100 }])
  }

  if (threshold >= 200) {
    return buildPolygonClipPath([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 }
    ])
  }
  if (threshold > 100) {
    return buildPolygonClipPath([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: threshold - 100 },
      { x: threshold - 100, y: 100 },
      { x: 0, y: 100 }
    ])
  }
  if (threshold > 0) {
    return buildPolygonClipPath([
      { x: 0, y: 0 },
      { x: threshold, y: 0 },
      { x: 0, y: threshold }
    ])
  }
  return buildPolygonClipPath([{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }])
}

function SlideThumbnail({
  slide,
  index,
  isActive,
  resourceMap,
  onSlideChange
}: SlideThumbnailProps) {
  const previewScale = Math.min(thumbnailWidth / slide.width, thumbnailHeight / slide.height, 1)

  return (
    <button
      onClick={() => onSlideChange(index, 'thumbnail')}
      style={{
        ...styles.slideTab,
        ...(isActive ? styles.slideTabActive : {})
      }}
    >
      <span style={styles.slideTabNumber}>{index + 1}</span>
      <div style={styles.slideTabPreviewViewport}>
        <div style={styles.slideTabPreviewContent}>
          <SlideRenderer
            slide={slide}
            scale={previewScale}
            resourceMap={resourceMap}
            slideIndex={index}
            currentIndex={-1}
          />
        </div>
      </div>
    </button>
  )
}

export function SlideViewer({
  slide,
  slides,
  currentIndex,
  onSlideChange,
  slideChangeSource,
  resourceMap = {},
  clickToNextEnabled,
  pagerPosition
}: SlideViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [slideScaleMap, setSlideScaleMap] = useState<Record<string, number>>({})
  const [isSlidePanelOpen, setSlidePanelOpen] = useState(false)
  const previousIndexRef = useRef(currentIndex)
  const [transitionState, setTransitionState] = useState<TransitionState | null>(null)
  const [layerSnapshots, setLayerSnapshots] = useState<Record<number, LayerSnapshot>>({})
  const [lineRevealProgress, setLineRevealProgress] = useState(0)
  const [slideAnimationSteps, setSlideAnimationSteps] = useState<Record<string, number>>({})
  const leaveAnimationTimerRef = useRef<number | null>(null)
  const transitionRafRef = useRef<number | null>(null)
  const lineRevealRafRef = useRef<number | null>(null)
  const transitionIdRef = useRef(0)
  const layerRefs = useRef<Record<number, HTMLDivElement | null>>({})
  const lastStepChangeDirectionRef = useRef<'forward' | 'backward' | 'none'>('none')
  const isFirstSlide = currentIndex <= 0
  const isLastSlide = currentIndex >= slides.length - 1
  const currentScale = slideScaleMap[slide.id] || 1
  const currentViewportWidth = Math.max(0, slide.width * currentScale)
  const currentViewportHeight = Math.max(0, slide.height * currentScale)
  const elementIdSet = useMemo(() => new Set(slide.elements.map(element => element.id)), [slide.elements])
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
  const currentClickAnimations = useMemo(() => {
    return resolvedClickAnimations
  }, [resolvedClickAnimations])
  const currentAnimationStep = slideAnimationSteps[slide.id] || 0
  const hasRemainingClickAnimations = currentAnimationStep < currentClickAnimations.length

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
        activeFlickerAnimation
        && activeFlickerAnimation.targetId === elementId
        && isFlickerAnimation(activeFlickerAnimation.type, activeFlickerAnimation.category)
      ) {
        const flickerDurationMs = Math.max(1, activeFlickerAnimation.durationMs || 1000)
        style.animation = `${FLICKER_KEYFRAME_NAME} ${flickerDurationMs}ms ease-in-out 1`
        style.animationFillMode = 'forwards'
      }
      result[elementId] = style
    })

    return result
  }, [resolvedClickAnimations, currentClickAnimations, currentAnimationStep])

  const logTransitionDebug = useCallback((message: string, payload?: Record<string, unknown>) => {
    if (!ENABLE_TRANSITION_DEBUG_LOG) return
    if (payload) {
      console.log(`[SlideViewer] ${message}`, payload)
      return
    }
    console.log(`[SlideViewer] ${message}`)
  }, [])

  const logElementAnimationDebug = useCallback((message: string, payload?: Record<string, unknown>) => {
    if (!ENABLE_ELEMENT_ANIMATION_DEBUG_LOG) return
    if (payload) {
      console.log(`[SlideViewer][ElementAnimation] ${message}`, payload)
      return
    }
    console.log(`[SlideViewer][ElementAnimation] ${message}`)
  }, [])

  const logLayerComputedStyle = useCallback((label: string, index: number) => {
    if (!ENABLE_TRANSITION_DEBUG_LOG) return
    const layer = layerRefs.current[index]
    if (!layer) {
      console.log(`[SlideViewer] ${label}`, { index, missing: true })
      return
    }
    const computedStyle = window.getComputedStyle(layer)
    console.log(`[SlideViewer] ${label}`, {
      index,
      opacity: computedStyle.opacity,
      transform: computedStyle.transform,
      transition: computedStyle.transition
    })
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
    `
    document.head.appendChild(styleElement)
  }, [])

  const pagerSides: Array<'left' | 'right'> = pagerPosition === 'both'
    ? ['left', 'right']
    : [pagerPosition]

  const renderFloatingPager = (side: 'left' | 'right') => (
    <div
      key={`pager-${side}`}
      style={{
        ...styles.floatingPagerContainer,
        ...(side === 'left'
          ? styles.floatingPagerContainerLeft
          : styles.floatingPagerContainerRight)
      }}
    >
      <button
        style={{
          ...styles.floatingPagerActionButton,
          ...(isFirstSlide ? styles.floatingPagerActionButtonDisabled : {})
        }}
        onClick={() => handlePrevSlide('pager')}
        disabled={isFirstSlide}
        aria-label='上一页'
      >
        <FontAwesomeIcon icon={faChevronLeft} style={styles.floatingPagerActionIcon} />
      </button>
      <button style={styles.floatingPagerPageButton} onClick={() => setSlidePanelOpen(open => !open)}>
        <span style={styles.floatingPagerValue}>{currentIndex + 1}/{slides.length}</span>
      </button>
      <button
        style={{
          ...styles.floatingPagerActionButton,
          ...(isLastSlide ? styles.floatingPagerActionButtonDisabled : {})
        }}
        onClick={() => handleNextSlide('pager')}
        disabled={isLastSlide}
        aria-label='下一页'
      >
        <FontAwesomeIcon icon={faChevronRight} style={styles.floatingPagerActionIcon} />
      </button>
    </div>
  )

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

  const handlePrevSlide = (source: SlideChangeSource = 'pager') => {
    lastStepChangeDirectionRef.current = 'none'
    if (stepBackwardElementAnimation()) return
    if (isFirstSlide) return
    logElementAnimationDebug('无可回退动画，执行上一页', {
      slideId: slide.id,
      source
    })
    onSlideChange(currentIndex - 1, source)
  }

  const handleNextSlide = (source: SlideChangeSource = 'pager') => {
    lastStepChangeDirectionRef.current = 'none'
    if (stepForwardElementAnimation()) return
    if (isLastSlide) return
    logElementAnimationDebug('无可推进动画，执行下一页', {
      slideId: slide.id,
      source
    })
    onSlideChange(currentIndex + 1, source)
  }

  const handleSlideViewportClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!clickToNextEnabled) return
    const target = event.target as HTMLElement
    if (target.closest('[data-slide-element="true"]')) return
    handleNextSlide('click')
  }

  // 预计算每一页缩放比例，切页时直接展示已渲染内容
  const calculateSlideScaleMap = useCallback(() => {
    if (!containerRef.current) return

    const container = containerRef.current
    const computedStyle = window.getComputedStyle(container)
    const paddingLeft = parseFloat(computedStyle.paddingLeft) || 0
    const paddingRight = parseFloat(computedStyle.paddingRight) || 0
    const paddingTop = parseFloat(computedStyle.paddingTop) || 0
    const paddingBottom = parseFloat(computedStyle.paddingBottom) || 0
    const containerWidth = Math.max(0, container.clientWidth - paddingLeft - paddingRight)
    const containerHeight = Math.max(
      0,
      container.clientHeight - paddingTop - paddingBottom - slideInfoBarHeight
    )

    const nextScaleMap: Record<string, number> = {}
    slides.forEach(slideItem => {
      const scaleX = containerWidth / slideItem.width
      const scaleY = containerHeight / slideItem.height
      nextScaleMap[slideItem.id] = Math.max(0, Math.min(scaleX, scaleY))
    })
    setSlideScaleMap(nextScaleMap)
  }, [slides])

  // 监听窗口大小变化
  useEffect(() => {
    calculateSlideScaleMap()

    const handleResize = () => {
      calculateSlideScaleMap()
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [calculateSlideScaleMap])

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false
      const tagName = target.tagName
      return (
        tagName === 'INPUT'
        || tagName === 'TEXTAREA'
        || tagName === 'SELECT'
        || target.isContentEditable
      )
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return
      if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
        event.preventDefault()
        handlePrevSlide('keyboard')
        return
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
        event.preventDefault()
        handleNextSlide('keyboard')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleNextSlide, handlePrevSlide])

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

  useLayoutEffect(() => {
    if (previousIndexRef.current === currentIndex) return
    const previousIndex = previousIndexRef.current
    const nextSlide = slides[currentIndex]
    const leavingSlide = previousIndex >= 0 ? slides[previousIndex] : undefined
    const isBackward = currentIndex < previousIndex
    const isNonThumbnailBack = isBackward && slideChangeSource !== 'thumbnail'
    const activeTransitionFromSlide = isNonThumbnailBack ? leavingSlide : nextSlide
    const resolvedTransitionKey = normalizeTransitionKey(
      activeTransitionFromSlide?.transition?.key || 'None'
    )
    const shouldAnimateTransition =
      resolvedTransitionKey === FADE_TRANSITION_KEY
      || isDirectionalSlideTransition(resolvedTransitionKey)
      || isCircleInTransition(resolvedTransitionKey)
      || isLineRevealTransition(resolvedTransitionKey)
    const rawDuration = activeTransitionFromSlide?.transition?.durationMs ?? DEFAULT_FADE_DURATION_MS
    const transitionDurationMs = Math.max(0, Math.min(rawDuration, MAX_FADE_DURATION_MS))
    const shouldUseReverseBackTransition =
      isNonThumbnailBack
      && (
        isDirectionalSlideTransition(resolvedTransitionKey)
        || isCircleInTransition(resolvedTransitionKey)
        || isLineRevealTransition(resolvedTransitionKey)
      )

    logTransitionDebug('检测翻页', {
      previousIndex,
      currentIndex,
      slideChangeSource,
      resolvedTransitionKey,
      transitionDurationMs,
      isBackward,
      isNonThumbnailBack,
      shouldAnimateTransition,
      shouldUseReverseBackTransition
    })

    const clearTransitionTimer = () => {
      if (leaveAnimationTimerRef.current !== null) {
        window.clearTimeout(leaveAnimationTimerRef.current)
        leaveAnimationTimerRef.current = null
      }
    }

    const clearTransitionRaf = () => {
      if (transitionRafRef.current !== null) {
        window.cancelAnimationFrame(transitionRafRef.current)
        transitionRafRef.current = null
      }
    }

    if (leaveAnimationTimerRef.current !== null) {
      clearTransitionTimer()
    }

    if (transitionRafRef.current !== null) {
      clearTransitionRaf()
    }

    if (lineRevealRafRef.current !== null) {
      window.cancelAnimationFrame(lineRevealRafRef.current)
      lineRevealRafRef.current = null
    }
    setLineRevealProgress(0)

    if (shouldAnimateTransition && previousIndex >= 0 && previousIndex !== currentIndex) {
      const nextSnapshots: Record<number, LayerSnapshot> = {}
      if (transitionState) {
        ;[transitionState.enteringIndex, transitionState.leavingIndex].forEach(index => {
          const layer = layerRefs.current[index]
          if (!layer) return
          const computedStyle = window.getComputedStyle(layer)
          nextSnapshots[index] = {
            opacity: parseFloat(computedStyle.opacity) || 0,
            transform: computedStyle.transform === 'none' ? DEFAULT_TRANSFORM : computedStyle.transform
          }
        })
      }

      const transitionId = transitionIdRef.current + 1
      transitionIdRef.current = transitionId
      setLayerSnapshots(nextSnapshots)
      setTransitionState({
        id: transitionId,
        enteringIndex: currentIndex,
        leavingIndex: previousIndex,
        key: resolvedTransitionKey,
        durationMs: transitionDurationMs,
        isReverseBackTransition: shouldUseReverseBackTransition,
        phase: 'prepare'
      })
      logTransitionDebug('进入 prepare 阶段', {
        transitionId,
        enteringIndex: currentIndex,
        leavingIndex: previousIndex,
        key: resolvedTransitionKey,
        durationMs: transitionDurationMs
      })
      transitionRafRef.current = window.requestAnimationFrame(() => {
        transitionRafRef.current = window.requestAnimationFrame(() => {
          setTransitionState(state => {
            if (!state || state.id !== transitionId) return state
            logTransitionDebug('切换到 running 阶段', {
              transitionId,
              enteringIndex: state.enteringIndex,
              leavingIndex: state.leavingIndex,
              key: state.key,
              durationMs: state.durationMs
            })
            return { ...state, phase: 'running' }
          })
          transitionRafRef.current = null
        })
      })
    } else {
      logTransitionDebug('不执行转场动画，直接切换', {
        previousIndex,
        currentIndex,
        resolvedTransitionKey
      })
      setTransitionState(null)
      setLayerSnapshots({})
    }

    previousIndexRef.current = currentIndex
  }, [currentIndex, slides, slideChangeSource, transitionState])

  useEffect(() => {
    if (!transitionState) return
    logTransitionDebug('当前 transitionState', {
      id: transitionState.id,
      phase: transitionState.phase,
      key: transitionState.key,
      durationMs: transitionState.durationMs,
      enteringIndex: transitionState.enteringIndex,
      leavingIndex: transitionState.leavingIndex
    })
    logLayerComputedStyle('样式快照(同步)', transitionState.enteringIndex)
    logLayerComputedStyle('样式快照(同步)', transitionState.leavingIndex)
    const rafId = window.requestAnimationFrame(() => {
      logLayerComputedStyle('样式快照(下一帧)', transitionState.enteringIndex)
      logLayerComputedStyle('样式快照(下一帧)', transitionState.leavingIndex)
    })
    return () => {
      window.cancelAnimationFrame(rafId)
    }
  }, [transitionState, logLayerComputedStyle, logTransitionDebug])

  useEffect(() => {
    if (!transitionState || transitionState.phase !== 'running') return
    logTransitionDebug('running 阶段开始计时', {
      transitionId: transitionState.id,
      durationMs: transitionState.durationMs
    })
    leaveAnimationTimerRef.current = window.setTimeout(() => {
      logTransitionDebug('转场计时结束，清理状态', {
        transitionId: transitionState.id
      })
      setTransitionState(null)
      setLayerSnapshots({})
      leaveAnimationTimerRef.current = null
    }, transitionState.durationMs)

    return () => {
      if (leaveAnimationTimerRef.current !== null) {
        logTransitionDebug('清理 running 计时器')
        window.clearTimeout(leaveAnimationTimerRef.current)
        leaveAnimationTimerRef.current = null
      }
    }
  }, [transitionState])

  useEffect(() => {
    if (!transitionState || transitionState.key !== LINE_REVEAL_TRANSITION_KEY) {
      setLineRevealProgress(0)
      if (lineRevealRafRef.current !== null) {
        window.cancelAnimationFrame(lineRevealRafRef.current)
        lineRevealRafRef.current = null
      }
      return
    }

    if (transitionState.phase !== 'running') {
      setLineRevealProgress(0)
      return
    }

    const startTime = performance.now()
    const duration = Math.max(1, transitionState.durationMs)
    const animate = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(1, elapsed / duration)
      setLineRevealProgress(progress)
      if (progress < 1) {
        lineRevealRafRef.current = window.requestAnimationFrame(animate)
      } else {
        lineRevealRafRef.current = null
      }
    }

    lineRevealRafRef.current = window.requestAnimationFrame(animate)

    return () => {
      if (lineRevealRafRef.current !== null) {
        window.cancelAnimationFrame(lineRevealRafRef.current)
        lineRevealRafRef.current = null
      }
    }
  }, [transitionState])

  useEffect(() => {
    return () => {
      if (leaveAnimationTimerRef.current !== null) {
        window.clearTimeout(leaveAnimationTimerRef.current)
      }
      if (transitionRafRef.current !== null) {
        window.cancelAnimationFrame(transitionRafRef.current)
      }
      if (lineRevealRafRef.current !== null) {
        window.cancelAnimationFrame(lineRevealRafRef.current)
      }
    }
  }, [])

  return (
    <div style={styles.slideViewerContainer}>
      {isSlidePanelOpen && (
        <div style={styles.slidePanelOverlay} onClick={() => setSlidePanelOpen(false)} />
      )}

      {/* 幻灯片容器 */}
      <div
        ref={containerRef}
        style={{
          ...styles.slideContainer,
          position: 'relative',
          alignItems: 'stretch',
          justifyContent: 'stretch',
        }}
      >
        <div
          style={{
            ...styles.slideWrapper,
            position: 'relative',
            width: '100%',
            height: `calc(100% - ${slideInfoBarHeight}px)`,
          }}
        >
          <div
            style={{
              ...styles.slideViewport,
              width: `${currentViewportWidth}px`,
              height: `${currentViewportHeight}px`,
            }}
            onClick={handleSlideViewportClick}
          >
            <div style={styles.slideWhiteBackdrop} />
            {slides.map((slideItem, index) => {
            const isCurrent = index === currentIndex
            const isEntering = transitionState?.enteringIndex === index
            const isLeaving = transitionState?.leavingIndex === index
            const isAnimating = Boolean(isEntering || isLeaving)
            const isTransitionRunning = transitionState?.phase === 'running'
            const snapshot = layerSnapshots[index]
            const transitionKey = transitionState?.key || 'None'
            const isReverseBackTransition = Boolean(transitionState?.isReverseBackTransition)
            const shouldUseMaskTopLayer =
              transitionKey === CIRCLE_IN_TRANSITION_KEY || transitionKey === LINE_REVEAL_TRANSITION_KEY
            const zIndex = shouldUseMaskTopLayer
              ? transitionKey === LINE_REVEAL_TRANSITION_KEY
                ? isLeaving ? 2 : isCurrent ? 1 : 0
                : isReverseBackTransition
                ? isEntering ? 2 : isCurrent ? 1 : 0
                : isLeaving ? 2 : isCurrent ? 1 : 0
              : isCurrent ? 2 : isLeaving ? 1 : 0
            const isFadeTransition = transitionKey === FADE_TRANSITION_KEY
            const isCircleIn = transitionKey === CIRCLE_IN_TRANSITION_KEY
            const isLineReveal = transitionKey === LINE_REVEAL_TRANSITION_KEY
            const isCircleInReverse = isCircleIn && isReverseBackTransition
            const currentLineRevealProgress = isTransitionRunning ? lineRevealProgress : 0
            const lineRevealClipPath = buildLineRevealClipPath(
              currentLineRevealProgress,
              isReverseBackTransition
            )
            const enteringStartTransform = resolveEnteringStartTransform(
              transitionKey,
              isReverseBackTransition
            )
            const leavingTargetTransform = resolveLeavingTargetTransform(
              transitionKey,
              isReverseBackTransition
            )
            const layerOpacity = isEntering
              ? isFadeTransition
                ? isTransitionRunning ? 1 : snapshot?.opacity ?? 0
                : snapshot?.opacity ?? 1
              : isLeaving
                ? isFadeTransition
                  ? isTransitionRunning ? 0 : snapshot?.opacity ?? 1
                  : snapshot?.opacity ?? 1
                : 1
            const layerTransform = isEntering
              ? isTransitionRunning
                ? DEFAULT_TRANSFORM
                : isFadeTransition
                  ? snapshot?.transform ?? DEFAULT_TRANSFORM
                  : enteringStartTransform
              : isLeaving
                ? isTransitionRunning
                  ? leavingTargetTransform
                  : isFadeTransition
                    ? snapshot?.transform ?? DEFAULT_TRANSFORM
                    : DEFAULT_TRANSFORM
                : DEFAULT_TRANSFORM
            const layerClipPath = isCircleIn
              ? isCircleInReverse
                ? isEntering
                  ? isTransitionRunning ? CIRCLE_IN_START_CLIP_PATH : CIRCLE_IN_END_CLIP_PATH
                  : undefined
                : isLeaving
                  ? isTransitionRunning ? CIRCLE_IN_END_CLIP_PATH : CIRCLE_IN_START_CLIP_PATH
                  : undefined
              : isLineReveal
                ? isLeaving
                  ? lineRevealClipPath
                  : undefined
                : undefined
            const layerTransition = isAnimating && isTransitionRunning
              ? isCircleIn
                ? `clip-path ${transitionState?.durationMs || 0}ms ease`
                : isLineReveal
                  ? 'none'
                : `transform ${transitionState?.durationMs || 0}ms ease, opacity ${transitionState?.durationMs || 0}ms ease`
              : 'none'
            if (ENABLE_TRANSITION_DEBUG_LOG && (isEntering || isLeaving)) {
              console.log('[SlideViewer] 渲染计算值', {
                index,
                role: isEntering ? 'entering' : 'leaving',
                phase: transitionState?.phase,
                key: transitionKey,
                layerOpacity,
                layerTransform,
                layerClipPath,
                currentLineRevealProgress,
                layerTransition
              })
            }
            const currentSlideNumber = currentIndex + 1
            const sourceSlideNumber = index + 1
            const shouldKeepAliveForCrossPlay = slideItem.elements.some(
              element => element.type === 'video'
                && element.isCrossSlidePlay
                && currentSlideNumber > sourceSlideNumber
                && (
                  element.stopPlayPageNumber <= 0
                  || currentSlideNumber < element.stopPlayPageNumber
                )
            )

            return (
              <div
                key={`${slideItem.id}-${index}`}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  zIndex,
                  visibility: isCurrent || isLeaving || shouldKeepAliveForCrossPlay ? 'visible' : 'hidden',
                  opacity: isCurrent || isLeaving ? 1 : 0,
                  pointerEvents: isCurrent ? 'auto' : 'none',
                }}
              >
                <div
                  ref={node => {
                    layerRefs.current[index] = node
                  }}
                  style={{
                    ...styles.slideLayerContainer,
                    transform: layerTransform,
                    opacity: layerOpacity,
                    clipPath: layerClipPath,
                    transition: layerTransition,
                    willChange: isAnimating
                      ? isCircleIn
                        ? 'clip-path'
                        : isLineReveal
                          ? 'clip-path'
                          : 'transform, opacity'
                      : undefined,
                  }}
                >
                  <SlideRenderer
                    slide={slideItem}
                    scale={slideScaleMap[slideItem.id] || 1}
                    resourceMap={resourceMap}
                    slideIndex={index}
                    currentIndex={currentIndex}
                    elementDisplayStyles={isCurrent ? elementDisplayStyles : undefined}
                  />
                </div>
              </div>
            )
            })}
          </div>
        </div>
      </div>

      {isSlidePanelOpen && (
        <div style={styles.slideFloatingPanel}>
          <div style={styles.sidebarHeader}>
            <span>幻灯片</span>
          </div>
          <div style={styles.slideList}>
            {slides.map((slideItem, index) => (
              <SlideThumbnail
                key={slideItem.id}
                slide={slideItem}
                index={index}
                isActive={index === currentIndex}
                resourceMap={resourceMap}
                onSlideChange={onSlideChange}
              />
            ))}
          </div>
        </div>
      )}

      {pagerSides.map(renderFloatingPager)}
    </div>
  )
}
