import { useCallback, useEffect, useRef, useState } from 'react'
import { SLIDE_PANEL_ANIMATION_MS, type SlidePanelAnchorSide } from './constants'

export function useSlidePanel() {
  const [isSlidePanelOpen, setSlidePanelOpen] = useState(false)
  const [isSlidePanelRendered, setSlidePanelRendered] = useState(false)
  const [isSlidePanelActive, setSlidePanelActive] = useState(false)
  const [slidePanelAnchorSide, setSlidePanelAnchorSide] = useState<SlidePanelAnchorSide>('right')
  const slidePanelExitTimerRef = useRef<number | null>(null)
  const slidePanelEnterRafRef = useRef<number | null>(null)
  const slidePanelEnterRafInnerRef = useRef<number | null>(null)

  const handleToggleSlidePanel = useCallback((side: SlidePanelAnchorSide) => {
    if (isSlidePanelOpen && slidePanelAnchorSide === side) {
      setSlidePanelOpen(false)
      return
    }
    setSlidePanelAnchorSide(side)
    setSlidePanelOpen(true)
  }, [isSlidePanelOpen, slidePanelAnchorSide])

  const handleCloseSlidePanel = useCallback(() => {
    setSlidePanelOpen(false)
  }, [])

  useEffect(() => {
    if (slidePanelExitTimerRef.current !== null) {
      window.clearTimeout(slidePanelExitTimerRef.current)
      slidePanelExitTimerRef.current = null
    }
    if (slidePanelEnterRafRef.current !== null) {
      window.cancelAnimationFrame(slidePanelEnterRafRef.current)
      slidePanelEnterRafRef.current = null
    }
    if (slidePanelEnterRafInnerRef.current !== null) {
      window.cancelAnimationFrame(slidePanelEnterRafInnerRef.current)
      slidePanelEnterRafInnerRef.current = null
    }

    if (isSlidePanelOpen) {
      setSlidePanelRendered(true)
      slidePanelEnterRafRef.current = window.requestAnimationFrame(() => {
        slidePanelEnterRafInnerRef.current = window.requestAnimationFrame(() => {
          setSlidePanelActive(true)
          slidePanelEnterRafInnerRef.current = null
        })
        slidePanelEnterRafRef.current = null
      })
      return
    }

    setSlidePanelActive(false)
    if (!isSlidePanelRendered) return
    slidePanelExitTimerRef.current = window.setTimeout(() => {
      setSlidePanelRendered(false)
      slidePanelExitTimerRef.current = null
    }, SLIDE_PANEL_ANIMATION_MS)
  }, [isSlidePanelOpen, isSlidePanelRendered])

  useEffect(() => {
    return () => {
      if (slidePanelExitTimerRef.current !== null) {
        window.clearTimeout(slidePanelExitTimerRef.current)
      }
      if (slidePanelEnterRafRef.current !== null) {
        window.cancelAnimationFrame(slidePanelEnterRafRef.current)
      }
      if (slidePanelEnterRafInnerRef.current !== null) {
        window.cancelAnimationFrame(slidePanelEnterRafInnerRef.current)
      }
    }
  }, [])

  return {
    isSlidePanelRendered,
    isSlidePanelActive,
    slidePanelAnchorSide,
    handleToggleSlidePanel,
    handleCloseSlidePanel
  }
}
