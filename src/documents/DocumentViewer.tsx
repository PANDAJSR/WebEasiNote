import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Button, ConfigProvider, InputNumber, Modal, Select, Space, Typography } from 'antd'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { postToEnbxHost, subscribeToEnbxHost } from '../platform/host-bridge'
import { layoutPages, visiblePages, type DocumentSource, type PageSize } from './model'
import { openPdf, RenderQueue } from './pdf-provider'
import { PdfPage } from './PdfPage'
import { useDocumentAnnotation } from './useDocumentAnnotation'
import { useDocumentGestures } from './useDocumentGestures'
import { documentStyles as styles } from './styles'
import { readViewSettings, writeViewSettings } from './view-settings'

const emptyInk: never[] = []

export default function DocumentViewer({ source }: { source: DocumentSource }) {
  const [savedView] = useState(() => readViewSettings(source.documentKey))
  const viewport = useRef<HTMLDivElement>(null)
  const toolbar = useRef<HTMLDivElement>(null)
  const [toolbarHeight, setToolbarHeight] = useState(112)
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null)
  const [sizes, setSizes] = useState<PageSize[]>([])
  const [error, setError] = useState('')
  const [columns, setColumns] = useState(savedView.columns)
  const [continuous, setContinuous] = useState(savedView.continuous)
  const [scale, setScale] = useState(savedView.scale)
  const scaleRef = useRef(scale)
  const [fit, setFit] = useState(savedView.fit)
  const [current, setCurrent] = useState(savedView.current)
  const [view, setView] = useState({ width: 1000, height: 700, x: 0, y: 0 })
  const [fingerInk, setFingerInk] = useState(savedView.fingerInk)
  const [inertia, setInertia] = useState(savedView.inertia)
  const [jumpOpen, setJumpOpen] = useState(false)
  const [jumpPage, setJumpPage] = useState<number | null>(1)
  const [left, setLeft] = useState(savedView.left)
  const [closing, setClosing] = useState(false)
  const queue = useMemo(() => new RenderQueue(), [])
  const anchor = useRef<{ page: number; x: number; y: number; screenX: number; screenY: number } | null>(null)
  const pendingNavigation = useRef<{ page: number; requestId?: string } | null>({ page: savedView.current })
  const currentRef = useRef(current)
  currentRef.current = current
  const layout = useMemo(() => layoutPages(sizes, columns, scale, view.width, continuous, current),
    [sizes, columns, scale, view.width, continuous, continuous ? 0 : current])
  const layoutRef = useRef(layout)
  layoutRef.current = layout
  const navigate = (index: number, requestId?: string) => {
    gesturesRef.current?.cancel()
    const page = Math.max(0, Math.min(sizes.length - 1, index))
    pendingNavigation.current = { page, requestId }
    setCurrent(page)
    setNavigationEpoch(value => value + 1)
  }
  const [navigationEpoch, setNavigationEpoch] = useState(0)
  const annotation = useDocumentAnnotation(source, navigate, current)
  const zoomAt = (factor: number, clientX: number, clientY: number) => {
    const el = viewport.current!
    const rect = el.getBoundingClientRect()
    const screenX = clientX - rect.left, screenY = clientY - rect.top
    const page = layoutRef.current.pages.find(p => screenY + el.scrollTop >= p.y && screenY + el.scrollTop < p.y + p.height)
      ?? layoutRef.current.pages.find(p => p.index === currentRef.current)
    if (!page) return
    anchor.current = { page: page.index, x: (screenX + el.scrollLeft - page.x) / scaleRef.current,
      y: (screenY + el.scrollTop - page.y) / scaleRef.current, screenX, screenY }
    scaleRef.current = Math.max(0.2, Math.min(4, scaleRef.current * factor))
    setFit('custom')
    setScale(scaleRef.current)
  }
  const gestures = useDocumentGestures({ viewport, layout, scale, fingerInk, inertia, annotation, zoomAt,
    selectPage: index => setCurrent(index) })
  const gesturesRef = useRef(gestures)
  gesturesRef.current = gestures
  const rememberAnchor = () => {
    gestures.cancel()
    const el = viewport.current!
    const page = layout.pages.find(p => p.index === current) ?? layout.pages[0]
    if (page) anchor.current = { page: page.index, x: 0,
      y: Math.max(0, (el.scrollTop - page.y) / scale), screenX: page.x - el.scrollLeft, screenY: Math.max(0, page.y - el.scrollTop) }
  }
  useEffect(() => {
    if (!sizes.length) return
    const timer = setTimeout(() => writeViewSettings(source.documentKey,
      { columns, continuous, fit, scale, current, fingerInk, inertia, left }), 200)
    return () => clearTimeout(timer)
  }, [columns, continuous, fit, scale, current, fingerInk, inertia, left, source, sizes.length])
  useEffect(() => {
    let cancelled = false
    const task = openPdf(source.url)
    void task.promise.then(async document => {
      const first = await document.getPage(1)
      if (cancelled) return
      const size = first.getViewport({ scale: 1 })
      setPdf(document)
      const startPage = Math.min(document.numPages - 1, savedView.current)
      setCurrent(startPage)
      pendingNavigation.current = { page: startPage }
      setSizes(Array.from({ length: document.numPages }, () => ({ width: size.width, height: size.height })))
      postToEnbxHost({ type: 'document:loaded', protocolVersion: 1, documentSessionId: source.documentSessionId,
        pageCount: document.numPages, currentPage: startPage + 1 })
      // 分批补尺寸，先让首屏可读；小批量并行避免大文档阻塞首次呈现。
      for (let start = 1; start < document.numPages && !cancelled; start += 8) {
        const batch = await Promise.all(Array.from({ length: Math.min(8, document.numPages - start) }, async (_, offset) => {
          const index = start + offset
          const page = await document.getPage(index + 1)
          const size = page.getViewport({ scale: 1 })
          return { index, size: { width: size.width, height: size.height } }
        }))
        if (cancelled) return
        const el = viewport.current!
        const page = layoutRef.current.pages.find(p => p.index === currentRef.current)
        if (page && el.scrollTop > 0) anchor.current = { page: page.index, x: 0,
          y: (el.scrollTop - page.y) / scaleRef.current, screenX: page.x - el.scrollLeft, screenY: 0 }
        setSizes(previous => { const next = [...previous]; batch.forEach(item => { next[item.index] = item.size }); return next })
        await new Promise(resolve => setTimeout(resolve, 0))
      }
    }).catch(error => {
      if (cancelled) return
      setError(`无法打开 PDF：${error.message}`)
      postToEnbxHost({ type: 'document:error', documentSessionId: source.documentSessionId, error: String(error.message) })
    })
    return () => { cancelled = true; void task.destroy() }
  }, [source])
  useLayoutEffect(() => {
    const observer = new ResizeObserver(() => setToolbarHeight(toolbar.current!.offsetHeight))
    observer.observe(toolbar.current!)
    return () => observer.disconnect()
  }, [])
  useLayoutEffect(() => {
    const el = viewport.current!
    let frame = 0
    const update = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        setView({ width: el.clientWidth, height: el.clientHeight, x: el.scrollLeft, y: el.scrollTop })
      })
    }
    const observer = new ResizeObserver(() => {
      const page = layoutRef.current.pages.find(p => p.index === currentRef.current)
      if (page && el.scrollTop > 0) anchor.current = { page: page.index, x: 0,
        y: (el.scrollTop - page.y) / scaleRef.current, screenX: page.x - el.scrollLeft, screenY: 0 }
      update()
    })
    observer.observe(el)
    el.addEventListener('scroll', update, { passive: true })
    update()
    return () => { observer.disconnect(); el.removeEventListener('scroll', update); cancelAnimationFrame(frame) }
  }, [])
  useLayoutEffect(() => {
    if (fit === 'custom' || !sizes.length) return
    const maxWidth = Math.max(...sizes.map(p => p.width))
    const maxHeight = Math.max(...sizes.map(p => p.height))
    const width = (view.width - 24 * (columns + 1)) / (maxWidth * columns)
    const next = Math.max(0.2, Math.min(4, fit === 'page' ? Math.min(width, (view.height - 48) / maxHeight) : width))
    scaleRef.current = next
    setScale(next)
  }, [fit, columns, sizes, view.width, view.height])
  useLayoutEffect(() => {
    const el = viewport.current!
    const target = pendingNavigation.current
    if (target) {
      const page = layout.pages.find(p => p.index === target.page)
      if (!page) return
      pendingNavigation.current = null
      el.scrollTop = Math.max(0, page.y - 24)
      el.scrollLeft = Math.max(0, page.x - 24)
      postToEnbxHost({ type: 'document:navigation-complete', documentSessionId: source.documentSessionId,
        page: target.page + 1, requestId: target.requestId || '' })
    } else if (anchor.current) {
      const old = anchor.current
      const page = layout.pages.find(p => p.index === old.page)
      if (page) { el.scrollLeft = page.x + old.x * scale - old.screenX; el.scrollTop = page.y + old.y * scale - old.screenY }
      anchor.current = null
    }
  }, [layout, scale, navigationEpoch])
  useEffect(() => {
    if (!continuous || !sizes.length || gestures.draft) return
    const y = view.y + Math.min(160, view.height * 0.25)
    const page = visiblePages(layout, y, y)[0]
    if (page && Math.floor(current / columns) !== page.row) setCurrent(page.index)
  }, [view.y, continuous, layout, columns, gestures.draft])
  useEffect(() => {
    if (sizes.length) postToEnbxHost({ type: 'document:page-changed', documentSessionId: source.documentSessionId, page: current + 1 })
  }, [current, sizes.length, source])
  const actions = useRef({ navigate, columns, current, sizes, close: async () => {} })
  const close = async () => {
    gestures.cancel()
    setClosing(true)
    try {
      await annotation.save()
      postToEnbxHost({ type: 'document:close', documentSessionId: source.documentSessionId })
    } catch { setClosing(false) }
  }
  actions.current = { navigate, columns, current, sizes, close }
  useEffect(() => subscribeToEnbxHost(message => {
    if (message.documentSessionId !== source.documentSessionId) return
    if (message.type === 'document:flush') gesturesRef.current.cancel()
    if (message.type === 'document:navigate') {
      const { columns, current, navigate } = actions.current
      navigate(Math.floor(current / columns) * columns + (message.direction === 'previous' ? -columns : columns), String(message.requestId || ''))
    }
    if (message.type === 'document:toggle-pages') { setJumpPage(actions.current.current + 1); setJumpOpen(value => !value) }
  }), [source])
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement).closest('input,textarea,[role=combobox]')) return
      const a = actions.current
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault(); a.navigate(a.current + (event.key === 'ArrowLeft' ? -a.columns : a.columns))
      }
      if (event.key === 'PageDown' || event.key === 'PageUp') {
        event.preventDefault(); gesturesRef.current.cancel()
        viewport.current!.scrollTop += viewport.current!.clientHeight * 0.85 * (event.key === 'PageUp' ? -1 : 1)
      }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [])
  // 可见区加一屏预取；总位图预算约 96 MiB，另留两幅后台绘制缓冲。
  const visible = visiblePages(layout, view.y - view.height, view.y + view.height * 2)
  if (gestures.draft && !visible.some(page => page.index === gestures.draft!.page)) {
    const drawing = layout.pages.find(page => page.index === gestures.draft!.page)
    if (drawing) visible.push(drawing)
  }
  const pixelBudget = Math.floor(96 * 1024 * 1024 / 4 / Math.max(1, visible.length + 2))
  return <ConfigProvider theme={{ token: { controlHeightLG: 48 } }}><div style={styles.root} data-document-viewer>
    <div ref={viewport} data-document-viewport style={{ ...styles.viewport, bottom: toolbarHeight + 124 }}>
      <div style={{ position: 'relative', width: layout.width, height: Math.max(view.height, layout.height) }}>
        {pdf && visible.map(page => <PdfPage key={page.index} pdf={pdf} placement={page} scale={scale}
          inks={annotation.pages[page.index] ?? emptyInk}
          laserInks={annotation.laserPages[page.index] ?? emptyInk}
          draft={gestures.draft?.page === page.index ? gestures.draft.inks : undefined} queue={queue} pixelBudget={pixelBudget}
          priority={page.y + page.height >= view.y && page.y <= view.y + view.height ? 0 : 1} />)}
      </div>
    </div>
    {(!pdf || error) && <div role={error ? 'alert' : 'status'} style={styles.message}>{error || '正在读取 PDF…'}</div>}
    <div ref={toolbar} style={{ ...styles.toolbar, [left ? 'left' : 'right']: 24 }} data-document-toolbar
      onPointerDown={() => gestures.stop()}>
      <Space wrap size={8}>
        <Button size='large' onClick={() => { setJumpPage(current + 1); setJumpOpen(true) }} disabled={!pdf}>
          {columns === 2 ? `${Math.floor(current / 2) * 2 + 1}–${Math.min(sizes.length, Math.floor(current / 2) * 2 + 2)}` : current + 1} / {sizes.length}
        </Button>
        <Select size='large' aria-label='页面布局' value={columns} onChange={value => { rememberAnchor(); setColumns(value) }}
          style={{ minWidth: 100 }} options={[{ value: 1, label: '单页' }, { value: 2, label: '双页' }]} />
        <Select size='large' aria-label='翻页方式' value={continuous ? 'continuous' : 'paged'}
          onChange={value => { rememberAnchor(); setContinuous(value === 'continuous') }}
          options={[{ value: 'continuous', label: '连续滚动' }, { value: 'paged', label: '分页查看' }]} />
        <Select size='large' aria-label='页面缩放' value={fit} onChange={value => { rememberAnchor(); setFit(value) }}
          options={[{ value: 'width', label: '适合宽度' }, { value: 'page', label: '整页' },
            { value: 'custom', label: `${Math.round(scale * 100)}%` }]} />
        <Button size='large' aria-label='手指输入策略' aria-pressed={fingerInk} onClick={() => setFingerInk(value => !value)}>
          {fingerInk ? '手指书写' : '手指移动'}</Button>
        <Button size='large' aria-label='滚动惯性' aria-pressed={inertia} onClick={() => { gestures.stop(); setInertia(value => !value) }}>
          {inertia ? '惯性开' : '惯性关'}</Button>
        <Button size='large' onClick={() => setLeft(value => !value)}>换边</Button>
        <Button size='large' loading={closing} onClick={() => void close()}>退出</Button>
      </Space>
      <div style={styles.status}><Typography.Text ellipsis style={{ maxWidth: 260 }}>{source.fileName}</Typography.Text>
        <Button type='link' onClick={() => void annotation.save().catch(() => undefined)}>{annotation.saveStatus}</Button>
        <span>双指移动 / 缩放</span></div>
    </div>
    <Modal title={`跳转页面（共 ${sizes.length} 页）`} open={jumpOpen} onCancel={() => setJumpOpen(false)}
      onOk={() => { if (jumpPage) navigate(jumpPage - 1); setJumpOpen(false) }} okText='跳转' cancelText='取消'>
      <InputNumber size='large' aria-label='目标页码' min={1} max={sizes.length} value={jumpPage}
        onChange={setJumpPage} style={{ width: '100%', marginBlock: 24 }} />
    </Modal>
  </div></ConfigProvider>
}
