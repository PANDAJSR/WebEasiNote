import { Button } from 'antd'
import { styles } from '../styles'
import type { SlideData } from '../parser'

interface SidebarProps {
  slides: SlideData[]
  currentIndex: number
  onSlideChange: (index: number) => void
}

export function Sidebar({ slides, currentIndex, onSlideChange }: SidebarProps) {
  return (
    <div style={styles.sidebar}>
      <div style={styles.sidebarHeader}>
        <span>幻灯片</span>
      </div>
      <div style={styles.slideList}>
        {slides.map((slide, index) => (
          <Button
            key={slide.id}
            type='text'
            onClick={() => onSlideChange(index)}
            style={{
              ...styles.slideTab,
              ...(index === currentIndex ? styles.slideTabActive : {})
            }}
          >
            <span style={styles.slideTabNumber}>{index + 1}</span>
            <span style={styles.slideTabInfo}>
              <span style={styles.slideTabTitle}>幻灯片 {index + 1}</span>
              <span style={styles.slideTabSize}>
                {slide.width} × {slide.height}
              </span>
            </span>
          </Button>
        ))}
      </div>
    </div>
  )
}
