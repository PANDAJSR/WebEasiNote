import { useEffect } from 'react'
import type { SlideChangeSource } from '../Viewer'

interface UseSlideKeyboardNavigationParams {
  handlePrevSlide: (source?: SlideChangeSource) => void
  handleNextSlide: (source?: SlideChangeSource) => void
  isSlidePanelActive?: boolean
  handleCloseSlidePanel?: () => void
  annotationActive?: boolean
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tagName = target.tagName
  if (target.closest('[data-audio-control="true"], [data-subject-control="true"]')) return true
  return (
    tagName === 'INPUT'
    || tagName === 'TEXTAREA'
    || tagName === 'SELECT'
    || target.isContentEditable
  )
}

export function useSlideKeyboardNavigation({
  handlePrevSlide,
  handleNextSlide,
  isSlidePanelActive = false,
  handleCloseSlidePanel,
  annotationActive = false
}: UseSlideKeyboardNavigationParams) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return
      if (event.key === 'Escape' && isSlidePanelActive) {
        event.preventDefault()
        event.stopImmediatePropagation()
        handleCloseSlidePanel?.()
        return
      }
      if (annotationActive) return
      if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
        event.preventDefault()
        handlePrevSlide('keyboard')
        return
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
        event.preventDefault()
        handleNextSlide('keyboard')
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [handlePrevSlide, handleNextSlide, isSlidePanelActive, handleCloseSlidePanel, annotationActive])
}
