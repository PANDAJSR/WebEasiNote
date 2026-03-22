import type { TextLine, TextRun } from '../parser'
import type { TextSelectionRange, TextStyleCommand } from './text-style-commands'

const FONT_SIZE_MIN = 8
const FONT_SIZE_MAX = 300

function normalizeRunText(value: string): string {
  return value.replace(/\r\n|\r|\n/g, '')
}

function getTotalTextLength(lines: TextLine[]): number {
  if (lines.length === 0) return 0
  let total = 0
  lines.forEach(line => {
    line.textRuns.forEach(run => {
      total += normalizeRunText(run.text || '').length
    })
  })
  return total
}

function cloneRun(run: TextRun, text: string): TextRun {
  return {
    ...run,
    text
  }
}

function clampFontSize(value: number): number {
  if (!Number.isFinite(value)) return FONT_SIZE_MIN
  return Math.max(FONT_SIZE_MIN, Math.min(FONT_SIZE_MAX, value))
}

function isSameStyle(a: TextRun, b: TextRun): boolean {
  return a.fontFamily === b.fontFamily
    && a.fontSize === b.fontSize
    && a.fontStyle === b.fontStyle
    && a.fontWeight === b.fontWeight
    && a.color === b.color
    && a.decoration === b.decoration
    && a.opacity === b.opacity
    && JSON.stringify(a.gradient || null) === JSON.stringify(b.gradient || null)
    && JSON.stringify(a.textEffects || null) === JSON.stringify(b.textEffects || null)
}

function mergeAdjacentRuns(runs: TextRun[]): TextRun[] {
  if (runs.length === 0) return []
  const merged: TextRun[] = []
  runs.forEach(run => {
    const previous = merged[merged.length - 1]
    if (previous && isSameStyle(previous, run)) {
      previous.text += run.text
      return
    }
    merged.push({ ...run })
  })
  return merged
}

interface ResolvedTargetRange {
  start: number
  end: number
  isPartialRange: boolean
}

function resolveTargetRange(lines: TextLine[], selectionRange?: TextSelectionRange | null): ResolvedTargetRange {
  const totalLength = getTotalTextLength(lines)
  if (
    selectionRange
    && Number.isFinite(selectionRange.start)
    && Number.isFinite(selectionRange.end)
    && selectionRange.end > selectionRange.start
  ) {
    const start = Math.max(0, Math.min(totalLength, selectionRange.start))
    const end = Math.max(start, Math.min(totalLength, selectionRange.end))
    return {
      start,
      end,
      isPartialRange: end > start
    }
  }
  return {
    start: 0,
    end: totalLength,
    isPartialRange: false
  }
}

function collectTargetRuns(
  lines: TextLine[],
  targetRange: ResolvedTargetRange
): TextRun[] {
  const matches: TextRun[] = []
  const applyWholeLine = !targetRange.isPartialRange
  let cursor = 0
  lines.forEach(line => {
    line.textRuns.forEach(run => {
      const plainText = normalizeRunText(run.text || '')
      const runLength = plainText.length
      const runStart = cursor
      const runEnd = cursor + runLength
      const overlaps = targetRange.end > runStart && targetRange.start < runEnd
      if ((applyWholeLine && runLength === 0) || overlaps) {
        matches.push(run)
      }
      cursor = runEnd
    })
  })
  return matches
}

function resolveToggleValue(command: TextStyleCommand, targetRuns: TextRun[]): boolean | null {
  if (targetRuns.length === 0) {
    if (command.type === 'toggle-bold' || command.type === 'toggle-italic' || command.type === 'toggle-underline') {
      return true
    }
    return null
  }

  switch (command.type) {
    case 'toggle-bold':
      return !targetRuns.every(run => run.fontWeight === 'bold')
    case 'toggle-italic':
      return !targetRuns.every(run => run.fontStyle === 'italic')
    case 'toggle-underline':
      return !targetRuns.every(run => run.decoration === 'Underline')
    default:
      return null
  }
}

function applyCommandToRun(run: TextRun, command: TextStyleCommand, toggleValue: boolean | null): TextRun {
  switch (command.type) {
    case 'set-font-family': {
      const fontFamily = typeof command.value === 'string' ? command.value.trim() : ''
      if (!fontFamily) return { ...run }
      return { ...run, fontFamily }
    }
    case 'set-font-size': {
      const rawSize = typeof command.value === 'number' ? command.value : Number(command.value)
      return { ...run, fontSize: clampFontSize(rawSize) }
    }
    case 'adjust-font-size': {
      const delta = typeof command.value === 'number' ? command.value : Number(command.value)
      return { ...run, fontSize: clampFontSize((run.fontSize || FONT_SIZE_MIN) + (Number.isFinite(delta) ? delta : 0)) }
    }
    case 'set-color': {
      const color = typeof command.value === 'string' ? command.value.trim() : ''
      if (!color) return { ...run }
      return { ...run, color }
    }
    case 'toggle-bold':
      return { ...run, fontWeight: toggleValue ? 'bold' : 'normal' }
    case 'toggle-italic':
      return { ...run, fontStyle: toggleValue ? 'italic' : 'normal' }
    case 'toggle-underline':
      return { ...run, decoration: toggleValue ? 'Underline' : 'None' }
    default:
      return { ...run }
  }
}

function ensureFallbackRuns(lines: TextLine[]): TextLine[] {
  return lines.map(line => {
    if (line.textRuns.length > 0) return line
    return {
      ...line,
      textRuns: [{
        text: '',
        fontFamily: 'Arial',
        fontSize: 16,
        fontStyle: 'normal',
        fontWeight: 'normal',
        color: '#000000',
        decoration: 'None'
      }]
    }
  })
}

export function applyTextStyleCommand(
  sourceLines: TextLine[],
  command: TextStyleCommand,
  selectionRange?: TextSelectionRange | null
): TextLine[] {
  const safeSourceLines = ensureFallbackRuns(sourceLines)
  const targetRange = resolveTargetRange(safeSourceLines, selectionRange)
  const targetRuns = collectTargetRuns(safeSourceLines, targetRange)
  const toggleValue = resolveToggleValue(command, targetRuns)

  let cursor = 0
  const nextLines = safeSourceLines.map(line => {
    const nextRuns: TextRun[] = []
    line.textRuns.forEach(run => {
      const plainText = normalizeRunText(run.text || '')
      const runLength = plainText.length
      const runStart = cursor
      const runEnd = cursor + runLength
      const shouldApplyWhole = !targetRange.isPartialRange

      if (shouldApplyWhole) {
        nextRuns.push(applyCommandToRun(run, command, toggleValue))
        cursor = runEnd
        return
      }

      if (runLength <= 0 || targetRange.end <= runStart || targetRange.start >= runEnd) {
        nextRuns.push({ ...run })
        cursor = runEnd
        return
      }

      const splitStart = Math.max(0, targetRange.start - runStart)
      const splitEnd = Math.min(runLength, targetRange.end - runStart)
      const beforeText = plainText.slice(0, splitStart)
      const targetText = plainText.slice(splitStart, splitEnd)
      const afterText = plainText.slice(splitEnd)

      if (beforeText) {
        nextRuns.push(cloneRun(run, beforeText))
      }
      if (targetText) {
        nextRuns.push(applyCommandToRun(cloneRun(run, targetText), command, toggleValue))
      }
      if (afterText) {
        nextRuns.push(cloneRun(run, afterText))
      }

      cursor = runEnd
    })

    return {
      ...line,
      textRuns: mergeAdjacentRuns(nextRuns)
    }
  })

  return nextLines
}
