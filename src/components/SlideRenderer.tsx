import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { SlideData, TextLine } from '../enbx/parser'
import { ElementRenderer } from './slide-renderer/ElementRenderer'
import { EditableTextOverlay } from './slide-renderer/EditableTextOverlay'
import type { TextSelectionRange, TextStyleCommand, TextStyleState } from './text-style-commands'
import { applyTextStyleCommand, resolveTextStyleState } from './text-style-editing'
import { useElementEditInteractions } from './slide-renderer/useElementEditInteractions'
import { getStaticPlan, isStaticRun } from '../rendering/staticPlan'
import { StaticRunLayer } from './slide-renderer/StaticRunLayer'
import { EditSelectionBox } from './slide-renderer/EditSelectionBox'
import { PlaybackSelectionOverlay } from './selection/PlaybackSelectionOverlay'
import type { PlaybackSelection } from '../viewer/usePlaybackSelection'
import { useActivityPlayback } from '../viewer/activities/useActivityPlayback'
import { ActivityControls } from './activities/ActivityControls'
import { MatchingActivity } from './activities/MatchingActivity'
import { QuestionActivity } from './activities/QuestionActivity'
import { CompetitionActivity } from './activities/CompetitionActivity'
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
  onEditAudioUpdate?: (elementId: string, edit: import('../viewer/audio-editing').AudioEdit) => void
  onEditTextStyleStateChange?: (state: TextStyleState | null) => void
  isEditMode?: boolean
  selectedElementId?: string | null
  textStyleCommand?: TextStyleCommand | null
  playbackSelection?: PlaybackSelection
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
  onEditAudioUpdate,
  onEditTextStyleStateChange,
  isEditMode = false,
  selectedElementId = null,
  textStyleCommand = null,
  playbackSelection
}: SlideRendererProps) {
  const [editingTextElementId, setEditingTextElementId] = useState<string | null>(null)
  const [draftTextLinesMap, setDraftTextLinesMap] = useState<Record<string, TextLine[]>>({})
  const [editingInjectedTextLinesMap, setEditingInjectedTextLinesMap] = useState<Record<string, TextLine[]>>({})
  const textSelectionRangeMapRef = useRef<Record<string, TextSelectionRange | null>>({})
  const appliedTextStyleCommandIdRef = useRef<number | null>(null)
  const backgroundImageUrl = slide.backgroundImage ? resourceMap[slide.backgroundImage] : null
  const scaledWidth = slide.width * scale
  const scaledHeight = slide.height * scale
  const [selectionPreview, setSelectionPreview] = useState<SlideData['elements'] | null>(null)
  const activity = useActivityPlayback(slide, scale, !isEditMode && !playbackSelection?.enabled
    && slideIndex === currentIndex, elementDisplayStyles, elementRenderStates)
  const renderItems = useMemo(() => isEditMode || playbackSelection?.enabled ? slide.elements : getStaticPlan(slide),
    [slide, isEditMode, playbackSelection?.enabled])
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
      onEditTextStyleStateChange?.(null)
    }
  }, [isEditMode, onEditTextStyleStateChange, slide.id])
  useEffect(() => {
    if (!selectedElementId) {
      setEditingTextElementId(null)
      setDraftTextLinesMap({})
      setEditingInjectedTextLinesMap({})
      textSelectionRangeMapRef.current = {}
      onEditTextStyleStateChange?.(null)
      return
    }
    if (editingTextElementId && selectedElementId !== editingTextElementId) {
      setEditingTextElementId(null)
      setDraftTextLinesMap({})
      setEditingInjectedTextLinesMap({})
      textSelectionRangeMapRef.current = {}
    }
  }, [editingTextElementId, onEditTextStyleStateChange, selectedElementId])
  useEffect(() => {
    if (!selectedElementId) return
    const targetElement = slide.elements.find(element => element.id === selectedElementId)
    if (!targetElement || targetElement.type !== 'text') {
      onEditTextStyleStateChange?.(null)
      return
    }
    const currentRange = textSelectionRangeMapRef.current[selectedElementId] || null
    const sourceLines = draftTextLinesMap[selectedElementId]
      || editingInjectedTextLinesMap[selectedElementId]
      || targetElement.textLines
    onEditTextStyleStateChange?.(resolveTextStyleState(sourceLines, currentRange))
  }, [
    draftTextLinesMap,
    editingInjectedTextLinesMap,
    onEditTextStyleStateChange,
    selectedElementId,
    slide.elements
  ])
  useEffect(() => {
    if (!textStyleCommand || !selectedElementId) return
    if (appliedTextStyleCommandIdRef.current === textStyleCommand.id) return
    appliedTextStyleCommandIdRef.current = textStyleCommand.id
    const targetElement = slide.elements.find(element => element.id === selectedElementId)
    if (!targetElement || targetElement.type !== 'text') return
    const sourceLines = draftTextLinesMap[selectedElementId]
      || editingInjectedTextLinesMap[selectedElementId]
      || targetElement.textLines
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
    onEditTextStyleStateChange?.(resolveTextStyleState(nextTextLines, selectionRange))
  }, [
    draftTextLinesMap,
    editingInjectedTextLinesMap,
    editingTextElementId,
    isEditMode,
    onEditTextUpdate,
    onEditTextStyleStateChange,
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
      onClickCapture={playbackSelection?.enabled && !isEditMode ? undefined : handleSlideClickCapture}
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
         {[...renderItems, ...(selectionPreview?.filter(element => !slide.elements.some(source => source.id === element.id)) || [])].flatMap(item => {
          if (isStaticRun(item)) {
            // 外部逐元素样式/可见性变化时回退，不能烘焙过期状态。
            const changed = item.elements.some(element => elementDisplayStyles[element.id]
              || elementRenderStates[element.id] !== undefined)
            if (!changed) return [<StaticRunLayer key={item.id} run={item} width={slide.width} height={slide.height} scale={scale} />]
          }
           return (isStaticRun(item) ? item.elements : [item]).map(sourceElement => {
             const element = selectionPreview?.find(preview => preview.id === sourceElement.id) || sourceElement
             const canvasActivity = !isEditMode && !playbackSelection?.enabled && slideIndex === currentIndex
               && element.type === 'activity' && slide.activities?.find(definition => definition.playable
                 && definition.id === element.activityId)
             if (canvasActivity && (canvasActivity.competition?.items.some(item => item.id === element.id)
               || canvasActivity.matching?.materials.some(item => item.id === element.id)
               || canvasActivity.matching?.stemId === element.id)) return null
            if (elementRenderStates[element.id] === false && element.type !== 'audio') return null
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
                data-element-id={element.id}
                {...activity.handlers(element)}
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
                  ...elementDisplayStyles[element.id],
                  ...(!isEditMode ? activity.style(element) : {})
                }}
                onMouseDown={event => handleEditElementMouseDown(element, event)}
                onClick={() => { if (isEditMode || element.type !== 'activity') handleEditElementClick(element.id) }}
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
                    visibility: hideReadOnlyTextLayer ? 'hidden' : undefined
                  }}
                >
                  <ElementRenderer
                    element={renderedElementWithEditingState}
                    scale={1}
                    resourceMap={resourceMap}
                    slideIndex={slideIndex}
                    currentIndex={currentIndex}
                    isEditMode={isEditMode}
                    onEditAudioUpdate={onEditAudioUpdate}
                    isVisible={elementRenderStates[element.id] !== false}
                    slideWidth={slide.width}
                    slideHeight={slide.height}
                  />
                </div>
                {isEditMode && canEditText && editingTextElementId === element.id && (
                  <EditableTextOverlay
                    textLines={overlayTextLines}
                    rotation={element.rotation || 0}
                    arrangingType={elementArrangingType}
                    externalSelectionRange={textSelectionRangeMapRef.current[element.id] || null}
                    onSelectionChange={range => {
                      textSelectionRangeMapRef.current[element.id] = range
                      if (element.type === 'text') {
                        const nextSourceLines = draftTextLinesMap[element.id]
                          || editingInjectedTextLinesMap[element.id]
                          || element.textLines
                        onEditTextStyleStateChange?.(resolveTextStyleState(nextSourceLines, range))
                      }
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
                      onEditTextStyleStateChange?.(null)
                      setEditingTextElementId(null)
                    }}
                    onLiveChange={nextTextLines => {
                      setDraftTextLinesMap(prev => ({
                        ...prev,
                        [element.id]: nextTextLines
                      }))
                      if (element.type === 'text') {
                        onEditTextStyleStateChange?.(
                          resolveTextStyleState(
                            nextTextLines,
                            textSelectionRangeMapRef.current[element.id] || null
                          )
                        )
                      }
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
                      onEditTextStyleStateChange?.(null)
                      setEditingTextElementId(null)
                    }}
                  />
                )}
              </div>
            )
          })
        })}
        {isEditMode && selectedElementId && (() => {
          const selectedElement = slide.elements.find(element => element.id === selectedElementId)
          if (!selectedElement) return null
          return (
            <EditSelectionBox element={selectedElement} handles={selectedResizeHandles} onResize={handleResizeHandleMouseDown} />
          )
        })()}
        {!isEditMode && !playbackSelection?.enabled && slideIndex === currentIndex && slide.activities?.filter(definition => definition.playable)
          .map(definition => definition.matching ? <MatchingActivity key={definition.id} definition={definition}
            elements={slide.elements} resourceMap={resourceMap} active={true} width={slide.width} height={slide.height} scale={scale} />
            : definition.competition ? <CompetitionActivity key={definition.id} definition={definition}
              elements={slide.elements} resourceMap={resourceMap} active={true} width={slide.width} height={slide.height} />
            : definition.questions ? <QuestionActivity key={definition.id} definition={definition} active={true} /> : null)}
      </div>
      {!isEditMode && playbackSelection?.enabled && <PlaybackSelectionOverlay key={slide.id}
        slide={slide} scale={scale} selection={playbackSelection} elementDisplayStyles={elementDisplayStyles}
        resourceMap={resourceMap}
        elementRenderStates={elementRenderStates} onPreview={setSelectionPreview} />}
      {!isEditMode && slideIndex === currentIndex && <ActivityControls playback={activity} paused={!!playbackSelection?.enabled} />}
    </div>
  )
}
