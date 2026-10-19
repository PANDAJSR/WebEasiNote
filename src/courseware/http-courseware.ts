import JSZip from 'jszip'
import { parseSlideXML } from '../enbx/parser'
import type { CoursewareMetadata, SlideData } from '../enbx/parser'
import { parseReferenceXML } from '../enbx/pictures'

interface Manifest {
  protocolVersion: number
  sessionId: string
  name: string
  files: { path: string; size: number; hash: string }[]
}

export interface SlideDescriptor {
  id: string
  path: string
  width: number
  height: number
  thumbnail?: string
  state: 'unrequested' | 'loading' | 'core-ready' | 'error'
}

/** HTTP 文件源只下载元数据与请求的正文；资源 URL 交给实际渲染器读取。 */
export class HttpCourseware {
  readonly descriptors: SlideDescriptor[] = []
  readonly loaded = new Map<number, SlideData>()
  readonly resources: Record<string, string> = {}
  readonly controller = new AbortController()
  private readonly tasks = new Map<number, Promise<SlideData>>()
  private readonly backgroundTasks = new Set<number>()
  private readonly warmed = new Set<string>()
  private readonly staticPaths = new Map<string, string>()
  private readonly slideResources = new WeakMap<SlideData, string[]>()
  private readonly entries = new Set<string>()
  private baseUrl = ''
  private readonly previewCache = new Map<number, SlideData>()
  private previewQueue: Promise<unknown> = Promise.resolve()
  sessionId = ''
  metadata!: CoursewareMetadata

  async open(manifestUrl: string) {
    this.baseUrl = new URL('.', manifestUrl).href
    const manifest = await this.readUrl<Manifest>(manifestUrl, 'json')
    if (manifest.protocolVersion !== 1 || !manifest.files?.length) throw new Error('不支持的云课件清单')
    this.sessionId = manifest.sessionId
    for (const file of manifest.files) {
      if (file.path.split('/').some(part => !part || part === '.' || part === '..') || file.path.includes('\\')) {
        throw new Error('云课件包含无效文件路径')
      }
      this.entries.add(file.path)
    }
    const [boardXml, reference] = await Promise.all([
      this.readText('Board.xml'),
      this.entries.has('Reference.xml') ? this.readText('Reference.xml') : Promise.resolve('')
    ])
    const board = this.parseXml(boardXml)
    const ids = Array.from(board.querySelectorAll('Board > Slides > Item'), item => item.textContent?.trim() || '')
    if (!ids.length || ids.some(id => !id) || new Set(ids).size !== ids.length) throw new Error('课件页目录为空或 ID 重复')
    const paths = [...this.entries].filter(path => /^Slides\/Slide_\d+\.xml$/.test(path))
      .sort((a, b) => Number(a.match(/_(\d+)\.xml$/)![1]) - Number(b.match(/_(\d+)\.xml$/)![1]))
    // 样本采用从 0 开始的连续文件序号；每次读正文仍核对 Board ID，不猜测缺页映射。
    if (paths.length !== ids.length || paths.some((path, i) => path !== `Slides/Slide_${i}.xml`)) {
      throw new Error('云课件页文件编号不连续，无法安全按需加载；请关闭懒加载后打开')
    }
    const width = Number(board.querySelector('Board > SlideWidth')?.textContent) || 1280
    const height = Number(board.querySelector('Board > SlideHeight')?.textContent) || 720
    ids.forEach((id, index) => {
      const thumbnail = `SlideThumbnails/Slide_${index}.png`
      this.descriptors.push({ id, path: paths[index], width, height, state: 'unrequested',
        thumbnail: this.entries.has(thumbnail) ? this.url(thumbnail) : undefined })
    })
    for (const [id, path] of Object.entries(parseReferenceXML(reference))) {
      if (this.entries.has(path)) this.resources[id] = this.url(path)
    }
    // 同时提供逻辑路径，兼容直接以路径引用的资源。
    for (const path of this.entries) this.resources[path] = this.url(path)
    for (const path of this.entries) {
      if (/\.(png|jpe?g|gif|webp|bmp|svg|ico|avif|woff2?|ttf|otf)$/i.test(path)) this.staticPaths.set(this.url(path), path)
    }
    this.metadata = { type: 'folder', name: manifest.name, creator: '未知', appVersion: '未知',
      documentVersion: '1.0', modifiedDate: null, slideCount: ids.length,
      resourceCount: [...this.entries].filter(path => path.startsWith('Resources/')).length,
      slideIds: ids, slideFiles: paths, raw: { board: boardXml, document: null } }
    console.info(`[CloudLoading] opened session=${this.sessionId} pages=${ids.length} files=${this.entries.size}`)
    return this
  }

