import { LeftOutlined, RightOutlined } from '@ant-design/icons'
import { Button } from 'antd'
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
      <Button
        type='text'
        shape='circle'
        icon={<LeftOutlined />}
        style={{
          ...styles.floatingPagerActionButton,
          ...(isFirstSlide ? styles.floatingPagerActionButtonDisabled : {})
        }}
        onClick={onPrev}
        disabled={isFirstSlide}
        aria-label='上一页'
      />
      <Button
        type='text'
        style={{
          ...styles.floatingPagerPageButton,
          ...(shouldShowAnimationProgress ? styles.floatingPagerPageButtonWithProgress : {})
        }}
        onClick={() => onOpenPanel(side)}
      >
        <span style={styles.floatingPagerPageContent}>
          <span style={styles.floatingPagerValue}>{currentIndex + 1}/{totalSlides}</span>
          {shouldShowAnimationProgress && (
            <span style={styles.floatingPagerAnimationProgressText}>
              动画 {animationCurrentStep}/{animationTotalSteps}
            </span>
          )}
        </span>
      </Button>
      <Button
        type='text'
        shape='circle'
        icon={<RightOutlined />}
        style={{
          ...styles.floatingPagerActionButton,
          ...(isLastSlide ? styles.floatingPagerActionButtonDisabled : {})
        }}
        onClick={onNext}
        disabled={isLastSlide}
        aria-label='下一页'
      />
    </div>
  )
}
