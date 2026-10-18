import { Button } from 'antd'
import { styles } from '../../styles'
import type { SlideData } from '../../parser'
import type { SlideChangeSource } from '../Viewer'
import { thumbnailHeight, thumbnailWidth } from './constants'
import { useState } from 'react'
import { SlidePreview } from './SlidePreview'

interface SlideThumbnailProps {
  slide: SlideData
  index: number
  isActive: boolean
  resourceMap: Record<string, string>
  onSlideChange: (index: number, source?: SlideChangeSource) => void | Promise<void>
}

export function SlideThumbnail({
  slide,
  index,
  isActive,
  resourceMap,
  onSlideChange
}: SlideThumbnailProps) {
  const [failedUrl, setFailedUrl] = useState<string>()
  return (
    <Button
      type='text'
      onClick={() => { void Promise.resolve(onSlideChange(index, 'thumbnail')).catch(() => undefined) }}
      style={{
        ...styles.slideTab,
        ...(isActive ? styles.slideTabActive : {})
      }}
    >
      <span style={styles.slideTabNumber}>{index + 1}</span>
      <span style={styles.slideTabPreviewViewport}>
        <span style={styles.slideTabPreviewContent}>
          {slide.thumbnail && slide.thumbnail !== failedUrl
            ? <img src={slide.thumbnail} loading='lazy' decoding='async' alt={`第 ${index + 1} 页预览`}
                onError={() => setFailedUrl(slide.thumbnail)}
                style={{ width: thumbnailWidth, height: thumbnailHeight, objectFit: 'contain' }} />
            : <SlidePreview slide={slide} index={index} resourceMap={resourceMap} />}
        </span>
      </span>
    </Button>
  )
}
