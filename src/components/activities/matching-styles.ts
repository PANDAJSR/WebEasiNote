import type { CSSProperties } from 'react'

export const matchingStyles: Record<string, CSSProperties> = {
  canvas: { position: 'absolute', inset: 0, pointerEvents: 'none' },
  material: { position: 'absolute', touchAction: 'none', pointerEvents: 'auto' },
  target: { display: 'inline-block', boxSizing: 'border-box', border: '2px dashed #94a3b8', borderRadius: 6,
    padding: 4, background: '#ffffff30', color: '#475569', cursor: 'pointer', verticalAlign: 'middle', pointerEvents: 'auto' },
  stem: { position: 'absolute', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'center' },
  result: { position: 'absolute', zIndex: 7, pointerEvents: 'none', color: '#ffffff', borderRadius: 4,
    padding: '2px 6px', fontSize: 16, lineHeight: '20px', transformOrigin: 'center', boxShadow: '0 1px 4px #00000040' },
  controls: { position: 'absolute', right: 12, bottom: 12, display: 'flex', alignItems: 'center', gap: 12,
    pointerEvents: 'auto', zIndex: 8, color: '#1f2937', background: '#ffffffdf', padding: '6px 10px', borderRadius: 6 }
}
