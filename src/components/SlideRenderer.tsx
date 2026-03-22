import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { SlideData, TextLine } from '../parser'
import { ElementRenderer } from './slide-renderer/ElementRenderer'
import { EditableTextOverlay } from './slide-renderer/EditableTextOverlay'
import type { TextSelectionRange, TextStyleCommand } from './text-style-commands'
import { applyTextStyleCommand } from './text-style-editing'
import { useElementEditInteractions } from './slide-renderer/useElementEditInteractions'

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
  onEditTextUpdate?: (elementId: string, nextTextLines: TextLine[]) => void
  isEditMode?: boolean
  selectedElementId?: string | null
  textStyleCommand?: TextStyleCommand | null
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
  onEditTextUpdate,
  isEditMode = false,
  selectedElementId = null,
  textStyleCommand = null
}: SlideRendererProps) {
  const [editingTextElementId, setEditingTextElementId] = useState<string | null>(null)
  const [draftTextLinesMap, setDraftTextLinesMap] = useState<Record<string, TextLine[]>>({})
  const [editingInjectedTextLinesMap, setEditingInjectedTextLinesMap] = useState<Record<string, TextLine[]>>({})
  const textSelectionRangeMapRef = useRef<Record<string, TextSelectionRange | null>>({})
  const appliedTextStyleCommandIdRef = useRef<number | null>(null)
  const backgroundImageUrl = slide.backgroundImage ? resourceMap[slide.backgroundImage] : null
  const scaledWidth = slide.width * scale
  const scaledHeight = slide.height * scale
  const {
    resolveElementBounds,
    handleEditElementMouseDown,
    handleResizeHandleMouseDown,
    handleEditElementClick,
    handleSlideClickCapture,
    selectedResizeHandles
  } = useElementEditInteractions({
    slide,
    scale,
    isEditMode,
    editingTextElementId,
    elementDisplayStyles,
    elementRenderStates,
    onElementClick,
    onEditElementDrag,
    onEditElementResize
  })

  useEffect(() => {
    if (!isEditMode) {
      setEditingTextElementId(null)
      setDraftTextLinesMap({})
      setEditingInjectedTextLinesMap({})
      textSelectionRangeMapRef.current = {}
    }
  }, [isEditMode, slide.id])

  useEffect(() => {
    if (!selectedElementId) {
      setEditingTextElementId(null)
      setDraftTextLinesMap({})
      setEditingInjectedTextLinesMap({})
      textSelectionRangeMapRef.current = {}
      return
    }
    if (editingTextElementId && selectedElementId !== editingTextElementId) {
      setEditingTextElementId(null)
      setDraftTextLinesMap({})
      setEditingInjectedTextLinesMap({})
      textSelectionRangeMapRef.current = {}
    }
  }, [editingTextElementId, selectedElementId])

  useEffect(() => {
    if (!textStyleCommand || !selectedElementId) return
    if (appliedTextStyleCommandIdRef.current === textStyleCommand.id) return
    appliedTextStyleCommandIdRef.current = textStyleCommand.id

    const targetElement = slide.elements.find(element => element.id === selectedElementId)
    if (!targetElement || (targetElement.type !== 'text' && targetElement.type !== 'shape')) return
    const sourceLines = draftTextLinesMap[selectedElementId]
      || editingInjectedTextLinesMap[selectedElementId]
      || (targetElement.type === 'text' ? targetElement.textLines : (targetElement.inlineText || []))
    if (sourceLines.length === 0) return

    const isEditingCurrentElement = isEditMode && editingTextElementId === selectedElementId
    const selectionRange = isEditingCurrentElement
      ? textSelectionRangeMapRef.current[selectedElementId]
      : null
    const nextTextLines = applyTextStyleCommand(sourceLines, textStyleCommand, selectionRange)

    setDraftTextLinesMap(prev => ({
      ...prev,
      [selectedElementId]: nextTextLines
    }))

    if (isEditingCurrentElement) {
      setEditingInjectedTextLinesMap(prev => ({
        ...prev,
        [selectedElementId]: nextTextLines
      }))
    }

    onEditTextUpdate?.(selectedElementId, nextTextLines)
  }, [
    draftTextLinesMap,
    editingInjectedTextLinesMap,
    editingTextElementId,
    isEditMode,
    onEditTextUpdate,
    selectedElementId,
    slide.elements,
    textStyleCommand
  ])

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
          const draftTextLines = draftTextLinesMap[element.id]
          const injectedEditingTextLines = editingInjectedTextLinesMap[element.id]
          const isEditingCurrentElement = isEditMode && editingTextElementId === element.id
          const renderedElement = (() => {
            if (!draftTextLines) return element
            if (element.type === 'text') {
              return { ...element, textLines: draftTextLines }
            }
            if (element.type === 'shape') {
              return { ...element, inlineText: draftTextLines }
            }
            return element
          })()
          const renderedElementWithEditingState = (() => {
            if (!isEditingCurrentElement) return renderedElement
            // 编辑形状文本时保留形状本体，仅隐藏形状原文本，避免出现“白底遮挡”观感
            if (renderedElement.type === 'shape') {
              return { ...renderedElement, inlineText: [] }
            }
            return renderedElement
          })()
          const hideReadOnlyTextLayer = isEditMode
            && element.type === 'text'
            && editingTextElementId === element.id
          const canEditText = element.type === 'text' || element.type === 'shape'
          const elementTextLines = element.type === 'text'
            ? element.textLines
            : (element.type === 'shape' ? (element.inlineText || []) : [])
          const overlayTextLines = injectedEditingTextLines || elementTextLines
          const elementArrangingType = element.type === 'text'
            ? element.arrangingType
            : 'Horizontal'
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
                cursor: isEditMode
                  ? canEditText && editingTextElementId === element.id
                    ? 'text'
                    : 'move'
                  : undefined,
                ...elementDisplayStyles[element.id]
              }}
              onMouseDown={event => handleEditElementMouseDown(element, event)}
              onClick={() => handleEditElementClick(element.id)}
              onDoubleClick={event => {
                if (!isEditMode || !canEditText) return
                event.stopPropagation()
                event.preventDefault()
                onElementClick?.(element.id)
                setEditingTextElementId(element.id)
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  left: -bounds.x,
                  top: -bounds.y,
                  visibility: hideReadOnlyTextLayer ? 'hidden' : 'visible'
                }}
              >
                <ElementRenderer
                  element={renderedElementWithEditingState}
                  scale={1}
                  resourceMap={resourceMap}
                  slideIndex={slideIndex}
                  currentIndex={currentIndex}
                />
              </div>
              {isEditMode && canEditText && editingTextElementId === element.id && (
                <EditableTextOverlay
                  textLines={overlayTextLines}
                  rotation={element.rotation || 0}
                  arrangingType={elementArrangingType}
                  onSelectionChange={range => {
                    textSelectionRangeMapRef.current[element.id] = range
                  }}
                  onCancel={() => {
                    setDraftTextLinesMap(prev => {
                      if (!prev[element.id]) return prev
                      const next = { ...prev }
                      delete next[element.id]
                      return next
                    })
                    setEditingInjectedTextLinesMap(prev => {
                      if (!prev[element.id]) return prev
                      const next = { ...prev }
                      delete next[element.id]
                      return next
                    })
                    delete textSelectionRangeMapRef.current[element.id]
                    setEditingTextElementId(null)
                  }}
                  onLiveChange={nextTextLines => {
                    setDraftTextLinesMap(prev => ({
                      ...prev,
                      [element.id]: nextTextLines
                    }))
                  }}
                  onCommit={nextTextLines => {
                    setDraftTextLinesMap(prev => {
                      if (!prev[element.id]) return prev
                      const next = { ...prev }
                      delete next[element.id]
                      return next
                    })
                    setEditingInjectedTextLinesMap(prev => {
                      if (!prev[element.id]) return prev
                      const next = { ...prev }
                      delete next[element.id]
                      return next
                    })
                    delete textSelectionRangeMapRef.current[element.id]
                    onEditTextUpdate?.(element.id, nextTextLines)
                    setEditingTextElementId(null)
                  }}
                />
              )}
            </div>
          )
        })}
        {selectedElementId && (() => {
          const selectedElement = slide.elements.find(element => element.id === selectedElementId)
          if (!selectedElement) return null
          const bounds = resolveElementBounds(selectedElement)
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
              {selectedResizeHandles.map(handle => (
                <div
                  key={handle.key}
                  style={{
                    position: 'absolute',
                    left: bounds.width * handle.left,
                    top: bounds.height * handle.top,
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
