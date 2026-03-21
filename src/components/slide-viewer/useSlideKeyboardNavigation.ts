import { useEffect } from 'react'
import type { SlideChangeSource } from '../Viewer'

interface UseSlideKeyboardNavigationParams {
  handlePrevSlide: (source?: SlideChangeSource) => void
  handleNextSlide: (source?: SlideChangeSource) => void
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tagName = target.tagName
  return (
    tagName === 'INPUT'
    || tagName === 'TEXTAREA'
    || tagName === 'SELECT'
    || target.isContentEditable
  )
}

export function useSlideKeyboardNavigation({
  handlePrevSlide,
  handleNextSlide
}: UseSlideKeyboardNavigationParams) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return
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

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handlePrevSlide, handleNextSlide])
}
