import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ComponentProps } from 'react'
import { Alert, Button, Spin } from 'antd'
import { HttpCourseware } from '../courseware/http-courseware'
import { CloudPreloader } from '../courseware/cloud-preloader'
import { postToEnbxHost, subscribeToEnbxHost } from '../platform/host-bridge'
import { exportSlidesToEnbx } from '../courseware/enbx-export'
import { saveBlobToFile } from '../courseware/save-courseware'
import { Viewer } from './Viewer'
import type { SlideChangeSource } from './Viewer'
import type { SlideData } from '../enbx/parser'
import { NavigationIntent } from '../viewer/navigation-intent'
import { SlidePreviewLoader } from './slide-viewer/SlidePreview'

type CloudViewerProps = Pick<ComponentProps<typeof Viewer>, 'onClear' | 'clickToNextEnabled' |
  'pagerPosition' | 'showAnimationProgress' | 'hidePager' | 'hideToolbar' | 'infoBarHeight' |
  'toggleThumbnailsCommand' | 'navigationCommand' | 'swipeNavigationEnabled'> & { manifestUrl: string }

export function CloudViewer({ manifestUrl, ...props }: CloudViewerProps) {
  const sourceRef = useRef<HttpCourseware | null>(null)
  const preloader = useRef<CloudPreloader | null>(null)
  const [slides, setSlides] = useState<SlideData[]>([])
  const [index, setIndex] = useState(0)
  const [changeSource, setChangeSource] = useState<SlideChangeSource>('programmatic')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const generation = useRef(0)
  const intent = useRef(new NavigationIntent())
  const pending = useRef<{ id: number; index: number; resolve: () => void; reject: (reason: Error) => void } | null>(null)
  const retryTarget = useRef(0)
  const source = sourceRef.current

  useEffect(() => {
    const current = new HttpCourseware()
    sourceRef.current = current
    let active = true
    setBusy(true)
    setError('')
    void (async () => {
      try {
        await current.open(manifestUrl)
        await current.ensureSlide(0)
        if (!active) return
        setIndex(0)
        setSlides(current.projectSlides())
      } catch (reason) {
        if (active) setError((reason as Error).message)
      } finally { if (active) setBusy(false) }
    })()
    return () => {
      active = false
      generation.current++
      intent.current.cancel('课件已关闭')
      pending.current?.reject(new Error('课件已关闭'))
      pending.current = null
      current.dispose()
    }
  }, [manifestUrl, attempt])

  const announced = useRef<HttpCourseware | null>(null)
  useLayoutEffect(() => {
    if (!source || !slides.length) return
    if (announced.current !== source) {
      announced.current = source
      postToEnbxHost({ type: 'enbx:document-loaded', sessionId: source.sessionId,
        slideIds: slides.map(slide => slide.id),
        pageCount: slides.length, currentPage: index + 1 })
    }
    const navigation = pending.current
    if (navigation?.index === index && source.loaded.has(index)) {
      pending.current = null
      postToEnbxHost({ type: 'enbx:page-changed', sessionId: source.sessionId, page: index + 1 })
      navigation.resolve()
    }
  }, [slides, index, source])

  useEffect(() => {
    if (!source || !slides.length) return
    const worker = new CloudPreloader(source)
    preloader.current = worker
    void worker.run().catch(reason => console.warn('[CloudLoading] preload-stopped', reason))
    return () => { worker.stop(); preloader.current = null }
  }, [source, slides.length])

  useEffect(() => { preloader.current?.update(index, busy) }, [index, busy, source, slides.length])

  // 宿主超时或取消后，旧请求不得继续提交正文。
  useEffect(() => subscribeToEnbxHost(message => {
    if (message.type === 'enbx:close-cloud' && message.sessionId === sourceRef.current?.sessionId) {
      generation.current++
      intent.current.cancel('课件已关闭')
      sourceRef.current?.dispose()
      pending.current?.reject(new Error('课件已关闭'))
      pending.current = null
      setSlides([])
      setBusy(false)
      return
    }
    if (message.type !== 'enbx:cancel-navigation' || message.requestId !== props.navigationCommand?.requestId) return
    generation.current++
    intent.current.cancel()
    pending.current?.reject(new Error('翻页已取消'))
    pending.current = null
    setBusy(false)
  }), [props.navigationCommand?.requestId])

  const handleSlideChange = async (target: number, nextSource: SlideChangeSource = 'programmatic') => {
    const current = sourceRef.current
    if (!current || target < 0 || target >= current.descriptors.length) throw new Error('页码超出范围')
    pending.current?.reject(new Error('翻页已被替代'))
    pending.current = null
    const id = ++generation.current
    console.info(`[CloudLoading] navigation-start session=${current.sessionId} page=${target + 1} request=${id} cached=${current.loaded.has(target)}`)
    retryTarget.current = target
    setBusy(true)
    setError('')
    try {
      await intent.current.run(() => current.ensureSlide(target), () =>
        new Promise<void>((resolve, reject) => {
          pending.current = { id, index: target, resolve, reject }
          setSlides(current.projectSlides())
          setChangeSource(nextSource)
          setIndex(target)
        }))
    } catch (reason) {
      if (id === generation.current) setError((reason as Error).message)
      throw reason
    } finally {
      if (id === generation.current) {
        console.info(`[CloudLoading] navigation-settled session=${current.sessionId} page=${target + 1} request=${id}`)
        pending.current = null
        setBusy(false)
      }
    }
  }

  const handleSaveAs: ComponentProps<typeof Viewer>['onSaveAs'] = async editedElements => {
    if (!source) throw new Error('课件未就绪')
    const file = await source.completeFile()
    const result = await exportSlidesToEnbx({ sourceFile: file, slides: [...source.loaded.values()],
      editedElements, coursewareName: source.metadata.name })
    await saveBlobToFile(result.blob, result.fileName)
  }

  return <>
    {slides.length > 0 && source && <SlidePreviewLoader.Provider value={source.previewSlide}><Viewer {...props} key={source.sessionId} metadata={source.metadata}
      slides={slides} currentIndex={index} slideChangeSource={changeSource} resourceMap={source.resources}
      onSlideChange={handleSlideChange} onSaveAs={handleSaveAs}
      onNavigationResult={(requestId, page) => postToEnbxHost({ type: 'enbx:navigation-complete',
        sessionId: source.sessionId, requestId, page })} /></SlidePreviewLoader.Provider>}
    {busy && <div style={{ position: 'absolute', top: 12, left: '50%', zIndex: 1000, background: '#ffffff', padding: 8 }}>
      <Spin size='small' /> 正在加载页面…
    </div>}
    {error && <div style={{ position: 'absolute', top: 48, left: '10%', right: '10%', zIndex: 1000 }}>
      <Alert type='error' message={error} action={<Button onClick={() => {
        if (slides.length) void handleSlideChange(retryTarget.current).catch(() => undefined)
        else setAttempt(value => value + 1)
      }}>重试</Button>} />
    </div>}
  </>
}
