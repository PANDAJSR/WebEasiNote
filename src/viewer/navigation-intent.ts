/** 一次只提交最后一次导航；取消立即结束等待，共享文件下载可以继续供缓存使用。 */
export class NavigationIntent {
  private generation = 0
  private reject: ((reason: Error) => void) | null = null

  cancel(message = '翻页已取消') {
    this.generation++
    this.reject?.(new Error(message))
    this.reject = null
  }

  async run(load: () => Promise<unknown>, commit: () => Promise<void>, timeoutMs = 40000) {
    this.cancel('翻页已被替代')
    const generation = this.generation
    const canceled = new Promise<never>((_, reject) => { this.reject = reject })
    const timer = setTimeout(() => {
      if (generation === this.generation) this.cancel('翻页超时，请重试')
    }, timeoutMs)
    try {
      await Promise.race([load(), canceled])
      if (generation !== this.generation) throw new Error('翻页已取消')
      await Promise.race([commit(), canceled])
    } finally {
      clearTimeout(timer)
      if (generation === this.generation) this.reject = null
    }
  }
}
