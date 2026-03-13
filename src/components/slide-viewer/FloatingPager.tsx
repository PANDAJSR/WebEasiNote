import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons'
import { styles } from '../../styles'

interface FloatingPagerProps {
  side: 'left' | 'right'
  isFirstSlide: boolean
  isLastSlide: boolean
  currentIndex: number
  totalSlides: number
  onPrev: () => void
  onNext: () => void
  onOpenPanel: (side: 'left' | 'right') => void
}

export function FloatingPager({
  side,
  isFirstSlide,
  isLastSlide,
  currentIndex,
  totalSlides,
  onPrev,
  onNext,
  onOpenPanel
}: FloatingPagerProps) {
  return (
    <div
      key={`pager-${side}`}
      style={{
        ...styles.floatingPagerContainer,
        ...(side === 'left'
          ? styles.floatingPagerContainerLeft
          : styles.floatingPagerContainerRight)
      }}
    >
      <button
        style={{
          ...styles.floatingPagerActionButton,
          ...(isFirstSlide ? styles.floatingPagerActionButtonDisabled : {})
        }}
        onClick={onPrev}
        disabled={isFirstSlide}
        aria-label='上一页'
      >
        <FontAwesomeIcon icon={faChevronLeft} style={styles.floatingPagerActionIcon} />
      </button>
      <button style={styles.floatingPagerPageButton} onClick={() => onOpenPanel(side)}>
        <span style={styles.floatingPagerValue}>{currentIndex + 1}/{totalSlides}</span>
      </button>
      <button
        style={{
          ...styles.floatingPagerActionButton,
          ...(isLastSlide ? styles.floatingPagerActionButtonDisabled : {})
        }}
        onClick={onNext}
        disabled={isLastSlide}
        aria-label='下一页'
      >
        <FontAwesomeIcon icon={faChevronRight} style={styles.floatingPagerActionIcon} />
      </button>
    </div>
  )
}
