import { Button } from 'antd'
import { styles } from '../../styles'
import { SlideRenderer } from '../SlideRenderer'
import type { SlideData } from '../../parser'
import type { SlideChangeSource } from '../Viewer'
import { thumbnailHeight, thumbnailWidth } from './constants'

interface SlideThumbnailProps {
  slide: SlideData
  index: number
  isActive: boolean
  resourceMap: Record<string, string>
  onSlideChange: (index: number, source?: SlideChangeSource) => void
}

export function SlideThumbnail({
  slide,
  index,
  isActive,
  resourceMap,
  onSlideChange
}: SlideThumbnailProps) {
  const previewScale = Math.min(thumbnailWidth / slide.width, thumbnailHeight / slide.height, 1)

  return (
    <Button
      type='text'
      onClick={() => onSlideChange(index, 'thumbnail')}
      style={{
        ...styles.slideTab,
        ...(isActive ? styles.slideTabActive : {})
      }}
    >
      <span style={styles.slideTabNumber}>{index + 1}</span>
      <span style={styles.slideTabPreviewViewport}>
        <span style={styles.slideTabPreviewContent}>
          <SlideRenderer
            slide={slide}
            scale={previewScale}
            resourceMap={resourceMap}
            slideIndex={index}
            currentIndex={-1}
          />
        </span>
      </span>
    </Button>
  )
}
