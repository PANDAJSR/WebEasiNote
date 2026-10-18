import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Modal } from 'antd'
import { styles } from '../styles'
import { SlideViewer } from './SlideViewer'
import { SlideThumbnail } from './slide-viewer/SlideThumbnail'
import { ElementXmlPanel } from './ElementXmlPanel'
import type { CoursewareMetadata, SlideData, SlideElement, TextLine } from '../parser'
import { collectMissingFontIssues } from '../viewer-font-issues'
import { ViewerIssuesModal } from './ViewerIssuesModal'
import type { PagerPosition } from '../viewer-settings'
import type { TextStyleAction, TextStyleState } from './text-style-commands'
import {
  parseSingleElementXml,
  syncElementBoundsXml,
  syncElementPositionXml,
  syncTextElementContentXml
} from './viewer-xml-sync'

export type SlideChangeSource = 'keyboard' | 'pager' | 'thumbnail' | 'programmatic' | 'click' | 'swipe'

type ViewerMode = 'play' | 'edit'

interface ViewerProps {
  onSaveAs: (editedElements: Record<string, SlideElement>) => Promise<void>
  metadata: CoursewareMetadata
  slides: SlideData[]
  currentIndex: number
  onSlideChange: (index: number, source?: SlideChangeSource) => void
  slideChangeSource: SlideChangeSource
  onClear: () => void
  resourceMap?: Record<string, string>
  clickToNextEnabled: boolean
  pagerPosition: PagerPosition
  showAnimationProgress: boolean
  hidePager?: boolean
  /** 宿主内嵌全屏播放时隐藏顶部工具栏。 */
  hideToolbar?: boolean
  /** 底部信息条预留高度；宿主内嵌全屏播放传 0，让画面铺满整屏。 */
  infoBarHeight?: number
  toggleThumbnailsCommand?: { side: 'left' | 'right'; id: number } | null
  navigationCommand?: { id: number; direction: 'previous' | 'next'; requestId: string } | null
  onNavigationResult?: (requestId: string, page: number) => void
  swipeNavigationEnabled?: boolean
}

