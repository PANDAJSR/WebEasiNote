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
  showAnimationProgress: boolean
  animationCurrentStep: number
  animationTotalSteps: number
}

export function FloatingPager({
  side,
  isFirstSlide,
  isLastSlide,
  currentIndex,
  totalSlides,
  onPrev,
  onNext,
  onOpenPanel,
  showAnimationProgress,
  animationCurrentStep,
  animationTotalSteps
}: FloatingPagerProps) {
  const shouldShowAnimationProgress = showAnimationProgress && animationTotalSteps > 0
  const animationProgressRatio = shouldShowAnimationProgress
    ? Math.min(1, Math.max(0, animationCurrentStep / animationTotalSteps))
    : 0

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
      <button
        style={{
          ...styles.floatingPagerPageButton,
          ...(shouldShowAnimationProgress ? styles.floatingPagerPageButtonWithProgress : {})
        }}
        onClick={() => onOpenPanel(side)}
      >
        <span style={styles.floatingPagerPageContent}>
          <span style={styles.floatingPagerValue}>{currentIndex + 1}/{totalSlides}</span>
          {shouldShowAnimationProgress && (
            <span style={styles.floatingPagerAnimationProgressWrap}>
              <span style={styles.floatingPagerAnimationProgressText}>
                动画 {animationCurrentStep}/{animationTotalSteps}
              </span>
              <span style={styles.floatingPagerAnimationProgressTrack}>
                <span
                  style={{
                    ...styles.floatingPagerAnimationProgressFill,
                    width: `${animationProgressRatio * 100}%`
                  }}
                />
              </span>
            </span>
          )}
        </span>
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
