import { useEffect, useLayoutEffect, useRef } from 'react'
import type { SlideChangeSource } from '../Viewer'

interface PageNavigationOptions {
  currentIndex: number
  pageCount: number
  isEditMode: boolean
  clearStepDirection: () => void
  stepForwardElementAnimation: () => boolean
  stepBackwardElementAnimation: () => boolean
  onSlideChange: (index: number, source?: SlideChangeSource) => void | Promise<void>
  navigationCommand?: { id: number; direction: 'previous' | 'next'; requestId: string } | null
  onNavigationResult?: (requestId: string, page: number) => void
}

export function usePageNavigation(options: PageNavigationOptions) {
  const { currentIndex, pageCount, isEditMode, clearStepDirection, stepForwardElementAnimation,
    stepBackwardElementAnimation, onSlideChange, navigationCommand, onNavigationResult } = options
  const pending = useRef<{ target: number; token: object } | null>(null)
  const localCommit = useRef<{ target: number; resolve: () => void; reject: (reason: Error) => void } | null>(null)

  useLayoutEffect(() => {
    if (localCommit.current?.target !== currentIndex) return
    localCommit.current.resolve()
    localCommit.current = null
  }, [currentIndex])
  useEffect(() => () => { localCommit.current?.reject(new Error('课件已关闭')) }, [])

  const navigatePage = async (target: number, source: SlideChangeSource) => {
    const token = {}
    pending.current = { target, token }
    localCommit.current?.reject(new Error('翻页已被替代'))
    localCommit.current = null
    try {
      const result = onSlideChange(target, source)
      if (result) await result
      else if (target !== currentIndex) {
        await new Promise<void>((resolve, reject) => { localCommit.current = { target, resolve, reject } })
      }
    } finally { if (pending.current?.token === token) pending.current = null }
  }

  const step = async (direction: 'previous' | 'next', source: SlideChangeSource) => {
    clearStepDirection()
    if (!pending.current && !isEditMode && (direction === 'next'
      ? stepForwardElementAnimation() : stepBackwardElementAnimation())) return currentIndex + 1
    const target = (pending.current?.target ?? currentIndex) + (direction === 'next' ? 1 : -1)
    if (target < 0 || target >= pageCount) return 0
    await navigatePage(target, source)
    return target + 1
  }

  useEffect(() => {
    if (!navigationCommand) return
    void step(navigationCommand.direction, 'pager').then(
      page => onNavigationResult?.(navigationCommand.requestId, page),
      () => onNavigationResult?.(navigationCommand.requestId, 0))
  }, [navigationCommand?.id])

  return {
    handlePrevSlide: (source: SlideChangeSource = 'pager') => { void step('previous', source).catch(() => undefined) },
    handleNextSlide: (source: SlideChangeSource = 'pager') => { void step('next', source).catch(() => undefined) },
    navigatePage
  }
}
