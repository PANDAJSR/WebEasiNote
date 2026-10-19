import { useCallback, useEffect, useRef, useState } from 'react'
import type { CoursewareMetadata, SlideData } from './enbx/parser'
import { readCoursewareFile, readCoursewareFolder } from './courseware/courseware-loader'
import { WelcomeView } from './components/WelcomeView'
import { LoadingView } from './components/LoadingView'
import { ErrorView } from './components/ErrorView'
import { Viewer } from './components/Viewer'
import { CloudViewer } from './components/CloudViewer'
import type { SlideChangeSource } from './components/Viewer'
import { exportSlidesToEnbx } from './courseware/enbx-export'
import { saveBlobToFile } from './courseware/save-courseware'
import {
  DEFAULT_PAGER_POSITION,
  isPagerPosition,
  PAGER_POSITION_STORAGE_KEY,
  SHOW_ANIMATION_PROGRESS_STORAGE_KEY,
  SWIPE_NAVIGATION_STORAGE_KEY
} from './viewer/viewer-settings'
import type { PagerPosition } from './viewer/viewer-settings'
import { styles } from './styles'
import { useEnbxHostMessages } from './hooks/useEnbxHostMessages'
import { useCoursewareAutoReload } from './hooks/useCoursewareAutoReload'
import {
  isEnbxHostRuntime,
  postToEnbxHost
} from './platform/host-bridge'
import {
  AUTO_RELOAD_STORAGE_KEY,
  CLICK_TO_NEXT_STORAGE_KEY,
  ensureSpinKeyframes,
  revokeObjectUrls,
  type ENBXWatchState,
  type PickerWindow,
  type ViewMode
} from './viewer/app-utils'
ensureSpinKeyframes()
function App() {
  const hostRuntime = isEnbxHostRuntime()
  const [viewMode, setViewMode] = useState<ViewMode>(hostRuntime ? 'loading' : 'welcome')
  const [metadata, setMetadata] = useState<CoursewareMetadata | null>(null)
  const [slides, setSlides] = useState<SlideData[]>([])
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0)
  const [slideChangeSource, setSlideChangeSource] = useState<SlideChangeSource>('programmatic')
  const [error, setError] = useState<string | null>(null)
  const [resourceMap, setResourceMap] = useState<Record<string, string>>({})
  const [watchedENBX, setWatchedENBX] = useState<ENBXWatchState | null>(null)
  const [autoReloadEnabled, setAutoReloadEnabled] = useState(false)
  const [clickToNextEnabled, setClickToNextEnabled] = useState(true)
  const [pagerPosition, setPagerPosition] = useState<PagerPosition>(DEFAULT_PAGER_POSITION)
  const [showAnimationProgress, setShowAnimationProgress] = useState(false)
  const [swipeNavigationEnabled, setSwipeNavigationEnabled] = useState(true)
  const [toggleThumbnailsCommand, setToggleThumbnailsCommand] = useState<{
    side: 'left' | 'right'
    id: number
  } | null>(null)
  const [navigationCommand, setNavigationCommand] = useState<{
    id: number
    direction: 'previous' | 'next'
    requestId: string
  } | null>(null)
  const [sourceEnbxFile, setSourceEnbxFile] = useState<File | null>(null)
  const [manifestUrl, setManifestUrl] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const currentSlideIndexRef = useRef(0)
  const slideCountRef = useRef(0)
  const viewModeRef = useRef(viewMode)
  viewModeRef.current = viewMode
  const loadENBXUrlRef = useRef<(url: string, fileName: string) => Promise<boolean>>(async () => false)
  const lastOpenUrlRef = useRef('')
  const pickerWindow = window as PickerWindow
  const supportsOpenFilePicker = typeof pickerWindow.showOpenFilePicker === 'function'
  useEffect(() => {
    try {
      const saved = localStorage.getItem(AUTO_RELOAD_STORAGE_KEY)
      if (saved === '1') {
        setAutoReloadEnabled(true)
      }
      const savedClickToNext = localStorage.getItem(CLICK_TO_NEXT_STORAGE_KEY)
      if (savedClickToNext === '0') {
        setClickToNextEnabled(false)
      }
      const savedPagerPosition = localStorage.getItem(PAGER_POSITION_STORAGE_KEY)
      if (isPagerPosition(savedPagerPosition)) {
        setPagerPosition(savedPagerPosition)
      }
      const savedShowAnimationProgress = localStorage.getItem(SHOW_ANIMATION_PROGRESS_STORAGE_KEY)
      if (savedShowAnimationProgress === '1') {
        setShowAnimationProgress(true)
      }
      const savedSwipeNavigation = localStorage.getItem(SWIPE_NAVIGATION_STORAGE_KEY)
      if (savedSwipeNavigation === '0') {
        setSwipeNavigationEnabled(false)
      }
    } catch (error) {
      console.warn('[App] 读取本地配置失败', error)
    }
  }, [])
  useEffect(() => {
    try {
      localStorage.setItem(AUTO_RELOAD_STORAGE_KEY, autoReloadEnabled ? '1' : '0')
    } catch (error) {
      console.warn('[App] 保存自动重载配置失败', error)
    }
    if (!autoReloadEnabled) {
      setWatchedENBX(null)
    }
  }, [autoReloadEnabled])
  useEffect(() => {
    try {
      localStorage.setItem(CLICK_TO_NEXT_STORAGE_KEY, clickToNextEnabled ? '1' : '0')
    } catch (error) {
      console.warn('[App] 保存单击翻页配置失败', error)
    }
  }, [clickToNextEnabled])
  useEffect(() => {
    try {
      localStorage.setItem(PAGER_POSITION_STORAGE_KEY, pagerPosition)
    } catch (error) {
      console.warn('[App] 保存翻页控件位置配置失败', error)
    }
  }, [pagerPosition])
  useEffect(() => {
    try {
      localStorage.setItem(SHOW_ANIMATION_PROGRESS_STORAGE_KEY, showAnimationProgress ? '1' : '0')
    } catch (error) {
      console.warn('[App] 保存动画进度显示配置失败', error)
    }
  }, [showAnimationProgress])
  useEffect(() => {
    try {
      localStorage.setItem(SWIPE_NAVIGATION_STORAGE_KEY, swipeNavigationEnabled ? '1' : '0')
    } catch (error) {
      console.warn('[App] 保存滑动翻页配置失败', error)
    }
  }, [swipeNavigationEnabled])
  const loadENBXFile = async (file: File, options?: { autoReload?: boolean }) => {
    setManifestUrl('')
    const isAutoReload = options?.autoReload === true
    let loadedMap: Record<string, string> = {}
    if (!isAutoReload) {
      setViewMode('loading')
      setError(null)
    }
    try {
      console.log('='.repeat(60))
      console.log(`[App] 开始解析 ENBX 文件: ${file.name}${isAutoReload ? '（自动重载）' : ''}`)
      console.log('='.repeat(60))
      const { meta, slideData, resources } = await readCoursewareFile(file)
      loadedMap = resources
      setMetadata(meta)
      setSlides(slideData)
      setSourceEnbxFile(file)
      setResourceMap(previousMap => {
        revokeObjectUrls(previousMap)
        return loadedMap
      })
      setSlideChangeSource('programmatic')
      setCurrentSlideIndex(previousIndex => {
        if (!isAutoReload) return 0
        if (slideData.length === 0) return 0
        return Math.min(previousIndex, slideData.length - 1)
      })
      setViewMode('viewer')
      postToEnbxHost({
        type: 'enbx:document-loaded',
        fileName: file.name,
        pageCount: slideData.length,
        currentPage: isAutoReload ? currentSlideIndexRef.current + 1 : 1
      })
      return true
    } catch (err) {
      revokeObjectUrls(loadedMap)
      if (isAutoReload) {
        console.warn('[App] 自动重载失败，保留当前内容', err)
        return false
      }
      setError((err as Error).message)
      setViewMode('error')
      postToEnbxHost({
        type: 'enbx:error',
        error: err instanceof Error ? err.stack || err.message : String(err)
      })
      return false
    }
  }
  const loadENBXUrl = async (url: string, fileName: string) => {
    if (lastOpenUrlRef.current === url) {
      console.log('[App] 忽略重复的 enbx:open 请求')
      return true
    }
    lastOpenUrlRef.current = url
    const response = await fetch(url)
    if (!response.ok) throw new Error(`无法读取 ENBX 文件 (${response.status})`)
    const blob = await response.blob()
    return loadENBXFile(new File([blob], fileName, { type: 'application/octet-stream' }))
  }
  loadENBXUrlRef.current = loadENBXUrl
  useEffect(() => {
    currentSlideIndexRef.current = currentSlideIndex
    slideCountRef.current = slides.length
  }, [currentSlideIndex, slides.length])
  useEnbxHostMessages({ loadENBXUrlRef, openManifest: url => {
    setManifestUrl(url)
    setViewMode('viewer')
    setNavigationCommand(null)
    setWatchedENBX(null)
  }, viewModeRef, setNavigationCommand,
    setToggleThumbnailsCommand, setClickToNextEnabled, setSwipeNavigationEnabled })
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.endsWith('.enbx')) {
      setError('请选择 .enbx 格式的文件')
      setViewMode('error')
      return
    }
    setWatchedENBX(null)
    await loadENBXFile(file)
  }
  const handleFilePickerSelect = async () => {
    if (isEnbxHostRuntime()) {
      postToEnbxHost({ type: 'enbx:request-open' })
      return
    }
    if (!supportsOpenFilePicker) {
      fileInputRef.current?.click()
      return
    }
    try {
      const [fileHandle] = await pickerWindow.showOpenFilePicker!({
        multiple: false,
        excludeAcceptAllOption: true,
        types: [
          {
            description: 'ENBX 课件文件',
            accept: {
              'application/octet-stream': ['.enbx']
            }
          }
        ]
      })
      if (!fileHandle) return
      const file = await fileHandle.getFile()
      if (!file.name.endsWith('.enbx')) {
        setError('请选择 .enbx 格式的文件')
        setViewMode('error')
        return
      }
      const loaded = await loadENBXFile(file)
      if (loaded) {
        if (autoReloadEnabled) {
          setWatchedENBX({
            handle: fileHandle,
            lastModified: file.lastModified,
            size: file.size
          })
        } else {
          setWatchedENBX(null)
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      setError(`打开 ENBX 文件失败: ${(err as Error).message}`)
      setViewMode('error')
    }
  }
  const handleFolderSelect = async () => {
    if (!('showDirectoryPicker' in window)) {
      setError('您的浏览器不支持文件夹选择功能，请使用 Chrome 或 Edge 浏览器')
      setViewMode('error')
      return
    }
    setViewMode('loading')
    setError(null)
    setWatchedENBX(null)
    setSourceEnbxFile(null)
    let loadedMap: Record<string, string> = {}
    try {
      const dirHandle = await window.showDirectoryPicker()
      const { meta, slideData, resources } = await readCoursewareFolder(dirHandle)
      loadedMap = resources
      setMetadata(meta)
      setSlides(slideData)
      setSourceEnbxFile(null)
      setResourceMap(previousMap => {
        revokeObjectUrls(previousMap)
        return loadedMap
      })
      setSlideChangeSource('programmatic')
      setCurrentSlideIndex(0)
      setViewMode('viewer')
    } catch (err) {
      revokeObjectUrls(loadedMap)
      if ((err as Error).name === 'AbortError') {
        setViewMode('welcome')
        return
      }
      setError((err as Error).message)
      setViewMode('error')
    }
  }
  const handleClear = () => {
    setManifestUrl('')
    revokeObjectUrls(resourceMap)
    setMetadata(null)
    setSlides([])
    setResourceMap({})
    setSlideChangeSource('programmatic')
    setCurrentSlideIndex(0)
    setError(null)
    setWatchedENBX(null)
    setSourceEnbxFile(null)
    setViewMode('welcome')
    lastOpenUrlRef.current = ''
    postToEnbxHost({ type: 'enbx:close' })
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }
  const handleSlideChange = (index: number, source: SlideChangeSource = 'programmatic') => {
    setSlideChangeSource(source)
    setCurrentSlideIndex(index)
    postToEnbxHost({ type: 'enbx:page-changed', page: index + 1 })
  }
  const handleSaveAs = async (editedElements: Record<string, SlideData['elements'][number]>) => {
    if (!metadata || !sourceEnbxFile) {
      throw new Error('当前仅支持从 ENBX 文件打开后进行另存为')
    }
    const { blob, fileName } = await exportSlidesToEnbx({
      sourceFile: sourceEnbxFile,
      slides,
      editedElements,
      coursewareName: metadata.name
    })
    await saveBlobToFile(blob, fileName)
  }
  useCoursewareAutoReload({ autoReloadEnabled, watchedENBX, viewMode, loadENBXFile, setWatchedENBX })
  const handleNavigationResult = useCallback((requestId: string, page: number) => {
    if (page > 0) {
      postToEnbxHost({ type: 'enbx:page-changed', page })
    }
    postToEnbxHost({ type: 'enbx:navigation-complete', requestId, page })
  }, [])
  return (
    <div style={styles.container}>
      {viewMode === 'welcome' && (
        <WelcomeView
          onFileSelect={handleFileSelect}
          onFilePickerSelect={handleFilePickerSelect}
          onFolderSelect={handleFolderSelect}
          autoReloadEnabled={autoReloadEnabled}
          onAutoReloadChange={setAutoReloadEnabled}
          clickToNextEnabled={clickToNextEnabled}
          onClickToNextChange={setClickToNextEnabled}
          pagerPosition={pagerPosition}
          onPagerPositionChange={setPagerPosition}
          showAnimationProgress={showAnimationProgress}
          onShowAnimationProgressChange={setShowAnimationProgress}
          swipeNavigationEnabled={swipeNavigationEnabled}
          onSwipeNavigationChange={setSwipeNavigationEnabled}
          fileInputRef={fileInputRef}
          supportsAutoReload={supportsOpenFilePicker}
        />
      )}
      {viewMode === 'loading' && <LoadingView />}
      {viewMode === 'error' && error && <ErrorView error={error} onBack={handleClear} />}
      {viewMode === 'viewer' && manifestUrl && <CloudViewer key={manifestUrl} manifestUrl={manifestUrl}
        onClear={handleClear} clickToNextEnabled={clickToNextEnabled} pagerPosition={pagerPosition}
        showAnimationProgress={showAnimationProgress} hidePager={hostRuntime} hideToolbar={hostRuntime}
        infoBarHeight={hostRuntime ? 0 : undefined} toggleThumbnailsCommand={toggleThumbnailsCommand}
        navigationCommand={navigationCommand} swipeNavigationEnabled={swipeNavigationEnabled} />}
      {viewMode === 'viewer' && !manifestUrl && metadata && (
        <Viewer
          onSaveAs={handleSaveAs}
          metadata={metadata}
          slides={slides}
          currentIndex={currentSlideIndex}
          onSlideChange={handleSlideChange}
          slideChangeSource={slideChangeSource}
          onClear={handleClear}
          resourceMap={resourceMap}
          clickToNextEnabled={clickToNextEnabled}
          pagerPosition={pagerPosition}
          showAnimationProgress={showAnimationProgress}
          hidePager={hostRuntime}
          hideToolbar={hostRuntime}
          infoBarHeight={hostRuntime ? 0 : undefined}
          toggleThumbnailsCommand={toggleThumbnailsCommand}
          navigationCommand={navigationCommand}
          onNavigationResult={handleNavigationResult}
          swipeNavigationEnabled={swipeNavigationEnabled}
        />
      )}
    </div>
  )
}
export default App
