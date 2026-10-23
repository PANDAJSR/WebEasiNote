import type { HanziStroke } from './hanzi-strokes'

export interface StrokeFrame {
  completed: number[]
  current: number
  progress: number
  highlights: number[]
  manual: boolean
}

export interface StrokeClock {
  now: () => number
  request: (callback: () => void) => number
  cancel: (id: number) => void
}

const emptyFrame = (): StrokeFrame => ({ completed: [], current: -1, progress: 0, highlights: [], manual: false })

/** 单步、连写及点笔强调共用可取消的时间轴，离页时不遗留定时器。 */
export class HanziStrokePlayer {
  private frame = emptyFrame()
  private mode: 'step' | 'auto' | 'manual' | null = null
  private order = -1
  private busy = false
  private request: number | null = null
  private start = 0
  private resetAt: number | null = null
  private disposed = false

  constructor(private strokes: HanziStroke[], private publish: (frame: StrokeFrame) => void,
    private clock: StrokeClock = {
      now: () => performance.now(), request: callback => requestAnimationFrame(callback),
      cancel: id => cancelAnimationFrame(id)
    }) {}

  private emit() { this.publish({ ...this.frame, completed: [...this.frame.completed], highlights: [...this.frame.highlights] }) }

  reset() {
    if (this.request !== null) this.clock.cancel(this.request)
    this.request = null
    this.resetAt = null
    this.busy = false
    this.mode = null
    this.order = -1
    this.frame = emptyFrame()
    if (!this.disposed) this.emit()
  }

  dispose() { this.disposed = true; this.reset() }

  play(mode: 'step' | 'auto') {
    if (this.disposed || !this.strokes.length || (mode === 'step' && this.mode === 'step' && this.busy)) return
    const next = mode === 'step' && this.mode === 'step' && this.order < this.strokes.length - 1 ? this.order + 1 : 0
    const completed = next ? this.frame.completed : []
    this.reset()
    this.mode = mode
    this.frame.completed = completed
    this.begin(next)
  }

  highlight(index: number) {
    if (this.disposed || !this.strokes[index] || (this.mode === 'manual' && this.busy)) return
    const highlights = this.mode === 'manual' ? this.frame.highlights : []
    this.reset()
    this.mode = 'manual'
    this.frame.manual = true
    this.frame.highlights = highlights
    if (highlights.includes(index)) {
      this.frame.highlights = highlights.filter(item => item !== index)
      this.emit()
    } else this.begin(index)
  }

  private begin(index: number) {
    this.order = index
    this.busy = true
    this.start = this.clock.now()
    this.frame.current = index
    this.frame.progress = 0
    this.emit()
    this.schedule()
  }

  private schedule() { this.request = this.clock.request(() => this.tick()) }

  private tick() {
    this.request = null
    if (this.disposed) return
    const now = this.clock.now()
    if (this.resetAt !== null) {
      if (now >= this.resetAt) this.reset()
      else this.schedule()
      return
    }
    this.frame.progress = Math.min(1, (now - this.start) / this.strokes[this.order].duration)
    if (this.frame.progress < 1) { this.emit(); this.schedule(); return }
    this.busy = false
    this.frame.current = -1
    if (this.mode === 'manual') this.frame.highlights.push(this.order)
    else this.frame.completed.push(this.order)
    this.emit()
    if (this.mode === 'auto' && this.order < this.strokes.length - 1) this.begin(this.order + 1)
    else if (this.mode !== 'manual' && this.order === this.strokes.length - 1) {
      this.resetAt = now + 1000
      this.schedule()
    }
  }
}
