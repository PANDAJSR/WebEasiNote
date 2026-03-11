import type { CSSProperties } from 'react'
import type { MathFormulaElement } from '../types'

interface MathFormulaRendererProps {
  element: MathFormulaElement
  scale: number
}

export function MathFormulaRenderer({ element, scale }: MathFormulaRendererProps) {
  const baseFontSize = Math.max(14, Math.min(element.width, element.height) * 0.35) * scale

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
    lineHeight: 1.2,
    overflow: 'hidden',
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
        style={{
          maxWidth: '100%',
          maxHeight: '100%',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
        dangerouslySetInnerHTML={{ __html: element.mathML }}
      />
    </div>
  )
}
