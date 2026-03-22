import { useEffect, useMemo, useRef } from 'react'
import type { CSSProperties } from 'react'
import type { TextElement, TextLine, TextRun } from '../../parser'
import { buildFontFamily } from '../../font-utils'
import { convertSeewoLineSpacingToMultiplier } from '../../line-spacing'

interface EditableTextOverlayProps {
  element: TextElement
  onCommit: (nextTextLines: TextLine[]) => void
  onCancel: () => void
  onLiveChange?: (nextTextLines: TextLine[]) => void
}

interface TextSegment {
  text: string
  styleKey: string
}

const BLOCK_LINE_TAGS = new Set(['DIV', 'P', 'LI'])

const defaultRunTemplate: TextRun = {
  text: '',
  fontFamily: 'Arial',
  fontSize: 16,
  fontStyle: 'normal',
  fontWeight: 'normal',
  color: '#000000'
}

function getLineHeight(line: TextLine): string {
  if (line.fixedLineSpacing && line.fixedLineSpacing > 0) {
    return `${line.fixedLineSpacing}px`
  }
  const multiplier = convertSeewoLineSpacingToMultiplier(line.lineSpacing)
  if (multiplier) return `${multiplier}`
  return 'normal'
}

function cloneRunTemplate(run?: TextRun): TextRun {
  return {
    ...(run || defaultRunTemplate),
    text: ''
  }
}

