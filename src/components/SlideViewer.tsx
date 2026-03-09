import { useState, useEffect, useRef, useCallback } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons'
import { styles } from '../styles'
import { SlideRenderer } from './SlideRenderer'
import type { SlideData } from '../parser'

interface SlideViewerProps {
  slide: SlideData
  slides: SlideData[]
  currentIndex: number
  onSlideChange: (index: number) => void
  resourceMap?: Record<string, string>
}

interface SlideThumbnailProps {
  slide: SlideData
  index: number
  isActive: boolean
  resourceMap: Record<string, string>
  onSlideChange: (index: number) => void
}

const thumbnailWidth = 96
const thumbnailHeight = 56

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
      onClick={() => onSlideChange(index)}
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
  resourceMap = {}
}: SlideViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [slideScaleMap, setSlideScaleMap] = useState<Record<string, number>>({})
  const [isSlidePanelOpen, setSlidePanelOpen] = useState(false)
  const isFirstSlide = currentIndex <= 0
  const isLastSlide = currentIndex >= slides.length - 1
  const currentScale = slideScaleMap[slide.id] || 1

  const handlePrevSlide = () => {
    if (isFirstSlide) return
    onSlideChange(currentIndex - 1)
  }

  const handleNextSlide = () => {
    if (isLastSlide) return
    onSlideChange(currentIndex + 1)
  }

  // 预计算每一页缩放比例，切页时直接展示已渲染内容
  const calculateSlideScaleMap = useCallback(() => {
    if (!containerRef.current) return

    const container = containerRef.current
    const infoBarHeight = 40 // 底部信息栏高度
    const containerWidth = container.clientWidth - 48 // 减去 padding
    const containerHeight = container.clientHeight - 48 - infoBarHeight

    const nextScaleMap: Record<string, number> = {}
    slides.forEach(slideItem => {
      const scaleX = containerWidth / slideItem.width
      const scaleY = containerHeight / slideItem.height
      nextScaleMap[slideItem.id] = Math.min(scaleX, scaleY, 1)
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

  return (
    <div style={styles.slideViewerContainer}>
      {isSlidePanelOpen && (
        <div style={styles.slidePanelOverlay} onClick={() => setSlidePanelOpen(false)} />
      )}

      {/* 幻灯片容器 */}
      <div ref={containerRef} style={styles.slideContainer}>
        <div
          style={{
            ...styles.slideWrapper,
            paddingBottom: '40px',
            position: 'relative',
            width: '100%',
            height: '100%',
          }}
        >
          {slides.map((slideItem, index) => (
            <div
              key={`${slideItem.id}-${index}`}
              style={(() => {
                const isCurrent = index === currentIndex
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

                return {
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  visibility: isCurrent || shouldKeepAliveForCrossPlay ? 'visible' : 'hidden',
                  opacity: isCurrent ? 1 : 0,
                  pointerEvents: isCurrent ? 'auto' : 'none',
                }
              })()}
            >
              <SlideRenderer
                slide={slideItem}
                scale={slideScaleMap[slideItem.id] || 1}
                resourceMap={resourceMap}
                slideIndex={index}
                currentIndex={currentIndex}
              />
            </div>
          ))}
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
