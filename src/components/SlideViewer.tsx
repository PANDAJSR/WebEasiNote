import { useEffect, useRef } from 'react'
import { styles } from '../styles'
import type { SlideData, TextLine } from '../enbx/parser'
import type { SlideChangeSource } from './Viewer'
import type { PagerPosition } from '../viewer/viewer-settings'
import type { TextStyleCommand, TextStyleState } from './text-style-commands'
import { FloatingPager } from './slide-viewer/FloatingPager'
import { SlideThumbnail } from './slide-viewer/SlideThumbnail'
import { useElementAnimations } from './slide-viewer/useElementAnimations'
import { useEditViewport } from './slide-viewer/useEditViewport'
import { useSlideKeyboardNavigation } from './slide-viewer/useSlideKeyboardNavigation'
import { useSlidePanel } from './slide-viewer/useSlidePanel'
import { useSlideScaleMap } from './slide-viewer/useSlideScaleMap'
import { useSlideTransitions } from './slide-viewer/useSlideTransitions'
import { useSlideSwipeNavigation } from './slide-viewer/useSlideSwipeNavigation'
import { SlideViewerLayer } from './slide-viewer/SlideViewerLayer'
import { slideInfoBarHeight } from './slide-viewer/constants'
import { clearRasterCache } from '../rendering/rasterCache'
import { usePageNavigation } from './slide-viewer/usePageNavigation'
import type { PlaybackSelection } from '../viewer/usePlaybackSelection'