  private parseXml(xml: string) {
    const document = new DOMParser().parseFromString(xml, 'text/xml')
    if (document.querySelector('parsererror')) throw new Error('课件 XML 损坏')
    return document
  }

  url(path: string, prefetch = false) {
    if (!this.entries.has(path)) throw new Error(`课件文件不存在: ${path}`)
    return this.baseUrl + 'files/' + path.split('/').map(encodeURIComponent).join('/') + (prefetch ? '?prefetch=1' : '')
  }

  private async readUrl<T>(url: string, kind: 'json' | 'text' | 'bytes'): Promise<T> {
    const response = await fetch(url, { signal: this.controller.signal })
    if (!response.ok) throw new Error(`读取云课件失败 (${response.status})，请重试`)
    return kind === 'json' ? response.json() : kind === 'text' ? response.text() as Promise<T> : response.arrayBuffer() as Promise<T>
  }

  private readText(path: string) { return this.readUrl<string>(this.url(path), 'text') }

  /** 可见缩略图串行读取，不提交导航正文，最多保留 24 页解析结果。 */
  readonly previewSlide = (index: number, signal: AbortSignal): Promise<SlideData> => {
    const task = this.previewQueue.then(async () => {
      signal.throwIfAborted()
      this.controller.signal.throwIfAborted()
      const descriptor = this.descriptors[index]
      if (!descriptor) throw new Error('页码超出范围')
      const cached = this.loaded.get(index) || this.previewCache.get(index)
      if (cached) {
        if (this.previewCache.delete(index)) this.previewCache.set(index, cached)
        return cached
      }
      const response = await fetch(this.url(descriptor.path, true), {
        signal: AbortSignal.any([signal, this.controller.signal])
      })
      if (!response.ok) throw new Error('读取页面预览失败')
      const xml = await response.text()
      signal.throwIfAborted()
      this.parseXml(xml)
      const slide = parseSlideXML(xml)
      if (slide.id !== descriptor.id) throw new Error('预览页 ID 与目录不符')
      this.previewCache.set(index, slide)
      if (this.previewCache.size > 24) this.previewCache.delete(this.previewCache.keys().next().value!)
      return slide
    })
    this.previewQueue = task.catch(() => undefined)
    return task
  }

  ensureSlide(index: number, background = false): Promise<SlideData> {
    const cached = this.loaded.get(index)
    if (cached) return Promise.resolve(cached)
    const existing = this.tasks.get(index)
    if (existing) {
      if (!background && this.backgroundTasks.delete(index)) {
        console.info(`[CloudLoading] promote session=${this.sessionId} page=${index + 1}`)
        // 相同逻辑路径交给插件合并，并提升尚在排队的后台任务。
        void this.readUrl(this.url(this.descriptors[index].path), 'bytes').catch(() => undefined)
      }
      return existing
    }
    const descriptor = this.descriptors[index]
    if (!descriptor) return Promise.reject(new Error('页码超出范围'))
    descriptor.state = 'loading'
    if (background) this.backgroundTasks.add(index)
    const started = performance.now()
    console.info(`[CloudLoading] page-start session=${this.sessionId} page=${index + 1} background=${background}`)
    const task = (async () => {
      try {
        const xml = await this.readUrl<string>(this.url(descriptor.path, background), 'text')
        this.controller.signal.throwIfAborted()
        this.parseXml(xml)
        const slide = parseSlideXML(xml)
        if (slide.id !== descriptor.id) throw new Error('页 ID 与目录不符，请关闭懒加载后打开')
        slide.thumbnail = descriptor.thumbnail
        descriptor.state = 'core-ready'
        this.loaded.set(index, slide)
        console.info(`[CloudLoading] page-ready session=${this.sessionId} page=${index + 1} ms=${Math.round(performance.now() - started)}`)
        return slide
      } catch (error) {
        descriptor.state = 'error'
        console.warn(`[CloudLoading] page-failed session=${this.sessionId} page=${index + 1}`, error)
        throw error
      } finally { this.tasks.delete(index); this.backgroundTasks.delete(index) }
    })()
    this.tasks.set(index, task)
    return task
  }

