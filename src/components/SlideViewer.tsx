import { useEffect } from 'react'
import { styles } from '../styles'
import { SlideRenderer } from './SlideRenderer'
import type { SlideData } from '../parser'
import type { SlideChangeSource } from './Viewer'
import type { PagerPosition } from '../viewer-settings'
import { FloatingPager } from './slide-viewer/FloatingPager'
import { SlideThumbnail } from './slide-viewer/SlideThumbnail'
import { useElementAnimations } from './slide-viewer/useElementAnimations'
import { useSlidePanel } from './slide-viewer/useSlidePanel'
import { useSlideScaleMap } from './slide-viewer/useSlideScaleMap'
import { useSlideTransitions } from './slide-viewer/useSlideTransitions'
import {
  buildLineRevealClipPath,
  CIRCLE_IN_END_CLIP_PATH,
  CIRCLE_IN_START_CLIP_PATH,
  CIRCLE_IN_TRANSITION_KEY,
  DEFAULT_TRANSFORM,
  FADE_TRANSITION_KEY,
  LINE_REVEAL_TRANSITION_KEY,
  resolveEnteringStartTransform,
  resolveLeavingTargetTransform,
  slideInfoBarHeight
} from './slide-viewer/constants'

interface SlideViewerProps {
  slide: SlideData
  slides: SlideData[]
  currentIndex: number
  onSlideChange: (index: number, source?: SlideChangeSource) => void
  slideChangeSource: SlideChangeSource
  resourceMap?: Record<string, string>
  clickToNextEnabled: boolean
  pagerPosition: PagerPosition
  showAnimationProgress: boolean
}

export function SlideViewer({
  slide,
  slides,
  currentIndex,
  onSlideChange,
  slideChangeSource,
  resourceMap = {},
  clickToNextEnabled,
  pagerPosition,
  showAnimationProgress
}: SlideViewerProps) {
  const {
    containerRef,
    slideScaleMap
  } = useSlideScaleMap(slides)
  const {
    elementDisplayStyles,
    elementRenderStates,
    currentAnimationStep,
    totalClickAnimations,
    stepForwardElementAnimation,
    triggerElementSourceAnimation,
    stepBackwardElementAnimation,
    clearStepDirection
  } = useElementAnimations({ slide })
  const {
    transitionState,
    layerSnapshots,
    lineRevealProgress,
    setLayerRef
  } = useSlideTransitions({
    slides,
    currentIndex,
    slideChangeSource
  })
  const {
    isSlidePanelRendered,
    isSlidePanelActive,
    slidePanelAnchorSide,
    handleToggleSlidePanel,
    handleCloseSlidePanel
  } = useSlidePanel()

  const isFirstSlide = currentIndex <= 0
  const isLastSlide = currentIndex >= slides.length - 1
  const currentScale = slideScaleMap[slide.id] || 1
  const currentViewportWidth = Math.max(0, slide.width * currentScale)
  const currentViewportHeight = Math.max(0, slide.height * currentScale)

  const handlePrevSlide = (source: SlideChangeSource = 'pager') => {
    clearStepDirection()
    if (stepBackwardElementAnimation()) return
    if (isFirstSlide) return
    onSlideChange(currentIndex - 1, source)
  }

  const handleNextSlide = (source: SlideChangeSource = 'pager') => {
    clearStepDirection()
    if (stepForwardElementAnimation()) return
    if (isLastSlide) return
    onSlideChange(currentIndex + 1, source)
  }

  const handleSlideViewportClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!clickToNextEnabled) return
    const target = event.target as HTMLElement
    if (target.closest('[data-slide-element="true"]')) return
    handleNextSlide('click')
  }

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
  }, [currentIndex, isFirstSlide, isLastSlide, stepBackwardElementAnimation, stepForwardElementAnimation])

  const pagerSides: Array<'left' | 'right'> = pagerPosition === 'both'
    ? ['left', 'right']
    : [pagerPosition]

  return (
    <div style={styles.slideViewerContainer}>
      {isSlidePanelRendered && (
        <div
          style={{
            ...styles.slidePanelOverlay,
            ...(isSlidePanelActive ? styles.slidePanelOverlayVisible : styles.slidePanelOverlayHidden)
          }}
          onClick={handleCloseSlidePanel}
        />
      )}

      <div
        ref={containerRef}
        style={{
          ...styles.slideContainer,
          position: 'relative',
          alignItems: 'stretch',
          justifyContent: 'stretch'
        }}
      >
        <div
          style={{
            ...styles.slideWrapper,
            position: 'relative',
            width: '100%',
            height: `calc(100% - ${slideInfoBarHeight}px)`
          }}
        >
          <div
            style={{
              ...styles.slideViewport,
              width: `${currentViewportWidth}px`,
              height: `${currentViewportHeight}px`
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
                    pointerEvents: isCurrent ? 'auto' : 'none'
                  }}
                >
                  <div
                    ref={node => {
                      setLayerRef(index, node)
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
                        : undefined
                    }}
                  >
                    <SlideRenderer
                      slide={slideItem}
                      scale={slideScaleMap[slideItem.id] || 1}
                      resourceMap={resourceMap}
                      slideIndex={index}
                      currentIndex={currentIndex}
                      elementDisplayStyles={isCurrent ? elementDisplayStyles : undefined}
                      elementRenderStates={isCurrent ? elementRenderStates : undefined}
                      onElementClick={isCurrent ? triggerElementSourceAnimation : undefined}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {isSlidePanelRendered && (
        <div
          style={{
            ...styles.slideFloatingPanel,
            ...(isSlidePanelActive ? styles.slideFloatingPanelVisible : styles.slideFloatingPanelHidden),
            ...(slidePanelAnchorSide === 'left'
              ? (
                isSlidePanelActive
                  ? styles.slideFloatingPanelLeft
                  : styles.slideFloatingPanelLeftHidden
              )
              : (
                isSlidePanelActive
                  ? styles.slideFloatingPanelRight
                  : styles.slideFloatingPanelRightHidden
              ))
          }}
        >
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

      {pagerSides.map(side => (
        <FloatingPager
          key={side}
          side={side}
          isFirstSlide={isFirstSlide}
          isLastSlide={isLastSlide}
          currentIndex={currentIndex}
          totalSlides={slides.length}
          onPrev={() => handlePrevSlide('pager')}
          onNext={() => handleNextSlide('pager')}
          onOpenPanel={handleToggleSlidePanel}
          showAnimationProgress={showAnimationProgress}
          animationCurrentStep={currentAnimationStep}
          animationTotalSteps={totalClickAnimations}
        />
      ))}
    </div>
  )
}