interface SlideViewerProps {
  slide: SlideData
  slides: SlideData[]
  currentIndex: number
  onSlideChange: (index: number, source?: SlideChangeSource) => void | Promise<void>
  slideChangeSource: SlideChangeSource
  resourceMap?: Record<string, string>
  clickToNextEnabled: boolean
  pagerPosition: PagerPosition
  showAnimationProgress: boolean
  hidePager?: boolean
  /** 底部信息条预留高度；宿主内嵌全屏播放传 0，避免比例一致时出现四周黑边。 */
  infoBarHeight?: number
  isEditMode: boolean
  playbackSelection?: PlaybackSelection
  selectedElementId?: string | null
  onEditElementSelect?: (elementId: string) => void
  onEditElementDrag?: (elementId: string, nextX: number, nextY: number) => void
  onEditElementResize?: (
    elementId: string,
    nextX: number,
    nextY: number,
    nextWidth: number,
    nextHeight: number
  ) => void
  onEditElementTextUpdate?: (elementId: string, nextTextLines: TextLine[]) => void
  onEditAudioUpdate?: (elementId: string, edit: import('../viewer/audio-editing').AudioEdit) => void
  onEditTextStyleStateChange?: (state: TextStyleState | null) => void
  onEditBackgroundClick?: () => void
  textStyleCommand?: TextStyleCommand | null
  toggleThumbnailsCommand?: { side: 'left' | 'right'; id: number } | null
  navigationCommand?: { id: number; direction: 'previous' | 'next'; requestId: string } | null
  onNavigationResult?: (requestId: string, page: number) => void
  swipeNavigationEnabled?: boolean
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
  showAnimationProgress,
  hidePager = false,
  infoBarHeight = slideInfoBarHeight,
  isEditMode,
  playbackSelection,
  selectedElementId = null,
  onEditElementSelect,
  onEditElementDrag,
  onEditElementResize,
  onEditElementTextUpdate,
  onEditAudioUpdate,
  onEditTextStyleStateChange,
  onEditBackgroundClick,
  textStyleCommand = null,
  toggleThumbnailsCommand = null,
  navigationCommand = null,
  onNavigationResult,
  swipeNavigationEnabled = true
}: SlideViewerProps) {
  useEffect(() => () => clearRasterCache(), [])
  const { containerRef, slideScaleMap } = useSlideScaleMap(slides, infoBarHeight)
  const editWheelGuardRef = useRef<HTMLDivElement | null>(null)
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
  const { transitionState, layerSnapshots, lineRevealProgress, setLayerRef } = useSlideTransitions({
    slides,
    currentIndex,
    slideChangeSource,
    disableTransitions: isEditMode
  })
  const {
    isSlidePanelRendered,
    isSlidePanelActive,
    slidePanelAnchorSide,
    handleToggleSlidePanel,
    handleCloseSlidePanel
  } = useSlidePanel()

  useEffect(() => {
    if (!toggleThumbnailsCommand) return
    handleToggleSlidePanel(toggleThumbnailsCommand.side)
  }, [toggleThumbnailsCommand?.id])

  const isFirstSlide = currentIndex <= 0
  const isLastSlide = currentIndex >= slides.length - 1
  const fitScale = slideScaleMap[slide.id] || 1
  const {
    currentScale,
    currentOffset,
    handleEditViewportWheel,
    handleEditViewportMouseDown,
    handleEditViewportAuxClick
  } = useEditViewport({
    slideId: slide.id,
    fitScale,
    isEditMode
  })
  const viewportScale = isEditMode ? currentScale : fitScale
  const currentViewportWidth = Math.max(0, slide.width * viewportScale)
  const currentViewportHeight = Math.max(0, slide.height * viewportScale)

  const { handlePrevSlide, handleNextSlide, navigatePage } = usePageNavigation({
    currentIndex, pageCount: slides.length, isEditMode, clearStepDirection,
    stepForwardElementAnimation, stepBackwardElementAnimation, onSlideChange,
    navigationCommand, onNavigationResult
  })

  const handleSlideViewportClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement
    if (isEditMode) {
      if (target.closest('[data-slide-element="true"]')) return
      onEditBackgroundClick?.()
      return
    }
    if (playbackSelection?.enabled || playbackSelection?.annotation?.state.frozen
      || playbackSelection?.annotation && playbackSelection.annotation.state.tool !== 'play' || !clickToNextEnabled) return
    if (target.closest('[data-activity-control="true"]')) return
    if (target.closest('[data-slide-element="true"]')) return
    handleNextSlide('click')
  }

  const handleSlideContainerClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!isEditMode) return
    const target = event.target as HTMLElement
    if (target.closest('[data-slide-element="true"]')) return
    if (target.closest('[data-slide-viewport="true"]')) return
    onEditBackgroundClick?.()
  }

  useSlideKeyboardNavigation({
    handlePrevSlide,
    handleNextSlide,
    isSlidePanelActive,
    handleCloseSlidePanel,
    annotationActive: !isEditMode && (!!playbackSelection?.enabled || !!playbackSelection?.annotation
      && (playbackSelection.annotation.state.frozen || playbackSelection.annotation.state.tool !== 'play'))
  })

  useSlideSwipeNavigation({
    containerRef,
    isEditMode,
    isSlidePanelActive,
    enabled: swipeNavigationEnabled && !playbackSelection?.enabled
      && (!playbackSelection?.annotation || !playbackSelection.annotation.state.frozen && playbackSelection.annotation.state.tool === 'play'),
    handlePrevSlide,
    handleNextSlide
  })

  const pagerSides: Array<'left' | 'right'> = pagerPosition === 'both'
    ? ['left', 'right']
    : [pagerPosition]

  const handleEditElementClick = (elementId: string): boolean => {
    onEditElementSelect?.(elementId)
    return true
  }

  useEffect(() => {
    const wrapper = editWheelGuardRef.current
    if (!wrapper) return

    const handleNativeWheel = (event: WheelEvent) => {
      if (!isEditMode || !event.ctrlKey) return
      event.preventDefault()
    }

    wrapper.addEventListener('wheel', handleNativeWheel, {
      passive: false,
      capture: true
    })
    return () => {
      wrapper.removeEventListener('wheel', handleNativeWheel, true)
    }
  }, [isEditMode])

  const handleEditWrapperWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (!isEditMode) return
    handleEditViewportWheel(event)
  }

  return (
    <div style={styles.slideViewerContainer}>
      {!isEditMode && isSlidePanelRendered && (
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
          justifyContent: 'stretch',
          overflow: isEditMode ? 'hidden' : styles.slideContainer.overflow,
          backgroundColor: isEditMode ? '#eceef3' : styles.slideContainer.backgroundColor,
          touchAction: isEditMode ? 'auto' : 'none',
          userSelect: 'none',
          WebkitUserSelect: 'none'
        }}
        onClick={handleSlideContainerClick}
        onMouseDown={handleEditViewportMouseDown}
        onAuxClick={handleEditViewportAuxClick}
      >
        <div
          ref={editWheelGuardRef}
          style={{
            ...styles.slideWrapper,
            position: 'relative',
            width: '100%',
            height: `calc(100% - ${infoBarHeight}px)`
          }}
          onWheel={handleEditWrapperWheel}
        >
          <div
            style={{
              ...styles.slideViewport,
              width: `${currentViewportWidth}px`,
              height: `${currentViewportHeight}px`,
              transform: isEditMode
                ? `translate(${currentOffset.x}px, ${currentOffset.y}px)`
                : undefined
            }}
            data-slide-viewport='true'
            onClick={handleSlideViewportClick}
          >
            <div style={styles.slideWhiteBackdrop} />
            {slides.map((slideItem, index) => {
              const isCurrent = index === currentIndex
              const slideScale = isEditMode && isCurrent ? currentScale : slideScaleMap[slideItem.id] || 1
              return (
                <SlideViewerLayer
                  key={`${slideItem.id}-${index}`}
                  slideItem={slideItem}
                  index={index}
                  currentIndex={currentIndex}
                  slideScale={slideScale}
                  resourceMap={resourceMap}
                  transitionState={transitionState}
                  snapshot={layerSnapshots[index]}
                  lineRevealProgress={lineRevealProgress}
                  setLayerRef={setLayerRef}
                  isEditMode={isEditMode}
                  playbackSelection={playbackSelection}
                  elementDisplayStyles={!isEditMode && isCurrent ? elementDisplayStyles : undefined}
                  elementRenderStates={!isEditMode && isCurrent ? elementRenderStates : undefined}
                  onElementClick={
                    isCurrent
                      ? (
                        isEditMode
                          ? handleEditElementClick
                          : triggerElementSourceAnimation
                      )
                      : undefined
                  }
                  onEditElementDrag={isCurrent && isEditMode ? onEditElementDrag : undefined}
                  onEditElementResize={isCurrent && isEditMode ? onEditElementResize : undefined}
                  onEditTextUpdate={isCurrent && isEditMode ? onEditElementTextUpdate : undefined}
                  onEditAudioUpdate={isCurrent && isEditMode ? onEditAudioUpdate : undefined}
                  onEditTextStyleStateChange={isCurrent && isEditMode ? onEditTextStyleStateChange : undefined}
                  selectedElementId={isCurrent && isEditMode ? selectedElementId : null}
                  textStyleCommand={isCurrent && isEditMode ? textStyleCommand : null}
                />
              )
            })}
          </div>
        </div>
      </div>

      {!isEditMode && isSlidePanelRendered && (
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
          <div style={styles.slideList} data-slide-list>
            {slides.map((slideItem, index) => (
              <SlideThumbnail
                key={slideItem.id}
                slide={slideItem}
                index={index}
                isActive={index === currentIndex}
                resourceMap={resourceMap}
                onSlideChange={(i, s) => {
                  void navigatePage(i, s || 'thumbnail').catch(() => undefined)
                  handleCloseSlidePanel()
                }}
              />
            ))}
          </div>
        </div>
      )}

      {!isEditMode && !hidePager && pagerSides.map(side => (
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
