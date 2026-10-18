import type { SlideData, SlideIssue } from './types'
import { isFontFamilyMissing } from './font-utils'

export function collectMissingFontIssues(slides: SlideData[]): SlideIssue[] {
  const issues: SlideIssue[] = []
  const seen = new Set<string>()
  slides.forEach(slide => {
    slide.elements.forEach(element => {
      const textLines = (() => {
        if (element.type === 'text') return element.textLines
        if (element.type === 'shape') return element.inlineText || []
        return []
      })()
      if (textLines.length === 0) return
      const elementType = element.type === 'shape' ? element.geometryType || 'Shape' : element.type
      textLines.forEach(line => {
        const markerFont = line.textMarkerStyle?.fontFamily?.trim()
        if (markerFont && isFontFamilyMissing(markerFont)) {
          const markerKey = `${slide.id}|${element.id}|marker|${markerFont}`
          if (!seen.has(markerKey)) {
            seen.add(markerKey)
            issues.push({
              kind: 'missing-font',
              slideId: slide.id,
              elementType,
              elementId: element.id,
              name: markerFont,
              value: '列表符号字体不可用'
            })
          }
        }
        line.textRuns.forEach(run => {
          const fontName = run.fontFamily?.trim()
          if (!fontName || !isFontFamilyMissing(fontName)) return
          const key = `${slide.id}|${element.id}|run|${fontName}`
          if (seen.has(key)) return
          seen.add(key)
          issues.push({
            kind: 'missing-font',
            slideId: slide.id,
            elementType,
            elementId: element.id,
            name: fontName,
            value: '文本字体不可用'
          })
        })
      })
    })
  })
  return issues
}

