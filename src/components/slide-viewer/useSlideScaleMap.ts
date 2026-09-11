import { useCallback, useEffect, useRef, useState } from 'react'
import type { SlideData } from '../../parser'
import { slideInfoBarHeight } from './constants'

/**
 * 计算每页幻灯片的适配缩放。
 * reservedHeight 为底部信息条预留的高度；宿主内嵌全屏播放时传 0，
 * 让画面按窗口完整铺满，避免比例一致时仍出现四周黑边。
 */
export function useSlideScaleMap(slides: SlideData[], reservedHeight = slideInfoBarHeight) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [slideScaleMap, setSlideScaleMap] = useState<Record<string, number>>({})

  const calculateSlideScaleMap = useCallback(() => {
    if (!containerRef.current) return

    const container = containerRef.current
    const computedStyle = window.getComputedStyle(container)
    const paddingLeft = parseFloat(computedStyle.paddingLeft) || 0
    const paddingRight = parseFloat(computedStyle.paddingRight) || 0
    const paddingTop = parseFloat(computedStyle.paddingTop) || 0
    const paddingBottom = parseFloat(computedStyle.paddingBottom) || 0
    const containerWidth = Math.max(0, container.clientWidth - paddingLeft - paddingRight)
    const containerHeight = Math.max(
      0,
      container.clientHeight - paddingTop - paddingBottom - reservedHeight
    )

    const nextScaleMap: Record<string, number> = {}
    slides.forEach(slideItem => {
      const scaleX = containerWidth / slideItem.width
      const scaleY = containerHeight / slideItem.height
      nextScaleMap[slideItem.id] = Math.max(0, Math.min(scaleX, scaleY))
    })
    setSlideScaleMap(nextScaleMap)
  }, [slides, reservedHeight])

  useEffect(() => {
    calculateSlideScaleMap()

    const handleResize = () => {
      calculateSlideScaleMap()
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [calculateSlideScaleMap])

  return {
    containerRef,
    slideScaleMap
  }
}
