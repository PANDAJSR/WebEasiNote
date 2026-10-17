import { useEffect, useRef } from 'react'
import type { SlideChangeSource } from '../Viewer'

interface UseSlideSwipeNavigationParams {
  containerRef: React.RefObject<HTMLDivElement | null>
  isEditMode: boolean
  isSlidePanelActive?: boolean
  enabled?: boolean
  handlePrevSlide: (source?: SlideChangeSource) => void
  handleNextSlide: (source?: SlideChangeSource) => void
}

interface PointerSample {
  x: number
  y: number
  time: number
}

/** 触发滑动的最小水平位移（像素），过滤细微抖动或点击 */
const MIN_SWIPE_DISTANCE = 40

/** 触发滑动的最小速度阈值（像素/毫秒，即 300px/s），匹配 PowerPoint 快速甩动翻页体验 */
const MIN_SWIPE_VELOCITY = 0.3

/** 水平位移相对垂直位移的最小比例，确保水平滑动占主导 */
const HORIZONTAL_DOMINANCE_RATIO = 1.25

/** 计算瞬时滑动速度的采样时间窗口（毫秒） */
const VELOCITY_SAMPLE_WINDOW_MS = 120

/** 松手前静止停顿时间上限（毫秒）；若停顿超过此时间，视为放弃甩动 */
const MAX_STATIONARY_RELEASE_MS = 100

/**
 * 判断事件目标是否为可交互控件（视频、音频、按钮、输入框、超链接等）
 */
function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return Boolean(
    target.closest(
      'video, audio, input, textarea, select, button, a, [data-slide-panel="true"], [data-prevent-swipe="true"]'
    )
  )
}

/**
 * 监听幻灯片容器的鼠标或触屏拖拽/滑动，达到一定速度时触发翻页（类似 PowerPoint 的滑动翻页逻辑）。
 *
 * - 向左滑动（dx < 0）：翻至下一页 / 下一动画（handleNextSlide）
 * - 向右滑动（dx > 0）：翻至上一页 / 上一动画（handlePrevSlide）
 * - 滑动或明显拖拽后自动拦截并阻止触发单击翻页（click-to-next）与元素单击事件
 */
