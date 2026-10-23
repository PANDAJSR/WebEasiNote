import type { CSSProperties } from 'react'

export const matchingStyles: Record<string, CSSProperties> = {
  launcher: { position: 'absolute', right: 12, bottom: 12, zIndex: 12 },
  panel: { position: 'absolute', inset: '4%', zIndex: 15, padding: 20, display: 'flex', flexDirection: 'column',
    gap: 14, borderRadius: 12, background: '#ffffff', color: '#1f2937', boxShadow: '0 4px 24px #00000040' },
  header: { display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' },
  body: { overflow: 'auto', flex: 1, minHeight: 0 },
  row: { display: 'flex', alignItems: 'center', gap: 12, padding: '6px 0', flexWrap: 'wrap' },
  label: { minWidth: 120, flex: 1 },
  target: { minWidth: 120, minHeight: 44, border: '2px dashed #94a3b8', borderRadius: 6,
    padding: '6px 12px', background: '#f8fafc', color: '#1f2937', cursor: 'pointer', verticalAlign: 'middle' },
  materials: { display: 'flex', flexWrap: 'wrap', gap: 8, borderTop: '1px solid #e2e8f0', paddingTop: 12 },
  material: { touchAction: 'none' },
  ghost: { position: 'fixed', pointerEvents: 'none', zIndex: 30, padding: '6px 12px', borderRadius: 6,
    background: '#dbeafe', boxShadow: '0 2px 10px #00000033', maxWidth: 240 },
  content: { display: 'inline-block', position: 'relative', overflow: 'hidden', verticalAlign: 'middle', pointerEvents: 'none' }
}
