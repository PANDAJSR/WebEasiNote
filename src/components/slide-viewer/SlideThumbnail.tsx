import { Button } from 'antd'
import { styles } from '../../styles'
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
  onSlideChange
}: SlideThumbnailProps) {

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
          {slide.thumbnail
            ? <img src={slide.thumbnail} loading='lazy' decoding='async' alt={`第 ${index + 1} 页预览`}
                style={{ width: thumbnailWidth, height: thumbnailHeight, objectFit: 'contain' }} />
            : <span>第 {index + 1} 页</span>}
        </span>
      </span>
    </Button>
  )
}