export function useSlideSwipeNavigation({
  containerRef,
  isEditMode,
  isSlidePanelActive = false,
  enabled = true,
  handlePrevSlide,
  handleNextSlide
}: UseSlideSwipeNavigationParams) {
  const activePointerIdRef = useRef<number | null>(null)
  const startXRef = useRef(0)
  const startYRef = useRef(0)
  const startTimeRef = useRef(0)
  const hasMovedRef = useRef(false)
  const pointerHistoryRef = useRef<PointerSample[]>([])
  const preventClickRef = useRef(false)
  const preventClickTimerRef = useRef<number | null>(null)

  const handlePrevSlideRef = useRef(handlePrevSlide)
  const handleNextSlideRef = useRef(handleNextSlide)
  handlePrevSlideRef.current = handlePrevSlide
  handleNextSlideRef.current = handleNextSlide

  useEffect(() => {
    const container = containerRef.current
    if (!container || !enabled || isEditMode) return

    const clearClickPreventionTimer = () => {
      if (preventClickTimerRef.current !== null) {
        window.clearTimeout(preventClickTimerRef.current)
        preventClickTimerRef.current = null
      }
    }

    const setClickPrevention = () => {
      clearClickPreventionTimer()
      preventClickRef.current = true
      // 设置保底定时器，若未捕获到 click 则在 200ms 后自动解除拦截
      preventClickTimerRef.current = window.setTimeout(() => {
        preventClickRef.current = false
        preventClickTimerRef.current = null
      }, 200)
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerId !== activePointerIdRef.current) return
      const now = performance.now()
      const currentX = event.clientX
      const currentY = event.clientY

      const dxFromStart = currentX - startXRef.current
      const dyFromStart = currentY - startYRef.current
      if (Math.abs(dxFromStart) > 8 || Math.abs(dyFromStart) > 8) {
        hasMovedRef.current = true
      }

      pointerHistoryRef.current.push({ x: currentX, y: currentY, time: now })
      const cutoffTime = now - VELOCITY_SAMPLE_WINDOW_MS
      pointerHistoryRef.current = pointerHistoryRef.current.filter(p => p.time >= cutoffTime)
    }

    const handlePointerUp = (event: PointerEvent) => {
      if (event.pointerId !== activePointerIdRef.current) return
      activePointerIdRef.current = null
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerCancel)

      const now = performance.now()
      const totalDx = event.clientX - startXRef.current
      const totalDy = event.clientY - startYRef.current
      const distX = Math.abs(totalDx)
      const distY = Math.abs(totalDy)

      const history = pointerHistoryRef.current
      const lastPoint = history[history.length - 1]
      const timeSinceLastMove = lastPoint ? now - lastPoint.time : 0

      // 计算释放瞬时速度
      let releaseVelocity = 0
      let releaseDx = totalDx
      if (timeSinceLastMove <= MAX_STATIONARY_RELEASE_MS && history.length > 0) {
        const anchorSample = history[0]
        const dt = now - anchorSample.time
        releaseDx = event.clientX - anchorSample.x
        releaseVelocity = dt > 0 ? Math.abs(releaseDx) / dt : 0
      }

      // 计算全过程平均速度
      const totalDt = now - startTimeRef.current
      const totalVelocity = totalDt > 0 ? distX / totalDt : 0
      const effectiveVelocity = Math.max(releaseVelocity, totalVelocity)

      // 判断是否满足 PowerPoint 式水平快速滑动翻页条件
      const isHorizontalDominant = distX >= MIN_SWIPE_DISTANCE && distX > distY * HORIZONTAL_DOMINANCE_RATIO
      const isSpeedSufficient = effectiveVelocity >= MIN_SWIPE_VELOCITY
      const isConsistentDirection = Math.sign(totalDx) === Math.sign(releaseDx)

      if (isHorizontalDominant && isSpeedSufficient && isConsistentDirection) {
        setClickPrevention()
        if (totalDx < 0) {
          // 向左滑动 -> 下一页 / 下一动画
          handleNextSlideRef.current('swipe')
        } else {
          // 向右滑动 -> 上一页 / 上一动画
          handlePrevSlideRef.current('swipe')
        }
      } else if (hasMovedRef.current || distX > 10 || distY > 10) {
        // 虽然速度未达到翻页阈值，但用户发生了拖拽，拦截可能产生的误触点击
        setClickPrevention()
      }
    }

    const handlePointerCancel = (event: PointerEvent) => {
      if (event.pointerId !== activePointerIdRef.current) return
      activePointerIdRef.current = null
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerCancel)
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (isSlidePanelActive) return
      // 仅响应鼠标左键或触摸/手写笔
      if (event.pointerType === 'mouse' && event.button !== 0) return
      if (isInteractiveTarget(event.target)) return

      activePointerIdRef.current = event.pointerId
      startXRef.current = event.clientX
      startYRef.current = event.clientY
      startTimeRef.current = performance.now()
      hasMovedRef.current = false
      pointerHistoryRef.current = [{ x: event.clientX, y: event.clientY, time: startTimeRef.current }]

      window.addEventListener('pointermove', handlePointerMove, { passive: true })
      window.addEventListener('pointerup', handlePointerUp, { passive: true })
      window.addEventListener('pointercancel', handlePointerCancel, { passive: true })
    }

    // 捕获阶段拦截点击事件，防止滑动后触发背景单击翻页或元素点击
    const handleClickCapture = (event: MouseEvent) => {
      if (preventClickRef.current) {
        event.stopPropagation()
        event.preventDefault()
        preventClickRef.current = false
        clearClickPreventionTimer()
      }
    }

    container.addEventListener('pointerdown', handlePointerDown)
    container.addEventListener('click', handleClickCapture, true)

    return () => {
      clearClickPreventionTimer()
      container.removeEventListener('pointerdown', handlePointerDown)
      container.removeEventListener('click', handleClickCapture, true)
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerCancel)
    }
  }, [containerRef, enabled, isEditMode, isSlidePanelActive])
}
