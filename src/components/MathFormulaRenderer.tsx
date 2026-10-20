import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import type { MathFormulaElement } from '../types'

interface MathFormulaRendererProps {
  element: MathFormulaElement
  scale: number
}

export function MathFormulaRenderer({ element, scale }: MathFormulaRendererProps) {
  const baseFontSize = Math.max(14, Math.min(element.width, element.height) * 0.35) * scale
  const contentRef = useRef<HTMLDivElement>(null)
  const [fit, setFit] = useState(1)

  useLayoutEffect(() => {
    const content = contentRef.current
    if (!content) return
    let disposed = false
    const measure = () => {
      if (disposed) return
      // 使用未变换的布局尺寸，避免缩放后的测量反馈造成反复缩放。
      const width = content.offsetWidth
      const height = content.offsetHeight
      if (width > 0 && height > 0) {
        setFit(Math.min(element.width * scale / (width + 1), element.height * scale / (height + 1)))
      }
    }
    measure()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    observer?.observe(content)
    void document.fonts?.ready.then(measure)
    return () => { disposed = true; observer?.disconnect() }
  }, [element.mathML, element.fallbackText, element.width, element.height, scale])

  const containerStyle: CSSProperties = {
    position: 'absolute',
    left: element.x * scale,
    top: element.y * scale,
    width: element.width * scale,
    height: element.height * scale,
    transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
    transformOrigin: 'center center',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: element.color,
    fontSize: baseFontSize,
    fontFamily: '"Cambria Math", "STIX Two Math", math, serif',
    lineHeight: 1.2,
    overflow: 'visible',
    pointerEvents: 'none'
  }

  if (!element.mathML) {
    return (
      <div style={containerStyle}>
        <span>{element.fallbackText || '数学公式'}</span>
      </div>
    )
  }

  return (
    <div style={containerStyle}>
      <div
        ref={contentRef}
        style={{
          flexShrink: 0,
          width: 'max-content',
          whiteSpace: 'nowrap',
          transform: `scale(${fit})`,
          transformOrigin: 'center center',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
        dangerouslySetInnerHTML={{ __html: element.mathML }}
      />
    </div>
  )
}