function extractTextRunsFromLineNode(
  lineNode: Node,
  fallbackStyleKey: string
): TextSegment[] {
  const segments: TextSegment[] = []

  const pushSegment = (text: string, styleKey: string) => {
    const sanitizedText = text.replace(/\u200b/g, '')
    if (!sanitizedText) return
    const previous = segments[segments.length - 1]
    if (previous && previous.styleKey === styleKey) {
      previous.text += sanitizedText
      return
    }
    segments.push({ text: sanitizedText, styleKey })
  }

  const walk = (node: Node, activeStyleKey: string) => {
    if (node.nodeType === Node.TEXT_NODE) {
      pushSegment(node.textContent || '', activeStyleKey)
      return
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return
    const element = node as HTMLElement
    if (element.tagName === 'BR') {
      pushSegment('\n', activeStyleKey)
      return
    }

    // contentEditable 在换行编辑后可能出现嵌套块级节点，跳过它们可避免跨行文本重复采集
    if (element !== lineNode && BLOCK_LINE_TAGS.has(element.tagName)) {
      return
    }

    const nextStyleKey = element.dataset.styleKey || activeStyleKey
    Array.from(element.childNodes).forEach(child => walk(child, nextStyleKey))
  }

  walk(lineNode, fallbackStyleKey)
  return segments
}

function buildEditableTextLines(root: HTMLDivElement, sourceLines: TextLine[]): TextLine[] {
  const styleTemplateMap = new Map<string, TextRun>()
  sourceLines.forEach((line, lineIndex) => {
    line.textRuns.forEach((run, runIndex) => {
      styleTemplateMap.set(`${lineIndex}-${runIndex}`, run)
    })
  })

  const fallbackLine = sourceLines[0] || {
    textRuns: [defaultRunTemplate],
    textAlignment: 'Left' as const,
    textMarker: 'None'
  }
  const childLineNodes = Array.from(root.children)
  const lineNodes: Node[] = childLineNodes.length > 0
    ? childLineNodes
    : [root]

  const nextLines: TextLine[] = []
  lineNodes.forEach((lineNode, lineIndex) => {
    const sourceLine = sourceLines[Math.min(lineIndex, Math.max(sourceLines.length - 1, 0))] || fallbackLine
    const fallbackStyleKey = `${Math.min(lineIndex, Math.max(sourceLines.length - 1, 0))}-0`
    const sourceSegments = extractTextRunsFromLineNode(lineNode, fallbackStyleKey)

    const segments = sourceSegments.length > 0
      ? sourceSegments
      : [{ text: '', styleKey: fallbackStyleKey }]

    const expandedByLineBreak: TextSegment[][] = [[]]
    segments.forEach(segment => {
      const parts = segment.text.split('\n')
      parts.forEach((part, index) => {
        const currentLine = expandedByLineBreak[expandedByLineBreak.length - 1]
        if (part) {
          currentLine.push({ text: part, styleKey: segment.styleKey })
        }
        if (index < parts.length - 1) {
          expandedByLineBreak.push([])
        }
      })
    })

    expandedByLineBreak.forEach(lineSegments => {
      const textRuns = lineSegments.map(segment => {
        const sourceRun = styleTemplateMap.get(segment.styleKey)
          || sourceLine.textRuns[0]
          || fallbackLine.textRuns[0]
          || defaultRunTemplate
        return {
          ...cloneRunTemplate(sourceRun),
          text: segment.text
        }
      })

      nextLines.push({
        ...sourceLine,
        textRuns: textRuns.length > 0 ? textRuns : [cloneRunTemplate(sourceLine.textRuns[0] || fallbackLine.textRuns[0])]
      })
    })
  })

  if (nextLines.length === 0) {
    return [{
      ...fallbackLine,
      textRuns: [cloneRunTemplate(fallbackLine.textRuns[0])]
    }]
  }

  return nextLines
}

export function EditableTextOverlay({ element, onCommit, onCancel, onLiveChange }: EditableTextOverlayProps) {
  const editorRef = useRef<HTMLDivElement | null>(null)
  const hasCommittedRef = useRef(false)

  const containerStyle: CSSProperties = useMemo(() => {
    return {
      position: 'absolute',
      left: 0,
      top: 0,
      width: '100%',
      height: '100%',
      pointerEvents: 'auto',
      cursor: 'text',
      zIndex: 30,
      overflow: 'hidden',
      boxSizing: 'border-box',
      padding: '10px',
      backgroundColor: 'rgba(255, 255, 255, 0.01)',
      writingMode: element.arrangingType === 'Vertical' ? 'vertical-rl' : 'horizontal-tb',
      transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
      transformOrigin: 'center center'
    }
  }, [element.arrangingType, element.rotation])

  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return
    editor.focus()
    const selection = window.getSelection()
    if (!selection) return
    const range = document.createRange()
    range.selectNodeContents(editor)
    range.collapse(false)
    selection.removeAllRanges()
    selection.addRange(range)
  }, [])

  const commit = () => {
    if (hasCommittedRef.current) return
    const editor = editorRef.current
    if (!editor) return
    hasCommittedRef.current = true
    const nextTextLines = buildEditableTextLines(editor, element.textLines)
    onCommit(nextTextLines)
  }

  const handleBlur = () => {
    commit()
  }

  const handleInput = () => {
    const editor = editorRef.current
    if (!editor || !onLiveChange) return
    const nextTextLines = buildEditableTextLines(editor, element.textLines)
    onLiveChange(nextTextLines)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      hasCommittedRef.current = true
      onCancel()
      return
    }
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault()
      commit()
    }
  }

  return (
    <div
      style={containerStyle}
      onMouseDown={event => {
        event.stopPropagation()
      }}
      onDoubleClick={event => {
        event.stopPropagation()
      }}
      onClick={event => {
        event.stopPropagation()
      }}
    >
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        spellCheck={false}
        onBlur={handleBlur}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        style={{
          width: '100%',
          minHeight: '100%',
          outline: 'none',
          userSelect: 'text',
          WebkitUserSelect: 'text'
        }}
      >
        {element.textLines.map((line, lineIndex) => {
          const alignment = (line.textAlignment || 'Left').toLowerCase() as 'left' | 'center' | 'right'
          return (
            <div
              key={lineIndex}
              style={{
                textAlign: alignment,
                lineHeight: getLineHeight(line),
                direction: line.direction === 'RightToLeft' ? 'rtl' : 'ltr',
                marginTop: line.spaceBefore || 0,
                marginBottom: line.spaceAfter || 0,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                textIndent: line.indentType === 'FirstLine' && (line.indent || 0) !== 0
                  ? `${line.indent || 0}px`
                  : undefined,
                paddingLeft: line.marginLeft || 0
              }}
            >
              {(line.textRuns.length > 0 ? line.textRuns : [defaultRunTemplate]).map((run, runIndex) => (
                <span
                  key={runIndex}
                  data-style-key={`${lineIndex}-${runIndex}`}
                  style={{
                    fontFamily: buildFontFamily(run.fontFamily),
                    fontSize: run.fontSize,
                    fontStyle: run.fontStyle,
                    fontWeight: run.fontWeight,
                    color: run.color,
                    textDecoration: run.decoration === 'Underline' ? 'underline' : 'none',
                    whiteSpace: 'inherit'
                  }}
                >
                  {run.text || (runIndex === 0 ? '\u200b' : '')}
                </span>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
