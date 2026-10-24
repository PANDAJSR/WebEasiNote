import type { CSSProperties } from 'react'

export const matchingStyles: Record<string, CSSProperties> = {
  canvas: { position: 'absolute', inset: 0, pointerEvents: 'none' },
  material: { position: 'absolute', touchAction: 'none', pointerEvents: 'auto' },
  target: { display: 'inline-block', boxSizing: 'border-box', border: '2px dashed #94a3b8', borderRadius: 6,
    padding: 4, background: '#ffffff30', color: '#475569', cursor: 'pointer', verticalAlign: 'middle', pointerEvents: 'auto' },
  stem: { position: 'absolute', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'center' },
  controls: { position: 'absolute', right: 12, bottom: 12, display: 'flex', alignItems: 'center', gap: 12,
    pointerEvents: 'auto', zIndex: 8, color: '#1f2937', background: '#ffffffdf', padding: '6px 10px', borderRadius: 6 }
}
