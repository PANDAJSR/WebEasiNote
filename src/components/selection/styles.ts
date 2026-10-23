import type { CSSProperties } from 'react'

export const selectionStyles: Record<string, CSSProperties> = {
  surface: { position: 'absolute', inset: 0, zIndex: 2147483646, touchAction: 'none',
    userSelect: 'none', outline: 'none' },
  box: { position: 'absolute', outline: '1.5px solid #168cff', boxSizing: 'border-box',
    pointerEvents: 'none', transformOrigin: 'center' },
  handle: { position: 'absolute', width: 12, height: 12, borderRadius: '50%',
    background: '#ffffff', border: '2px solid #168cff', transform: 'translate(-50%, -50%)',
    pointerEvents: 'auto', touchAction: 'none' },
  rotationStem: { position: 'absolute', left: '50%', width: 1, height: 24,
    background: '#168cff', transform: 'translateX(-50%)' },
  menu: { position: 'absolute', display: 'flex', gap: 2, padding: 4, background: '#ffffff',
    borderRadius: 6, boxShadow: '0 2px 12px #00000030', pointerEvents: 'auto' },
  button: { padding: '6px 14px', background: 'transparent', color: '#333333', border: 0,
    fontSize: 14, cursor: 'pointer', borderRadius: 4, whiteSpace: 'nowrap', touchAction: 'none' }
}
