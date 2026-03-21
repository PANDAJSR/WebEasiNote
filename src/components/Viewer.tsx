import { useEffect, useMemo, useState } from 'react'
import { Button, Modal, Segmented } from 'antd'
import { styles } from '../styles'
import { SlideViewer } from './SlideViewer'
import { SlideThumbnail } from './slide-viewer/SlideThumbnail'
import { ElementXmlPanel } from './ElementXmlPanel'
import type { CoursewareMetadata, SlideData, SlideElement, SlideIssue } from '../parser'
import { isFontFamilyMissing } from '../font-utils'
import type { PagerPosition } from '../viewer-settings'
import { parseSingleElementXml, syncElementPositionXml } from './viewer-xml-sync'

export type SlideChangeSource = 'keyboard' | 'pager' | 'thumbnail' | 'programmatic' | 'click'

type ViewerMode = 'play' | 'edit'
type IssueFilter = 'all' | SlideIssue['kind']

interface ViewerProps {
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
}

function collectMissingFontIssues(slides: SlideData[]): SlideIssue[] {
  const issues: SlideIssue[] = []
  const seen = new Set<string>()
  slides.forEach(slide => {
    slide.elements.forEach(element => {
      const textLines = (() => {
        if (element.type === 'text') return element.textLines
        if (element.type === 'shape') return element.inlineText || []
        return []
      })()
      if (textLines.length === 0) return
      const elementType = element.type === 'shape' ? element.geometryType || 'Shape' : element.type
      textLines.forEach(line => {
        const markerFont = line.textMarkerStyle?.fontFamily?.trim()
        if (markerFont && isFontFamilyMissing(markerFont)) {
          const markerKey = `${slide.id}|${element.id}|marker|${markerFont}`
          if (!seen.has(markerKey)) {
            seen.add(markerKey)
            issues.push({
              kind: 'missing-font',
              slideId: slide.id,
              elementType,
              elementId: element.id,
              name: markerFont,
              value: '列表符号字体不可用'
            })
          }
        }
        line.textRuns.forEach(run => {
          const fontName = run.fontFamily?.trim()
          if (!fontName || !isFontFamilyMissing(fontName)) return
          const key = `${slide.id}|${element.id}|run|${fontName}`
          if (seen.has(key)) return
          seen.add(key)
          issues.push({
            kind: 'missing-font',
            slideId: slide.id,
            elementType,
            elementId: element.id,
            name: fontName,
            value: '文本字体不可用'
          })
        })
      })
    })
  })
  return issues
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
  showAnimationProgress
}: ViewerProps) {
  const [isIssueModalOpen, setIssueModalOpen] = useState(false)
  const [issueFilter, setIssueFilter] = useState<IssueFilter>('all')
  const [fontCheckTick, setFontCheckTick] = useState(0)
  const [viewerMode, setViewerMode] = useState<ViewerMode>('play')
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null)
  const [selectedElementXml, setSelectedElementXml] = useState('')
  const [selectedElementXmlError, setSelectedElementXmlError] = useState<string | null>(null)
  const [editedElements, setEditedElements] = useState<Record<string, SlideElement>>({})

  const resolvedSlides = useMemo(() => {
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

  const slideOrderMap = useMemo(() => {
    return new Map(resolvedSlides.map((slide, index) => [slide.id, index + 1]))
  }, [resolvedSlides])

  const missingFontIssues = useMemo(() => {
    return collectMissingFontIssues(resolvedSlides)
  }, [resolvedSlides, fontCheckTick])

  const allIssues = useMemo(() => {
    return [...resolvedSlides.flatMap(slide => slide.issues || []), ...missingFontIssues]
  }, [resolvedSlides, missingFontIssues])

  const sortedIssues = useMemo(() => {
    const ordered = [...allIssues]
    ordered.sort((a, b) => {
      const pageA = slideOrderMap.get(a.slideId) || Number.MAX_SAFE_INTEGER
      const pageB = slideOrderMap.get(b.slideId) || Number.MAX_SAFE_INTEGER
      if (pageA !== pageB) return pageA - pageB
      if (a.kind !== b.kind) {
        const priority: Record<SlideIssue['kind'], number> = {
          'unknown-element': 0,
          'unknown-parameter': 1,
          'missing-font': 2
        }
        return priority[a.kind] - priority[b.kind]
      }
      if (a.elementType !== b.elementType) return a.elementType.localeCompare(b.elementType)
      if (a.name !== b.name) return a.name.localeCompare(b.name)
      return a.elementId.localeCompare(b.elementId)
    })
    return ordered
  }, [allIssues, slideOrderMap])

  const filteredIssues = useMemo(() => {
    if (issueFilter === 'all') return sortedIssues
    return sortedIssues.filter(issue => issue.kind === issueFilter)
  }, [sortedIssues, issueFilter])

  const unknownElementCount = allIssues.filter(issue => issue.kind === 'unknown-element').length
  const unknownParameterCount = allIssues.filter(issue => issue.kind === 'unknown-parameter').length
  const missingFontCount = allIssues.filter(issue => issue.kind === 'missing-font').length
  const issueCount = allIssues.length
  const issueButtonText = issueCount > 0 ? `问题 (${issueCount})` : '问题'
  const isEditMode = viewerMode === 'edit'

  const selectedElement = useMemo(() => {
    if (!selectedElementId) return null
    return currentSlide.elements.find(element => element.id === selectedElementId) || null
  }, [currentSlide.elements, selectedElementId])
  const currentSlideXml = currentSlide.rawXml || ''

  const clearSelectedElement = () => {
    setSelectedElementId(null)
    setSelectedElementXml('')
    setSelectedElementXmlError(null)
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

  const handleEditElementSelect = (elementId: string) => {
    setSelectedElementId(elementId)
    setSelectedElementXmlError(null)
  }

  const handleSelectedElementXmlChange = (value: string) => {
    setSelectedElementXml(value)
    if (!selectedElementId) return
    const mapKey = `${currentSlide.id}|${selectedElementId}`

    try {
      const parsedElement = parseSingleElementXml(value, currentSlide.id)
      const syncedElement: SlideElement = {
        ...parsedElement,
        id: selectedElementId,
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
    isEditMode,
    selectedElementId,
    onEditElementSelect: handleEditElementSelect,
    onEditElementDrag: handleEditElementDrag,
    onEditBackgroundClick: handleEditBackgroundClick
  }

  return (
    <div style={styles.viewerContainer}>
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
          <Button onClick={() => setIssueModalOpen(true)} style={styles.issueButton}>
            {issueButtonText}
          </Button>
          <Button type='text' onClick={onClear} style={styles.clearButton}>
            关闭
          </Button>
        </div>
      </div>

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
                onXmlChange={handleSelectedElementXmlChange}
                onClearSelection={selectedElement ? clearSelectedElement : undefined}
              />
            </div>
          ) : (
            <SlideViewer {...slideViewerProps} />
          )}
        </div>
      </div>

      <Modal
        title='解析问题列表'
        open={isIssueModalOpen}
        onCancel={() => setIssueModalOpen(false)}
        footer={null}
        width={920}
        centered
      >
        <div style={styles.modalSummary}>
          <span>总计 {issueCount} 项</span>
          <span>未识别元素 {unknownElementCount} 项</span>
          <span>未识别参数 {unknownParameterCount} 项</span>
          <span>缺失字体 {missingFontCount} 项</span>
        </div>
        <div style={styles.issueFilterBar}>
          <Segmented
            value={issueFilter}
            onChange={value => setIssueFilter(value as IssueFilter)}
            options={[
              { label: `全部 (${issueCount})`, value: 'all' },
              { label: `未识别元素 (${unknownElementCount})`, value: 'unknown-element' },
              { label: `未识别参数 (${unknownParameterCount})`, value: 'unknown-parameter' },
              { label: `缺失字体 (${missingFontCount})`, value: 'missing-font' }
            ]}
          />
        </div>
        {filteredIssues.length === 0 && (
          <div style={styles.modalEmpty}>当前筛选条件下没有问题</div>
        )}
        {filteredIssues.length > 0 && (
          <div style={styles.issueList}>
            {filteredIssues.map((issue, index) => {
              const pageNumber = slideOrderMap.get(issue.slideId)
              return (
                <div
                  key={`${issue.kind}-${issue.slideId}-${issue.elementId}-${issue.name}-${index}`}
                  style={styles.issueItem}
                >
                  <div style={styles.issueItemHeader}>
                    <span style={styles.issueBadge}>
                      {issue.kind === 'unknown-element'
                        ? '未识别元素'
                        : issue.kind === 'unknown-parameter'
                          ? '未识别参数'
                          : '缺失字体'}
                    </span>
                    <span style={styles.issueMeta}>
                      第 {pageNumber || '?'} 页 | 元素类型: {issue.elementType} | 元素ID: {issue.elementId}
                    </span>
                  </div>
                  <div style={styles.issueName}>名称: {issue.name}</div>
                  {issue.value && (
                    <div style={styles.issueValue}>值: {issue.value}</div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Modal>
    </div>
  )
}
