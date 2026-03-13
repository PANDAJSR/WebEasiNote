import { useEffect, useRef, useState } from 'react'
import JSZip from 'jszip'
import {
  parseENBXFile,
  parseExtractedFolder,
  loadSlidesFromENBX,
  loadSlidesFromFolder,
  type CoursewareMetadata,
  type SlideData
} from './parser'
import { parseReferenceXML } from './pictures'
import { WelcomeView } from './components/WelcomeView'
import { LoadingView } from './components/LoadingView'
import { ErrorView } from './components/ErrorView'
import { Viewer } from './components/Viewer'
import type { SlideChangeSource } from './components/Viewer'
import { styles } from './styles'

type ViewMode = 'welcome' | 'loading' | 'error' | 'viewer'
type ENBXWatchState = {
  handle: FileSystemFileHandle
  lastModified: number
  size: number
}
const AUTO_RELOAD_STORAGE_KEY = 'webeasinote:autoReloadEnabled'
const CLICK_TO_NEXT_STORAGE_KEY = 'webeasinote:clickToNextEnabled'

type PickerWindow = Window & {
  showOpenFilePicker?: (options?: {
    multiple?: boolean
    excludeAcceptAllOption?: boolean
    types?: Array<{
      description: string
      accept: Record<string, string[]>
    }>
  }) => Promise<FileSystemFileHandle[]>
}

if (typeof document !== 'undefined' && !document.getElementById('spin-keyframes')) {
  const styleSheet = document.createElement('style')
  styleSheet.id = 'spin-keyframes'
  styleSheet.textContent = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `
  document.head.appendChild(styleSheet)
}

function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('welcome')
  const [metadata, setMetadata] = useState<CoursewareMetadata | null>(null)
  const [slides, setSlides] = useState<SlideData[]>([])
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0)
  const [slideChangeSource, setSlideChangeSource] = useState<SlideChangeSource>('programmatic')
  const [error, setError] = useState<string | null>(null)
  const [resourceMap, setResourceMap] = useState<Record<string, string>>({})
  const [watchedENBX, setWatchedENBX] = useState<ENBXWatchState | null>(null)
  const [autoReloadEnabled, setAutoReloadEnabled] = useState(false)
  const [clickToNextEnabled, setClickToNextEnabled] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const autoReloadingRef = useRef(false)

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

  const revokeObjectUrls = (map: Record<string, string>) => {
    Object.values(map).forEach(url => {
      URL.revokeObjectURL(url)
    })
  }

  const loadENBXFile = async (file: File, options?: { autoReload?: boolean }) => {
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

      const zip = await JSZip.loadAsync(file)
      console.log('[App] ZIP 文件加载成功')

      const referenceFile = zip.file('Reference.xml')
      let map: Record<string, string> = {}
      if (referenceFile) {
        const refXml = await referenceFile.async('text')
        map = parseReferenceXML(refXml)
        console.log(`[App] Reference.xml 解析完成, 共 ${Object.keys(map).length} 个资源映射`)
      }

      let loadedCount = 0
      let failedCount = 0
      for (const [id, filePath] of Object.entries(map)) {
        const imgFile = zip.file(filePath)
        if (!imgFile) {
          failedCount++
          continue
        }

        try {
          const blob = await imgFile.async('blob')
          loadedMap[id] = URL.createObjectURL(blob)
          loadedCount++
        } catch {
          failedCount++
        }
      }
      console.log(`[App] 图片资源加载完成: ${loadedCount} 成功, ${failedCount} 失败`)

      const meta = await parseENBXFile(file)
      const slideData = await loadSlidesFromENBX(file)
      const totalElements = slideData.reduce((sum, slide) => sum + slide.elements.length, 0)
      console.log(`[App] 幻灯片: ${slideData.length} 页, 元素总数: ${totalElements}`)

      setMetadata(meta)
      setSlides(slideData)
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
      return true
    } catch (err) {
      revokeObjectUrls(loadedMap)
      if (isAutoReload) {
        console.warn('[App] 自动重载失败，保留当前内容', err)
        return false
      }
      setError((err as Error).message)
      setViewMode('error')
      return false
    }
  }

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

    let loadedMap: Record<string, string> = {}
    try {
      const dirHandle = await window.showDirectoryPicker()

      let map: Record<string, string> = {}
      try {
        const refFile = await dirHandle.getFileHandle('Reference.xml')
        const refBlob = await refFile.getFile()
        const refXml = await refBlob.text()
        map = parseReferenceXML(refXml)
      } catch {
        // Reference.xml 可能不存在
      }

      let resourcesHandle: FileSystemDirectoryHandle | null = null
      try {
        resourcesHandle = await dirHandle.getDirectoryHandle('Resources')
      } catch {
        // Resources 文件夹可能不存在
      }

      if (resourcesHandle) {
        for (const [id, filePath] of Object.entries(map)) {
          const fileName = filePath.split('/').pop()
          if (!fileName) continue

          try {
            const fileHandle = await resourcesHandle.getFileHandle(fileName)
            const file = await fileHandle.getFile()
            loadedMap[id] = URL.createObjectURL(file)
          } catch {
            // 忽略图片加载失败
          }
        }
      }

      const meta = await parseExtractedFolder(dirHandle)
      const slideData = await loadSlidesFromFolder(dirHandle)

      setMetadata(meta)
      setSlides(slideData)
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
    revokeObjectUrls(resourceMap)

    setMetadata(null)
    setSlides([])
    setResourceMap({})
    setSlideChangeSource('programmatic')
    setCurrentSlideIndex(0)
    setError(null)
    setWatchedENBX(null)
    setViewMode('welcome')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleSlideChange = (index: number, source: SlideChangeSource = 'programmatic') => {
    setSlideChangeSource(source)
    setCurrentSlideIndex(index)
  }

  useEffect(() => {
    if (!autoReloadEnabled || !watchedENBX || viewMode !== 'viewer') return

    let disposed = false
    const timerId = window.setInterval(async () => {
      if (autoReloadingRef.current) return
      autoReloadingRef.current = true

      try {
        const latestFile = await watchedENBX.handle.getFile()
        const hasChanged =
          latestFile.lastModified !== watchedENBX.lastModified ||
          latestFile.size !== watchedENBX.size

        if (!hasChanged) return

        console.log('[App] 检测到 ENBX 文件变化，开始自动重载...')
        const loaded = await loadENBXFile(latestFile, { autoReload: true })
        if (loaded && !disposed) {
          setWatchedENBX({
            handle: watchedENBX.handle,
            lastModified: latestFile.lastModified,
            size: latestFile.size
          })
        }
      } catch (err) {
        console.warn('[App] 自动检测 ENBX 文件变化失败:', err)
      } finally {
        autoReloadingRef.current = false
      }
    }, 2000)

    return () => {
      disposed = true
      window.clearInterval(timerId)
    }
  }, [autoReloadEnabled, watchedENBX, viewMode])

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
          fileInputRef={fileInputRef}
          supportsAutoReload={supportsOpenFilePicker}
        />
      )}
      {viewMode === 'loading' && <LoadingView />}
      {viewMode === 'error' && error && <ErrorView error={error} onBack={handleClear} />}
      {viewMode === 'viewer' && metadata && (
        <Viewer
          metadata={metadata}
          slides={slides}
          currentIndex={currentSlideIndex}
          onSlideChange={handleSlideChange}
          slideChangeSource={slideChangeSource}
          onClear={handleClear}
          resourceMap={resourceMap}
          clickToNextEnabled={clickToNextEnabled}
        />
      )}
    </div>
  )
}

export default App
