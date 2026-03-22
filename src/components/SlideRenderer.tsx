import { useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import type { SlideData } from '../parser'
import { ElementRenderer } from './slide-renderer/ElementRenderer'

interface SlideRendererProps {
  slide: SlideData
  scale?: number
  resourceMap?: Record<string, string>
  slideIndex?: number
  currentIndex?: number
  elementDisplayStyles?: Record<string, CSSProperties>
  elementRenderStates?: Record<string, boolean>
  onElementClick?: (elementId: string) => boolean
  onEditElementDrag?: (elementId: string, nextX: number, nextY: number) => void
  onEditElementResize?: (elementId: string, nextX: number, nextY: number, nextWidth: number, nextHeight: number) => void
  isEditMode?: boolean
  selectedElementId?: string | null
}

interface DragState {
  elementId: string
  originX: number
  originY: number
  startClientX: number
  startClientY: number
  hasMoved: boolean
}
type ResizeHandleDirection = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'
interface ResizeState {
  elementId: string
  direction: ResizeHandleDirection
  originX: number
  originY: number
  originWidth: number
  originHeight: number
  startClientX: number
  startClientY: number
  hasMoved: boolean
}
/**
 * 幻灯片渲染器 - 使用 DOM 实现矢量渲染
 */
export function SlideRenderer({
  slide,
  scale = 1,
  resourceMap = {},
  slideIndex = 0,
  currentIndex = 0,
  elementDisplayStyles = {},
  elementRenderStates = {},
  onElementClick,
  onEditElementDrag,
  onEditElementResize,
  isEditMode = false,
  selectedElementId = null
}: SlideRendererProps) {
  const dragStateRef = useRef<DragState | null>(null)
  const resizeStateRef = useRef<ResizeState | null>(null)
  const isDraggingRef = useRef(false)
  const isResizingRef = useRef(false)
  const backgroundImageUrl = slide.backgroundImage ? resourceMap[slide.backgroundImage] : null
  const scaledWidth = slide.width * scale
  const scaledHeight = slide.height * scale
  const DRAG_START_THRESHOLD_PX = 3
  const MIN_ELEMENT_SIZE = 8
  const resolvePointElementId = (slideX: number, slideY: number): string | null => {
    for (let index = slide.elements.length - 1; index >= 0; index -= 1) {
      const element = slide.elements[index]
      if (elementRenderStates[element.id] === false) continue
      const styleOpacity = elementDisplayStyles[element.id]?.opacity
      if (typeof styleOpacity === 'number' && styleOpacity <= 0) continue
      if (!('x' in element) || !('y' in element) || !('width' in element) || !('height' in element)) continue
      const x = typeof element.x === 'number' ? element.x : NaN
      const y = typeof element.y === 'number' ? element.y : NaN
      const width = typeof element.width === 'number' ? element.width : NaN
      const height = typeof element.height === 'number' ? element.height : NaN
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || !Number.isFinite(height)) continue
      if (slideX >= x && slideX <= x + width && slideY >= y && slideY <= y + height) {
        return element.id
      }
    }
    return null
  }

  const resolveElementBounds = (
    element: SlideData['elements'][number]
  ): { x: number; y: number; width: number; height: number } => {
    const x = typeof element.x === 'number' && Number.isFinite(element.x) ? element.x : 0
    const y = typeof element.y === 'number' && Number.isFinite(element.y) ? element.y : 0
    const width = typeof element.width === 'number' && Number.isFinite(element.width)
      ? Math.max(1, element.width)
      : 1
    const height = typeof element.height === 'number' && Number.isFinite(element.height)
      ? Math.max(1, element.height)
      : 1
    return { x, y, width, height }
  }

  const clearDragState = () => {
    dragStateRef.current = null
    isDraggingRef.current = false
  }
  const clearResizeState = () => {
    resizeStateRef.current = null
    isResizingRef.current = false
  }

  useEffect(() => {
    if (!isEditMode || (!onEditElementDrag && !onEditElementResize)) {
      clearDragState()
      clearResizeState()
      return
    }
    const handleWindowMouseMove = (event: MouseEvent) => {
      const resizeState = resizeStateRef.current
      if (resizeState && onEditElementResize) {
        const rawDeltaX = event.clientX - resizeState.startClientX
        const rawDeltaY = event.clientY - resizeState.startClientY
        if (!resizeState.hasMoved) {
          const movedDistance = Math.hypot(rawDeltaX, rawDeltaY)
          if (movedDistance < DRAG_START_THRESHOLD_PX) return
          resizeState.hasMoved = true
          isResizingRef.current = true
          onElementClick?.(resizeState.elementId)
        }
        const deltaX = rawDeltaX / scale
        const deltaY = rawDeltaY / scale
        const affectsLeft = resizeState.direction.includes('w')
        const affectsRight = resizeState.direction.includes('e')
        const affectsTop = resizeState.direction.includes('n')
        const affectsBottom = resizeState.direction.includes('s')
        let nextX = resizeState.originX
        let nextY = resizeState.originY
        let nextWidth = resizeState.originWidth
        let nextHeight = resizeState.originHeight
        if (affectsLeft) {
          nextWidth = resizeState.originWidth - deltaX
          nextX = resizeState.originX + deltaX
        } else if (affectsRight) {
          nextWidth = resizeState.originWidth + deltaX
        }

        if (affectsTop) {
          nextHeight = resizeState.originHeight - deltaY
          nextY = resizeState.originY + deltaY
        } else if (affectsBottom) {
          nextHeight = resizeState.originHeight + deltaY
        }
        if (nextWidth < MIN_ELEMENT_SIZE) {
          if (affectsLeft) {
            nextX -= MIN_ELEMENT_SIZE - nextWidth
          }
          nextWidth = MIN_ELEMENT_SIZE
        }
        if (nextHeight < MIN_ELEMENT_SIZE) {
          if (affectsTop) {
            nextY -= MIN_ELEMENT_SIZE - nextHeight
          }
          nextHeight = MIN_ELEMENT_SIZE
        }
        onEditElementResize(resizeState.elementId, nextX, nextY, nextWidth, nextHeight)
        return
      }
      const dragState = dragStateRef.current
      if (!dragState || !onEditElementDrag) return
      const rawDeltaX = event.clientX - dragState.startClientX
      const rawDeltaY = event.clientY - dragState.startClientY
      if (!dragState.hasMoved) {
        const movedDistance = Math.hypot(rawDeltaX, rawDeltaY)
        if (movedDistance < DRAG_START_THRESHOLD_PX) return
        dragState.hasMoved = true
        isDraggingRef.current = true
        onElementClick?.(dragState.elementId)
      }
      const deltaX = rawDeltaX / scale
      const deltaY = rawDeltaY / scale
      onEditElementDrag(dragState.elementId, dragState.originX + deltaX, dragState.originY + deltaY)
    }
    const handleWindowMouseUp = (event: MouseEvent) => {
      if (event.button !== 0) return
      clearDragState()
      clearResizeState()
    }

    window.addEventListener('mousemove', handleWindowMouseMove)
    window.addEventListener('mouseup', handleWindowMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove)
      window.removeEventListener('mouseup', handleWindowMouseUp)
    }
  }, [isEditMode, onEditElementDrag, onEditElementResize, scale])
  const handleEditElementMouseDown = (
    element: SlideData['elements'][number],
    event: React.MouseEvent<HTMLDivElement>
  ) => {
    if (!isEditMode || !onEditElementDrag || event.button !== 0) return
    const { x, y } = resolveElementBounds(element)
    clearResizeState()
    dragStateRef.current = {
      elementId: element.id,
      originX: x,
      originY: y,
      startClientX: event.clientX,
      startClientY: event.clientY,
      hasMoved: false
    }
    event.stopPropagation()
    event.preventDefault()
  }
  const handleResizeHandleMouseDown = (
    element: SlideData['elements'][number],
    direction: ResizeHandleDirection,
    event: React.MouseEvent<HTMLDivElement>
  ) => {
    if (!isEditMode || !onEditElementResize || event.button !== 0) return
    const { x, y, width, height } = resolveElementBounds(element)
    clearDragState()
    resizeStateRef.current = {
      elementId: element.id,
      direction,
      originX: x,
      originY: y,
      originWidth: width,
      originHeight: height,
      startClientX: event.clientX,
      startClientY: event.clientY,
      hasMoved: false
    }
    event.stopPropagation()
    event.preventDefault()
  }
  const handleEditElementClick = (elementId: string) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false
      return
    }
    if (isResizingRef.current) {
      isResizingRef.current = false
      return
    }
    onElementClick?.(elementId)
  }
  const handleSlideClickCapture = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!onElementClick) return
    const rect = event.currentTarget.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return
    const slideX = (event.clientX - rect.left) / scale
    const slideY = (event.clientY - rect.top) / scale
    const clickedElementId = resolvePointElementId(slideX, slideY)
    if (!clickedElementId) return
    const isConsumed = onElementClick(clickedElementId)
    if (!isConsumed) return
    event.stopPropagation()
    event.preventDefault()
  }
  return (
    <div
      style={{
        position: 'relative',
        width: scaledWidth,
        height: scaledHeight,
        overflow: 'hidden',
        transformOrigin: 'top left',
        userSelect: 'none',
        WebkitUserSelect: 'none'
      }}
      onClickCapture={handleSlideClickCapture}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: slide.width,
          height: slide.height,
          backgroundColor: slide.backgroundColor,
          backgroundImage: backgroundImageUrl ? `url(${backgroundImageUrl})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          transform: `scale(${scale})`,
          transformOrigin: 'top left'
        }}
      >
        {slide.elements.map(element => {
          if (elementRenderStates[element.id] === false) return null
          const bounds = resolveElementBounds(element)
          return (
            <div
              key={element.id}
              data-slide-element='true'
              style={{
                position: 'absolute',
                left: bounds.x,
                top: bounds.y,
                width: bounds.width,
                height: bounds.height,
                overflow: 'visible',
                cursor: isEditMode ? 'move' : undefined,
                ...elementDisplayStyles[element.id]
              }}
              onMouseDown={event => handleEditElementMouseDown(element, event)}
              onClick={() => handleEditElementClick(element.id)}
            >
              <div
                style={{
                  position: 'absolute',
                  left: -bounds.x,
                  top: -bounds.y
                }}
              >
                <ElementRenderer
                  element={element}
                  scale={1}
                  resourceMap={resourceMap}
                  slideIndex={slideIndex}
                  currentIndex={currentIndex}
                />
              </div>
            </div>
          )
        })}
        {selectedElementId && (() => {
          const selectedElement = slide.elements.find(element => element.id === selectedElementId)
          if (!selectedElement) return null
          const bounds = resolveElementBounds(selectedElement)
          const resizeHandles: Array<{ key: ResizeHandleDirection; left: number; top: number; cursor: CSSProperties['cursor'] }> = [
            { key: 'nw', left: 0, top: 0, cursor: 'nwse-resize' },
            { key: 'n', left: bounds.width / 2, top: 0, cursor: 'ns-resize' },
            { key: 'ne', left: bounds.width, top: 0, cursor: 'nesw-resize' },
            { key: 'e', left: bounds.width, top: bounds.height / 2, cursor: 'ew-resize' },
            { key: 'se', left: bounds.width, top: bounds.height, cursor: 'nwse-resize' },
            { key: 's', left: bounds.width / 2, top: bounds.height, cursor: 'ns-resize' },
            { key: 'sw', left: 0, top: bounds.height, cursor: 'nesw-resize' },
            { key: 'w', left: 0, top: bounds.height / 2, cursor: 'ew-resize' }
          ]
          return (
            <div
              style={{
                position: 'absolute',
                left: bounds.x,
                top: bounds.y,
                width: bounds.width,
                height: bounds.height,
                boxSizing: 'border-box',
                outline: '2px solid #4a90e2',
                outlineOffset: '2px',
                borderRadius: '2px',
                pointerEvents: 'none',
                zIndex: 2147483647
              }}
            >
              {resizeHandles.map(handle => (
                <div
                  key={handle.key}
                  style={{
                    position: 'absolute',
                    left: handle.left,
                    top: handle.top,
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    border: '2px solid #1890ff',
                    backgroundColor: '#ffffff',
                    transform: 'translate(-50%, -50%)',
                    boxSizing: 'border-box',
                    pointerEvents: 'auto',
                    cursor: handle.cursor
                  }}
                  onMouseDown={event => handleResizeHandleMouseDown(selectedElement, handle.key, event)}
                />
              ))}
            </div>
          )
        })()}
      </div>
    </div>
  )
}
