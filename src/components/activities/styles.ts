import type { CSSProperties } from 'react'

export const activityStyles: Record<string, CSSProperties> = {
  frame: { position: 'absolute', boxSizing: 'border-box', transformOrigin: 'center', overflow: 'visible' },
  image: { position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' },
  controls: { position: 'absolute', right: 12, bottom: 12, zIndex: 10, display: 'flex', gap: 12,
    alignItems: 'center', padding: '8px 12px', borderRadius: 8, background: '#ffffff', color: '#1f2937',
    boxShadow: '0 2px 12px #00000026', fontSize: 14 },
  reset: { border: '1px solid #d1d5db', borderRadius: 4, background: '#ffffff', color: '#1f2937',
    padding: '4px 10px', cursor: 'pointer' }
}
