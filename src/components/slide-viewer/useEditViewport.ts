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

  const currentScale = scaleOverrideMap[slideId] ?? fitScale
  const currentOffset = getSlideOffset(offsetMap, slideId)

  const handleEditViewportWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    if (!isEditMode) return
    event.preventDefault()

    const nextScale = clampScale(
      currentScale * (event.deltaY < 0 ? WHEEL_ZOOM_IN_FACTOR : WHEEL_ZOOM_OUT_FACTOR)
    )
    if (Math.abs(nextScale - currentScale) < 0.0001) return

    const rect = event.currentTarget.getBoundingClientRect()
    const localX = event.clientX - rect.left
    const localY = event.clientY - rect.top
    const scaleRatio = nextScale / currentScale
    const nextOffset: ViewportOffset = {
      x: currentOffset.x + localX * (1 - scaleRatio),
      y: currentOffset.y + localY * (1 - scaleRatio)
    }

    setScaleOverrideMap(previous => ({
      ...previous,
      [slideId]: nextScale
    }))
    setOffsetMap(previous => ({
      ...previous,
      [slideId]: nextOffset
    }))
  }, [isEditMode, currentScale, currentOffset, slideId])

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
    handleEditViewportMouseDown,
    handleEditViewportAuxClick
  }
}
