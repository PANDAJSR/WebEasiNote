import { useState, useEffect, useRef, useCallback } from 'react'
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
          <SlideRenderer slide={slide} scale={previewScale} resourceMap={resourceMap} />
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
  const [scale, setScale] = useState(1)
  const [isSlidePanelOpen, setSlidePanelOpen] = useState(false)

  // 计算合适的缩放比例，使幻灯片完全适应容器（减去底部栏高度）
  const calculateScale = useCallback(() => {
    if (!containerRef.current) return

    const container = containerRef.current
    const infoBarHeight = 40 // 底部信息栏高度
    const containerWidth = container.clientWidth - 48 // 减去 padding
    const containerHeight = container.clientHeight - 48 - infoBarHeight

    const slideWidth = slide.width
    const slideHeight = slide.height

    const scaleX = containerWidth / slideWidth
    const scaleY = containerHeight / slideHeight

    const newScale = Math.min(scaleX, scaleY, 1)
    setScale(newScale)
  }, [slide.width, slide.height])

  // 监听窗口大小变化
  useEffect(() => {
    calculateScale()

    const handleResize = () => {
      calculateScale()
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [calculateScale])

  return (
    <div style={styles.slideViewerContainer}>
      {isSlidePanelOpen && (
        <div style={styles.slidePanelOverlay} onClick={() => setSlidePanelOpen(false)} />
      )}

      {/* 幻灯片容器 */}
      <div ref={containerRef} style={styles.slideContainer}>
        <div style={{ ...styles.slideWrapper, paddingBottom: '40px' }}>
          <SlideRenderer slide={slide} scale={scale} resourceMap={resourceMap} />
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
            <span>{Math.round(scale * 100)}%</span>
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
        <button style={styles.slidePanelToggleButton} onClick={() => setSlidePanelOpen(open => !open)}>
          幻灯片列表
        </button>
      </div>
    </div>
  )
}
