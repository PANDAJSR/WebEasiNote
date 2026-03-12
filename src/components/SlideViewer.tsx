import { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons'
import { styles } from '../styles'
import { SlideRenderer } from './SlideRenderer'
import type { SlideData } from '../parser'
import type { SlideChangeSource } from './Viewer'

interface SlideViewerProps {
  slide: SlideData
  slides: SlideData[]
  currentIndex: number
  onSlideChange: (index: number, source?: SlideChangeSource) => void
  slideChangeSource: SlideChangeSource
  resourceMap?: Record<string, string>
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
  if (points.length < 3) return 'polygon(0% 0%, 0% 0%, 0% 0%)'
  const pointString = points
    .map(point => `${formatPercent(point.x)} ${formatPercent(point.y)}`)
    .join(', ')
  return `polygon(${pointString})`
}

function buildLineRevealClipPath(progress: number, isReverseDirection: boolean): string {
  const clampedProgress = Math.max(0, Math.min(progress, 1))
  if (isReverseDirection) {
    const threshold = 200 * (1 - clampedProgress)
    if (threshold >= 200) {
      return buildPolygonClipPath([
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 }
      ])
    }
    if (threshold <= 0) {
      return buildPolygonClipPath([{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }])
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
    return buildPolygonClipPath([
      { x: 0, y: 0 },
      { x: threshold, y: 0 },
      { x: 0, y: threshold }
    ])
  }

  const threshold = 200 * clampedProgress
  if (threshold <= 0) {
    return buildPolygonClipPath([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 }
    ])
  }
  if (threshold >= 200) {
    return buildPolygonClipPath([{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }])
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
  return buildPolygonClipPath([
    { x: 100, y: threshold - 100 },
    { x: 100, y: 100 },
    { x: threshold - 100, y: 100 }
  ])
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
  resourceMap = {}
}: SlideViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [slideScaleMap, setSlideScaleMap] = useState<Record<string, number>>({})
  const [isSlidePanelOpen, setSlidePanelOpen] = useState(false)
  const previousIndexRef = useRef(currentIndex)
  const [transitionState, setTransitionState] = useState<TransitionState | null>(null)
  const [layerSnapshots, setLayerSnapshots] = useState<Record<number, LayerSnapshot>>({})
  const leaveAnimationTimerRef = useRef<number | null>(null)
  const transitionRafRef = useRef<number | null>(null)
  const transitionIdRef = useRef(0)
  const layerRefs = useRef<Record<number, HTMLDivElement | null>>({})
  const isFirstSlide = currentIndex <= 0
  const isLastSlide = currentIndex >= slides.length - 1
  const currentScale = slideScaleMap[slide.id] || 1
  const currentViewportWidth = Math.max(0, slide.width * currentScale)
  const currentViewportHeight = Math.max(0, slide.height * currentScale)

  const logTransitionDebug = useCallback((message: string, payload?: Record<string, unknown>) => {
    if (!ENABLE_TRANSITION_DEBUG_LOG) return
    if (payload) {
      console.log(`[SlideViewer] ${message}`, payload)
      return
    }
    console.log(`[SlideViewer] ${message}`)
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

  const handlePrevSlide = () => {
    if (isFirstSlide) return
    onSlideChange(currentIndex - 1, 'pager')
  }

  const handleNextSlide = () => {
    if (isLastSlide) return
    onSlideChange(currentIndex + 1, 'pager')
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
    return () => {
      if (leaveAnimationTimerRef.current !== null) {
        window.clearTimeout(leaveAnimationTimerRef.current)
      }
      if (transitionRafRef.current !== null) {
        window.cancelAnimationFrame(transitionRafRef.current)
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
            const lineRevealPrepareClipPath = buildLineRevealClipPath(0, isReverseBackTransition)
            const lineRevealRunningClipPath = buildLineRevealClipPath(1, isReverseBackTransition)
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
                  ? isTransitionRunning ? lineRevealRunningClipPath : lineRevealPrepareClipPath
                  : undefined
              : undefined
            const layerTransition = isAnimating && isTransitionRunning
              ? isCircleIn
                ? `clip-path ${transitionState?.durationMs || 0}ms ease`
                : isLineReveal
                  ? `clip-path ${transitionState?.durationMs || 0}ms linear`
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

      {/* 底部信息栏 - 绝对定位贴底 */}
      <div style={styles.slideInfoBar}>
        <div style={styles.slideInfoItems}>
          <div style={styles.infoItem}>
            <span style={styles.infoLabel}>尺寸:</span>
            <span>{slide.width}×{slide.height}</span>
          </div>
          <div style={styles.infoItem}>
            <span style={styles.infoLabel}>缩放:</span>
            <span>{Math.round(currentScale * 100)}%</span>
          </div>
          <div style={styles.infoItem}>
            <span style={styles.infoLabel}>背景:</span>
            <span style={styles.colorPreview}>
              <span
                style={{
                  ...styles.colorBox,
                  backgroundColor: slide.backgroundColor,
                  backgroundImage: slide.backgroundImage ? `url(${resourceMap[slide.backgroundImage]})` : undefined,
                  backgroundSize: 'cover',
                }}
              />
              {slide.backgroundImage ? '图片' : slide.backgroundColor}
            </span>
          </div>
          <div style={styles.infoItem}>
            <span style={styles.infoLabel}>文本:</span>
            <span>{slide.elements.length}</span>
          </div>
        </div>
        <div style={styles.slidePagerControls}>
          <button
            style={{
              ...styles.slidePagerButton,
              ...(isFirstSlide ? styles.slidePagerButtonDisabled : {})
            }}
            onClick={handlePrevSlide}
            disabled={isFirstSlide}
            aria-label="上一页"
          >
            <FontAwesomeIcon icon={faChevronLeft} />
          </button>
          <button style={styles.slidePanelToggleButton} onClick={() => setSlidePanelOpen(open => !open)}>
            {currentIndex + 1} / {slides.length}
          </button>
          <button
            style={{
              ...styles.slidePagerButton,
              ...(isLastSlide ? styles.slidePagerButtonDisabled : {})
            }}
            onClick={handleNextSlide}
            disabled={isLastSlide}
            aria-label="下一页"
          >
            <FontAwesomeIcon icon={faChevronRight} />
          </button>
        </div>
      </div>
    </div>
  )
}