export function Viewer({
  metadata,
  slides,
  currentIndex,
  onSlideChange,
  slideChangeSource,
  onClear,
  resourceMap = {},
  clickToNextEnabled,
  pagerPosition,
  showAnimationProgress,
  hidePager = false,
  hideToolbar = false,
  infoBarHeight,
  onSaveAs,
  toggleThumbnailsCommand = null,
  navigationCommand = null,
  onNavigationResult,
  swipeNavigationEnabled = true
}: ViewerProps) {
  const [isIssueModalOpen, setIssueModalOpen] = useState(false)
  const [fontCheckTick, setFontCheckTick] = useState(0)
  const [viewerMode, setViewerMode] = useState<ViewerMode>('play')
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null)
  const [selectedElementXml, setSelectedElementXml] = useState('')
  const [selectedElementXmlError, setSelectedElementXmlError] = useState<string | null>(null)
  const [editedElements, setEditedElements] = useState<Record<string, SlideElement>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [textStyleCommandSeq, setTextStyleCommandSeq] = useState(0)
  const [textStyleCommand, setTextStyleCommand] = useState<TextStyleAction & { id: number } | null>(null)
  const [liveTextStyleState, setLiveTextStyleState] = useState<TextStyleState | null>(null)
  const selectedElementIdRef = useRef<string | null>(null)
  const currentSlideIdRef = useRef<string>('')

  const resolvedSlides = useMemo(() => {
    if (Object.keys(editedElements).length === 0) return slides
    return slides.map(slide => {
      const resolvedElements = slide.elements.map(element => {
        const key = `${slide.id}|${element.id}`
        return editedElements[key] || element
      })
      return {
        ...slide,
        elements: resolvedElements
      }
    })
  }, [slides, editedElements])

  const currentSlide = resolvedSlides[currentIndex]
  selectedElementIdRef.current = selectedElementId
  currentSlideIdRef.current = currentSlide.id

  useEffect(() => {
    if (typeof document === 'undefined' || !document.fonts) return
    const handleFontStateChange = () => setFontCheckTick(tick => tick + 1)
    document.fonts.ready.then(handleFontStateChange).catch(() => undefined)
    document.fonts.addEventListener('loadingdone', handleFontStateChange)
    document.fonts.addEventListener('loadingerror', handleFontStateChange)
    return () => {
      document.fonts.removeEventListener('loadingdone', handleFontStateChange)
      document.fonts.removeEventListener('loadingerror', handleFontStateChange)
    }
  }, [])

  const missingFontIssues = useMemo(() => {
    return collectMissingFontIssues(resolvedSlides)
  }, [resolvedSlides, fontCheckTick])

  const allIssues = useMemo(() => {
    return [...resolvedSlides.flatMap(slide => slide.issues || []), ...missingFontIssues]
  }, [resolvedSlides, missingFontIssues])

  const issueCount = allIssues.length
  const issueButtonText = issueCount > 0 ? `问题 (${issueCount})` : '问题'
  const isEditMode = viewerMode === 'edit'

  const selectedElement = useMemo(() => {
    if (!selectedElementId) return null
    return currentSlide.elements.find(element => element.id === selectedElementId) || null
  }, [currentSlide.elements, selectedElementId])
  const selectedTextStyleState = useMemo<TextStyleState | null>(() => {
    if (!selectedElement || selectedElement.type !== 'text') return null
    const textLines = selectedElement.textLines
    const firstRun = textLines.flatMap(line => line.textRuns).find(run => run.text.length > 0)
      || textLines[0]?.textRuns[0]
    if (!firstRun) return null
    return {
      fontFamily: firstRun.fontFamily || 'Arial',
      fontSize: Number.isFinite(firstRun.fontSize) ? firstRun.fontSize : 16,
      color: firstRun.color || '#000000',
      isBold: firstRun.fontWeight === 'bold',
      isItalic: firstRun.fontStyle === 'italic',
      isUnderline: firstRun.decoration === 'Underline'
    }
  }, [selectedElement])
  const currentSlideXml = currentSlide.rawXml || ''
  const panelTextStyleState = liveTextStyleState || selectedTextStyleState

  const clearSelectedElement = () => {
    selectedElementIdRef.current = null
    setSelectedElementId(null)
    setSelectedElementXml('')
    setSelectedElementXmlError(null)
    setLiveTextStyleState(null)
  }

  useEffect(() => {
    clearSelectedElement()
  }, [currentSlide.id])

  useEffect(() => {
    if (!isEditMode) {
      clearSelectedElement()
    }
  }, [isEditMode])

  useEffect(() => {
    setEditedElements({})
  }, [slides])

  useEffect(() => {
    if (!selectedElementId) return
    const targetElement = currentSlide.elements.find(element => element.id === selectedElementId)
    if (!targetElement) return
    setSelectedElementXml(targetElement.rawXml || '')
    setSelectedElementXmlError(null)
  }, [selectedElementId, currentSlide.elements])

  useEffect(() => {
    setLiveTextStyleState(null)
  }, [selectedElementId, currentSlide.id, isEditMode])

  const handleEditElementSelect = (elementId: string) => {
    selectedElementIdRef.current = elementId
    setSelectedElementId(elementId)
    setSelectedElementXmlError(null)
  }

  const handleSelectedElementXmlChange = (value: string) => {
    const activeElementId = selectedElementIdRef.current
    const activeSlideId = currentSlideIdRef.current
    if (!activeElementId || !activeSlideId) return
    setSelectedElementXml(value)
    const mapKey = `${activeSlideId}|${activeElementId}`

    try {
      const parsedElement = parseSingleElementXml(value, activeSlideId)
      const syncedElement: SlideElement = {
        ...parsedElement,
        id: activeElementId,
        rawXml: value
      }
      setEditedElements(prev => ({
        ...prev,
        [mapKey]: syncedElement
      }))
      setSelectedElementXmlError(null)
    } catch (error) {
      setSelectedElementXmlError((error as Error).message)
    }
  }

  const handleEditBackgroundClick = () => {
    clearSelectedElement()
  }

  const handleEditElementDrag = (elementId: string, nextX: number, nextY: number) => {
    const targetElement = currentSlide.elements.find(element => element.id === elementId)
    if (!targetElement) return
    const mapKey = `${currentSlide.id}|${elementId}`
    const rawXml = targetElement.rawXml
      ? syncElementPositionXml(targetElement.rawXml, nextX, nextY)
      : targetElement.rawXml
    setEditedElements(prev => ({
      ...prev,
      [mapKey]: { ...targetElement, x: nextX, y: nextY, rawXml }
    }))
  }

  const handleEditElementResize = (
    elementId: string,
    nextX: number,
    nextY: number,
    nextWidth: number,
    nextHeight: number
  ) => {
    const targetElement = currentSlide.elements.find(element => element.id === elementId)
    if (!targetElement) return
    const mapKey = `${currentSlide.id}|${elementId}`
    const rawXml = targetElement.rawXml
      ? syncElementBoundsXml(targetElement.rawXml, nextX, nextY, nextWidth, nextHeight)
      : targetElement.rawXml
    setEditedElements(prev => ({
      ...prev,
      [mapKey]: {
        ...targetElement,
        x: nextX,
        y: nextY,
        width: nextWidth,
        height: nextHeight,
        rawXml
      }
    }))
  }

  const handleEditAudioUpdate = (elementId: string, edit: import('../audio-editing').AudioEdit) => {
    const target = currentSlide.elements.find(element => element.id === elementId)
    if (target?.type !== 'audio') return
    setEditedElements(prev => ({ ...prev, [`${currentSlide.id}|${elementId}`]: applyAudioEdit(target, edit) }))
  }

  const handleEditElementTextUpdate = (elementId: string, nextTextLines: TextLine[]) => {
    const targetElement = currentSlide.elements.find(element => element.id === elementId)
    if (!targetElement || (targetElement.type !== 'text' && targetElement.type !== 'shape')) return
    const mapKey = `${currentSlide.id}|${elementId}`
    const rawXml = targetElement.rawXml
      ? syncTextElementContentXml(targetElement.rawXml, nextTextLines)
      : targetElement.rawXml
    const updatedElement = targetElement.type === 'text'
      ? { ...targetElement, textLines: nextTextLines, rawXml }
      : { ...targetElement, inlineText: nextTextLines, rawXml }
    setEditedElements(prev => ({
      ...prev,
      [mapKey]: updatedElement
    }))
  }

  const handleSaveAs = async () => {
    if (isSaving) return
    setIsSaving(true)
    try {
      await onSaveAs(editedElements)
      Modal.success({
        title: '导出成功',
        content: 'ENBX 文件已成功导出'
      })
    } catch (error) {
      Modal.error({
        title: '另存为失败',
        content: (error as Error).message || '导出过程中发生未知错误'
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleTextStyleAction = (action: TextStyleAction) => {
    if (!selectedElement || selectedElement.type !== 'text') return
    const nextId = textStyleCommandSeq + 1
    setTextStyleCommandSeq(nextId)
    setTextStyleCommand({ ...action, id: nextId })
  }

  const slideViewerProps = {
    slide: currentSlide,
    slides: resolvedSlides,
    currentIndex,
    onSlideChange,
    slideChangeSource,
    resourceMap,
    clickToNextEnabled,
    pagerPosition,
    showAnimationProgress,
    hidePager,
    infoBarHeight,
    isEditMode,
    selectedElementId,
    onEditElementSelect: handleEditElementSelect,
    onEditElementDrag: handleEditElementDrag,
    onEditElementResize: handleEditElementResize,
    onEditElementTextUpdate: handleEditElementTextUpdate,
    onEditAudioUpdate: handleEditAudioUpdate,
    onEditTextStyleStateChange: setLiveTextStyleState,
    onEditBackgroundClick: handleEditBackgroundClick,
    textStyleCommand,
    toggleThumbnailsCommand,
    navigationCommand,
    onNavigationResult,
    swipeNavigationEnabled
  }

  return (
    <div style={styles.viewerContainer}>
      {!hideToolbar && (
      <div style={styles.toolbar}>
        <div style={styles.toolbarLeft}>
          <span style={styles.coursewareName}>{metadata.name}</span>
          <span style={styles.slideInfo}>
            第 {currentIndex + 1} / {resolvedSlides.length} 页
          </span>
        </div>
        <div style={styles.toolbarRight}>
          <Button
            onClick={() => setViewerMode(isEditMode ? 'play' : 'edit')}
            style={styles.modeToggleButton}
          >
            {isEditMode ? '播放模式' : '编辑模式'}
          </Button>
          <Button onClick={handleSaveAs} loading={isSaving} style={styles.saveAsButton}>
            另存为
          </Button>
          <Button onClick={() => setIssueModalOpen(true)} style={styles.issueButton}>
            {issueButtonText}
          </Button>
          <Button type='text' onClick={onClear} style={styles.clearButton}>
            关闭
          </Button>
        </div>
      </div>
      )}

      <div style={styles.mainContent}>
        {isEditMode && (
          <div style={styles.sidebar}>
            <div style={styles.sidebarHeader}>
              <span>幻灯片</span>
            </div>
            <div style={styles.slideList}>
              {resolvedSlides.map((slideItem, index) => (
                <SlideThumbnail
                  key={slideItem.id}
                  slide={slideItem}
                  index={index}
                  isActive={index === currentIndex}
                  resourceMap={resourceMap}
                  onSlideChange={onSlideChange}
                />
              ))}
            </div>
          </div>
        )}
        <div style={styles.slideCanvasArea}>
          {isEditMode ? (
            <div style={styles.editCanvasLayout}>
              <div style={styles.slideCanvasViewport}>
                <SlideViewer {...slideViewerProps} />
              </div>
              <ElementXmlPanel
                element={selectedElement}
                slideNumber={currentIndex + 1}
                xmlContent={selectedElement ? selectedElementXml : currentSlideXml}
                xmlError={selectedElement ? selectedElementXmlError : null}
                isSlideXml={!selectedElement}
                onXmlChange={selectedElement ? handleSelectedElementXmlChange : undefined}
                onClearSelection={selectedElement ? clearSelectedElement : undefined}
                textStyleState={panelTextStyleState}
                onTextStyleAction={handleTextStyleAction}
              />
            </div>
          ) : (
            <SlideViewer {...slideViewerProps} />
          )}
        </div>
      </div>

      <ViewerIssuesModal open={isIssueModalOpen} onClose={() => setIssueModalOpen(false)}
        issues={allIssues} slides={resolvedSlides} />
    </div>
  )
}
import { applyAudioEdit } from '../audio-editing'
