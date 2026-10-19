import type { HttpCourseware } from './http-courseware'

/** 首屏后持续推进；每次提交工作前让出主线程，并重新选择当前页附近的任务。 */
export class CloudPreloader {
  private index = 0
  private busy = false
  private stopped = false
  private timer?: ReturnType<typeof setTimeout>
  private wake?: () => void

  constructor(private readonly source: HttpCourseware) {}

  update(index: number, busy: boolean) {
    if (this.busy !== busy || this.index !== index) {
      console.info(`[CloudLoading] preload-update session=${this.source.sessionId} page=${index + 1} paused=${busy}`)
    }
    this.index = index
    this.busy = busy
  }

  private yield(delay = 50) {
    return new Promise<void>(resolve => {
      this.wake = resolve
      this.timer = setTimeout(() => { this.wake = undefined; resolve() }, delay)
    })
  }

  async run() {
    const { source } = this
    const pages = new Set<number>()
    const resources = new Set<string>()
    const attemptedResources = new Set<string>()
    let failures = 0
    console.info(`[CloudLoading] preload-scheduled session=${source.sessionId} delay=700`)
    await this.yield(700)
    while (!this.stopped && !source.controller.signal.aborted) {
      await this.yield()
      if (this.stopped || source.controller.signal.aborted) break
      if (this.busy) continue
      // 当前页图片优先，随后向两侧展开页面及其静态资源。
      const current = source.loaded.get(this.index)
      const currentResources = current ? source.staticResourcePaths(current) : []
      currentResources.forEach(path => resources.add(path))
      let resource = currentResources.find(path => !attemptedResources.has(path)) ||
        [...resources].find(path => !attemptedResources.has(path))
      const page = source.descriptors.map((_, index) => index)
        .filter(index => !pages.has(index))
        .sort((a, b) => Math.abs(a - this.index) - Math.abs(b - this.index) || b - a)[0]
      try {
        if (resource) {
          attemptedResources.add(resource)
          await source.warmResource(resource)
        } else if (page !== undefined) {
          pages.add(page)
          await source.prefetch(page)
          const slide = source.loaded.get(page)
          if (slide) source.staticResourcePaths(slide).forEach(path => resources.add(path))
        } else {
          // 兜底预热未被解析器识别的静态引用，避免格式兼容性影响图片下载。
          const remaining = source.staticResourcePaths().find(path => !attemptedResources.has(path))
          if (!remaining) break
          resource = remaining
          attemptedResources.add(remaining)
          await source.warmResource(remaining)
        }
      } catch (error) {
        if (this.stopped || source.controller.signal.aborted) break
        failures++
        console.warn(`[CloudLoading] preload-failed session=${source.sessionId} page=${page === undefined ? '-' : page + 1} resource=${resource || '-'}`, error)
      }
    }
    console.info(`[CloudLoading] preload-${this.stopped || source.controller.signal.aborted ? 'cancelled' : 'complete'} session=${source.sessionId} pages=${pages.size} resources=${attemptedResources.size} failures=${failures}`)
  }

  stop() {
    this.stopped = true
    clearTimeout(this.timer)
    this.wake?.()
    this.wake = undefined
  }
}
