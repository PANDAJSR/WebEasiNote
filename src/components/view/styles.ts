import type { CSSProperties } from 'react'
import type { ViewElement } from '../../types/view'

export function viewStyle(element: ViewElement, scale: number): CSSProperties {
  return { position: 'absolute', left: element.x * scale, top: element.y * scale,
    width: element.width * scale, height: element.height * scale,
    transform: `rotate(${element.rotation}deg)`,
    transformOrigin: `${element.rotateOrigin[0] * 100}% ${element.rotateOrigin[1] * 100}%` }
}

export const viewButtonStyle: CSSProperties = {
  position: 'absolute', border: 0, padding: 0, margin: 0, background: 'transparent',
  cursor: 'pointer', color: 'inherit', touchAction: 'manipulation'
}
