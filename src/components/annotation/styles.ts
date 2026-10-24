import type { CSSProperties } from 'react'

export const annotationStyles: Record<string, CSSProperties> = {
  surface: { position: 'absolute', inset: 0, zIndex: 2147483646, touchAction: 'none', outline: 'none', cursor: 'crosshair' },
  preview: { position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' },
  eraser: { position: 'absolute', pointerEvents: 'none', border: '1px solid #555555',
    background: '#ffffff55', transform: 'translate(-50%, -50%)' },
  toolbar: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '6px 12px',
    background: '#ffffff', borderBottom: '1px solid #eeeeee', flexShrink: 0 }
}
