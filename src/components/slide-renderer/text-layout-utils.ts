import type { TextElement } from '../../types'
import { buildFontFamily } from '../../font-utils'

let textMeasureCanvas: HTMLCanvasElement | null = null

export function measureRunWidth(
  run: TextElement['textLines'][number]['textRuns'][number],
  scale: number
): number {
  const content = run.text.replace(/\r/g, '')
  if (!content) return 0
  if (typeof document === 'undefined') {
    return content.length * run.fontSize * scale
  }
  textMeasureCanvas ||= document.createElement('canvas')
  const ctx = textMeasureCanvas.getContext('2d')
  if (!ctx) {
    return content.length * run.fontSize * scale
  }
  const fontStyle = run.fontStyle || 'normal'
  const fontWeight = run.fontWeight || 'normal'
  const fontFamily = buildFontFamily(run.fontFamily) || 'sans-serif'
  ctx.font = `${fontStyle} ${fontWeight} ${(run.fontSize * scale).toFixed(4)}px ${fontFamily}`
  return ctx.measureText(content).width
}

interface VisualLine {
  runs: TextElement['textLines'][number]['textRuns']
}

export function sliceLineRunsByLineProperties(
  textRuns: TextElement['textLines'][number]['textRuns'],
  lineProperties?: Array<{ startOffset: number; length: number }>
): VisualLine[] {
  if (!lineProperties || lineProperties.length <= 1) {
    return [{ runs: textRuns }]
  }

  const breakOffsets = lineProperties.slice(1).map(p => p.startOffset)
  const visualLines: VisualLine[] = []
  let currentRuns: TextElement['textLines'][number]['textRuns'] = []
  let currentOffset = 0
  let breakIndex = 0

  for (const run of textRuns) {
    let runText = run.text
    let runStart = currentOffset

    while (breakIndex < breakOffsets.length && runStart + runText.length > breakOffsets[breakIndex]) {
      const splitAt = breakOffsets[breakIndex] - runStart
      if (splitAt > 0) {
        currentRuns.push({
          ...run,
          text: runText.slice(0, splitAt)
        })
      }
      visualLines.push({ runs: currentRuns })
      currentRuns = []
      runText = runText.slice(splitAt)
      runStart = breakOffsets[breakIndex]
      breakIndex += 1
    }

    if (runText.length > 0) {
      currentRuns.push({
        ...run,
        text: runText
      })
    }
    currentOffset += run.text.length
  }

  if (currentRuns.length > 0 || visualLines.length === 0) {
    visualLines.push({ runs: currentRuns })
  }

  return visualLines
}
