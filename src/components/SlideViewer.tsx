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
const DEFAULT_FADE_DURATION_MS = 300
const MAX_FADE_DURATION_MS = 8000
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

function resolveEnteringStartTransform(transitionKey: string, isReverseBackTransition: boolean): string {
  if (transitionKey !== SLIDE_TO_LEFT_TRANSITION_KEY) return 'translateX(0%)'
  return isReverseBackTransition ? 'translateX(-100%)' : 'translateX(100%)'
}

function resolveLeavingTargetTransform(transitionKey: string, isReverseBackTransition: boolean): string {
  if (transitionKey !== SLIDE_TO_LEFT_TRANSITION_KEY) return 'translateX(0%)'
  return isReverseBackTransition ? 'translateX(100%)' : 'translateX(-100%)'
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
    const resolvedTransitionKey = activeTransitionFromSlide?.transition?.key || 'None'
    const shouldAnimateTransition =
      resolvedTransitionKey === FADE_TRANSITION_KEY || resolvedTransitionKey === SLIDE_TO_LEFT_TRANSITION_KEY
    const rawDuration = activeTransitionFromSlide?.transition?.durationMs ?? DEFAULT_FADE_DURATION_MS
    const transitionDurationMs = Math.max(0, Math.min(rawDuration, MAX_FADE_DURATION_MS))
    const shouldUseReverseBackTransition =
      isNonThumbnailBack
      && resolvedTransitionKey === SLIDE_TO_LEFT_TRANSITION_KEY

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
            transform: computedStyle.transform === 'none' ? 'translateX(0%)' : computedStyle.transform
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
      transitionRafRef.current = window.requestAnimationFrame(() => {
        setTransitionState(state => {
          if (!state || state.id !== transitionId) return state
          return { ...state, phase: 'running' }
        })
        transitionRafRef.current = null
      })
    } else {
      setTransitionState(null)
      setLayerSnapshots({})
    }

    previousIndexRef.current = currentIndex
  }, [currentIndex, slides, slideChangeSource, transitionState])

  useEffect(() => {
    if (!transitionState || transitionState.phase !== 'running') return
    leaveAnimationTimerRef.current = window.setTimeout(() => {
      setTransitionState(null)
      setLayerSnapshots({})
      leaveAnimationTimerRef.current = null
    }, transitionState.durationMs)

    return () => {
      if (leaveAnimationTimerRef.current !== null) {
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
            const zIndex = isCurrent ? 2 : isLeaving ? 1 : 0
            const transitionKey = transitionState?.key || 'None'
            const isFadeTransition = transitionKey === FADE_TRANSITION_KEY
            const enteringStartTransform = resolveEnteringStartTransform(
              transitionKey,
              Boolean(transitionState?.isReverseBackTransition)
            )
            const leavingTargetTransform = resolveLeavingTargetTransform(
              transitionKey,
              Boolean(transitionState?.isReverseBackTransition)
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
                ? 'translateX(0%)'
                : snapshot?.transform ?? enteringStartTransform
              : isLeaving
                ? isTransitionRunning
                  ? leavingTargetTransform
                  : snapshot?.transform ?? 'translateX(0%)'
                : 'translateX(0%)'
            const layerTransition = isAnimating && isTransitionRunning
              ? `transform ${transitionState?.durationMs || 0}ms ease, opacity ${transitionState?.durationMs || 0}ms ease`
              : 'none'
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
                    transition: layerTransition,
                    willChange: isAnimating ? 'transform, opacity' : undefined,
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
