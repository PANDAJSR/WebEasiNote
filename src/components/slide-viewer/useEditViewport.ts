import { useCallback, useEffect, useRef, useState } from 'react'

interface ViewportOffset {
  x: number
  y: number
}

interface UseEditViewportParams {
  slideId: string
  fitScale: number
  isEditMode: boolean
}

interface DragState {
  startClientX: number
  startClientY: number
  originOffset: ViewportOffset
  slideId: string
}

const MIN_EDIT_SCALE = 0.05
const MAX_EDIT_SCALE = 8
const WHEEL_ZOOM_IN_FACTOR = 1.1
const WHEEL_ZOOM_OUT_FACTOR = 1 / WHEEL_ZOOM_IN_FACTOR
const EDIT_MODE_DEFAULT_SCALE_RATIO = 0.95
const TRACKPAD_PINCH_SENSITIVITY = 0.01

function clampScale(scale: number): number {
  return Math.max(MIN_EDIT_SCALE, Math.min(MAX_EDIT_SCALE, scale))
}

function getSlideOffset(
  offsetMap: Record<string, ViewportOffset>,
  slideId: string
): ViewportOffset {
  return offsetMap[slideId] || { x: 0, y: 0 }
}

export function useEditViewport({
  slideId,
  fitScale,
  isEditMode
}: UseEditViewportParams) {
  const [scaleOverrideMap, setScaleOverrideMap] = useState<Record<string, number>>({})
  const [offsetMap, setOffsetMap] = useState<Record<string, ViewportOffset>>({})
  const [isMiddleDragging, setMiddleDragging] = useState(false)
  const dragStateRef = useRef<DragState | null>(null)

  const defaultScale = clampScale(fitScale * EDIT_MODE_DEFAULT_SCALE_RATIO)
  const currentScale = scaleOverrideMap[slideId] ?? defaultScale
  const currentOffset = getSlideOffset(offsetMap, slideId)
  const currentScaleRef = useRef(currentScale)
  const currentOffsetRef = useRef(currentOffset)

  useEffect(() => {
    currentScaleRef.current = currentScale
    currentOffsetRef.current = currentOffset
  }, [currentScale, currentOffset])

  const updateSlideOffset = useCallback((nextOffset: ViewportOffset) => {
    setOffsetMap(previous => ({
      ...previous,
      [slideId]: nextOffset
    }))
  }, [slideId])

  const applyWheelZoom = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    const liveScale = currentScaleRef.current
    const liveOffset = currentOffsetRef.current
    const pinchScaleFactor = Math.exp(-event.deltaY * TRACKPAD_PINCH_SENSITIVITY)
    const wheelScaleFactor = event.deltaY < 0 ? WHEEL_ZOOM_IN_FACTOR : WHEEL_ZOOM_OUT_FACTOR
    const scaleFactor = event.ctrlKey
      ? (
        Number.isFinite(pinchScaleFactor) && pinchScaleFactor > 0
          ? pinchScaleFactor
          : wheelScaleFactor
      )
      : wheelScaleFactor
    const nextScale = clampScale(liveScale * scaleFactor)
    if (Math.abs(nextScale - liveScale) < 0.0001) return

    const rect = event.currentTarget.getBoundingClientRect()
    const localX = event.clientX - rect.left
    const localY = event.clientY - rect.top
    const scaleRatio = nextScale / liveScale
    const nextOffset: ViewportOffset = {
      x: liveOffset.x + localX * (1 - scaleRatio),
      y: liveOffset.y + localY * (1 - scaleRatio)
    }

    currentScaleRef.current = nextScale
    currentOffsetRef.current = nextOffset
    setScaleOverrideMap(previous => ({
      ...previous,
      [slideId]: nextScale
    }))
    updateSlideOffset(nextOffset)
  }, [slideId, updateSlideOffset])

  const handleEditViewportWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    if (!isEditMode) return
    event.preventDefault()

    // 触摸板捏合通常会触发 ctrlKey=true 的 wheel 事件，双指移动则为普通 wheel 事件
    if (!event.ctrlKey) {
      updateSlideOffset({
        x: currentOffset.x - event.deltaX,
        y: currentOffset.y - event.deltaY
      })
      return
    }

    applyWheelZoom(event)
  }, [isEditMode, currentOffset, updateSlideOffset, applyWheelZoom])

  const handleEditViewportWheelZoomOnly = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    if (!isEditMode) return
    event.preventDefault()
    applyWheelZoom(event)
  }, [isEditMode, applyWheelZoom])

  const handleEditViewportMouseDown = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!isEditMode || event.button !== 1) return
    event.preventDefault()

    setMiddleDragging(true)
    dragStateRef.current = {
      startClientX: event.clientX,
      startClientY: event.clientY,
      originOffset: currentOffset,
      slideId
    }
  }, [isEditMode, currentOffset, slideId])

  const handleEditViewportAuxClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!isEditMode || event.button !== 1) return
    event.preventDefault()
  }, [isEditMode])

  useEffect(() => {
    if (!isMiddleDragging) return

    const handleMouseMove = (event: MouseEvent) => {
      const dragState = dragStateRef.current
      if (!dragState) return
      const deltaX = event.clientX - dragState.startClientX
      const deltaY = event.clientY - dragState.startClientY

      setOffsetMap(previous => ({
        ...previous,
        [dragState.slideId]: {
          x: dragState.originOffset.x + deltaX,
          y: dragState.originOffset.y + deltaY
        }
      }))
    }

    const handleMouseUp = (event: MouseEvent) => {
      if (event.button !== 1) return
      dragStateRef.current = null
      setMiddleDragging(false)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isMiddleDragging])

  useEffect(() => {
    if (isEditMode) return
    dragStateRef.current = null
    setMiddleDragging(false)
  }, [isEditMode])

  return {
    currentScale,
    currentOffset,
    isMiddleDragging,
    handleEditViewportWheel,
    handleEditViewportWheelZoomOnly,
    handleEditViewportMouseDown,
    handleEditViewportAuxClick
  }
}