  /** 后台解析正文并缓存；不挂载页面、不提交导航。 */
  async prefetch(index: number) {
    const descriptor = this.descriptors[index]
    if (!descriptor || this.loaded.has(index)) return
    await this.ensureSlide(index, true)
  }

  /** 只预热静态资源；音视频和 Flash 保持按需加载。 */
  staticResourcePaths(slide?: SlideData): string[] {
    if (!slide) return [...this.staticPaths.values()]
    const cached = this.slideResources.get(slide)
    if (cached) return cached
    const urls = new Set<string>()
    const visit = (value: unknown) => {
      if (typeof value === 'string' && this.resources[value]) urls.add(this.resources[value])
      else if (Array.isArray(value)) value.forEach(visit)
      else if (value && typeof value === 'object') Object.values(value).forEach(visit)
    }
    visit(slide)
    const paths = [...urls].flatMap(url => this.staticPaths.has(url) ? [this.staticPaths.get(url)!] : [])
    this.slideResources.set(slide, paths)
    return paths
  }

  async warmResource(path: string) {
    if (this.warmed.has(path)) return
    const started = performance.now()
    console.info(`[CloudLoading] resource-start session=${this.sessionId} path=${path}`)
    const response = await fetch(this.url(path, true), { signal: this.controller.signal })
    if (!response.ok) throw new Error(`预取资源失败 (${response.status}): ${path}`)
    // 消费流以完成缓存，不把全部图片字节长期保留在 JS 堆中。
    if (response.body) {
      const reader = response.body.getReader()
      try { while (!(await reader.read()).done) this.controller.signal.throwIfAborted() }
      finally { reader.releaseLock() }
    }
    this.controller.signal.throwIfAborted()
    this.warmed.add(path)
    console.info(`[CloudLoading] resource-ready session=${this.sessionId} path=${path} ms=${Math.round(performance.now() - started)}`)
  }

  /** Viewer 的目录投影；未加载项只供页码、尺寸、缩略图使用，不能作为当前正文。 */
  projectSlides(): SlideData[] {
    return this.descriptors.map((descriptor, index) => this.loaded.get(index) || {
      id: descriptor.id, width: descriptor.width, height: descriptor.height, thumbnail: descriptor.thumbnail,
      backgroundColor: '#ffffff', elements: [], animations: [], animationOrders: [], issues: [],
      loadState: descriptor.state
    })
  }

  async completeFile() {
    const zip = new JSZip()
    // 有界并发；失败即停止本轮导出，不产生残缺文件。
    const paths = [...this.entries]
    let next = 0
    await Promise.all(Array.from({ length: 2 }, async () => {
      while (next < paths.length) {
        const path = paths[next++]
        zip.file(path, await this.readUrl<ArrayBuffer>(this.url(path, true), 'bytes'))
      }
    }))
    const blob = await zip.generateAsync({ type: 'blob' })
    return new File([blob], `${this.metadata.name}.enbx`)
  }

  dispose() {
    console.info(`[CloudLoading] dispose session=${this.sessionId} pages=${this.loaded.size} resources=${this.warmed.size}`)
    this.controller.abort(); this.loaded.clear(); this.previewCache.clear(); this.warmed.clear()
  }
}
