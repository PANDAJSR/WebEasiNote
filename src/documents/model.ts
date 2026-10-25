import type { InkElement } from '../types/annotation'

export interface DocumentSource {
  url: string
  fileName: string
  documentSessionId: string
  annotationsUrl: string
  documentKey: string
}
export interface PageSize { width: number; height: number }
export interface PagePlacement extends PageSize { index: number; x: number; y: number; row: number }
export interface DocumentLayout { pages: PagePlacement[]; width: number; height: number }
export type DocumentInk = Record<string, InkElement[]>

/** 页面尺寸与墨迹始终使用旋转后的 PDF point；DPR 只参与栅格绘制。 */
export function layoutPages(sizes: PageSize[], columns: number, scale: number, viewportWidth: number,
  continuous: boolean, current: number): DocumentLayout {
  const gap = 24
  const rows: { index: number; size: PageSize }[][] = []
  sizes.forEach((size, index) => (rows[Math.floor(index / columns)] ??= []).push({ index, size }))
  let y = gap
  const width = Math.max(viewportWidth, ...rows.map(row => row.reduce((sum, item) => sum + item.size.width * scale, 0)
    + gap * (row.length + 1)))
  const pages: PagePlacement[] = []
  rows.forEach((row, rowIndex) => {
    if (!continuous && rowIndex !== Math.floor(current / columns)) return
    const rowWidth = row.reduce((sum, item) => sum + item.size.width * scale, 0) + gap * (row.length - 1)
    let x = (width - rowWidth) / 2
    for (const item of row) {
      pages.push({ index: item.index, row: rowIndex, x, y, width: item.size.width * scale, height: item.size.height * scale })
      x += item.size.width * scale + gap
    }
    y += Math.max(...row.map(item => item.size.height * scale)) + gap
  })
  return { pages, width, height: y }
}

export function inertiaStep(velocity: number, milliseconds: number, tau = 325) {
  const decay = Math.exp(-Math.min(64, Math.max(0, milliseconds)) / tau)
  return { distance: velocity * tau * (1 - decay), velocity: velocity * decay }
}

/** 页面按行顶点排序，二分定位后只扫描相交行。 */
export function visiblePages(layout: DocumentLayout, top: number, bottom: number) {
  const pages = layout.pages
  let low = 0, high = pages.length
  while (low < high) {
    const middle = (low + high) >>> 1
    if (pages[middle].y < top) low = middle + 1
    else high = middle
  }
  // 向前找到前一完整行，处理双页混合高度。
  let start = Math.max(0, low - 1)
  while (start > 0 && pages[start - 1].row === pages[start].row) start--
  const result: PagePlacement[] = []
  for (let index = start; index < pages.length && pages[index].y <= bottom; index++) {
    const page = pages[index]
    if (page.y + page.height >= top) result.push(page)
  }
  return result
}

/** 输入与保存的数据均不允许携带 NaN、无界点数或任意元素类型。 */
export function parseDocumentInk(value: unknown): DocumentInk {
  if (!value || typeof value !== 'object' || (value as { version?: number }).version !== 1) throw new Error('批注格式不受支持')
  const pages = (value as { pages?: DocumentInk }).pages
  if (!pages || typeof pages !== 'object' || Array.isArray(pages)) throw new Error('批注页面格式无效')
  let points = 0
  for (const [key, inks] of Object.entries(pages)) {
    if (!/^\d+$/.test(key) || !Array.isArray(inks)) throw new Error('批注页码无效')
    for (const ink of inks) {
      if (ink?.type !== 'ink' || typeof ink.id !== 'string' || !Array.isArray(ink.points)
        || !ink.points.length || !ink.brush || !/^#[\da-f]{6}([\da-f]{2})?$/i.test(ink.brush.color)
        || ![ink.x, ink.y, ink.width, ink.height, ink.sourceWidth, ink.sourceHeight, ink.rotation,
          ink.brush.width, ink.brush.opacity].every(Number.isFinite)
        || ink.width <= 0 || ink.height <= 0 || ink.sourceWidth <= 0 || ink.sourceHeight <= 0
        || ink.brush.width <= 0 || ink.brush.width > 4096 || ink.brush.opacity < 0 || ink.brush.opacity > 1) {
        throw new Error('批注笔画格式无效')
      }
      points += ink.points.length
      if (points > 2_000_000 || !ink.points.every(p => [p.x, p.y, p.pressure, p.time].every(Number.isFinite))) {
        throw new Error('批注采样点无效或过多')
      }
    }
  }
  return pages
}
