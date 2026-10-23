import type { CSSProperties } from 'react'

export const questionStyles: Record<string, CSSProperties> = {
  panel: { position: 'absolute', right: 16, bottom: 16, width: 'min(520px, calc(100% - 32px))',
    maxHeight: 'calc(100% - 32px)', overflow: 'auto', zIndex: 20, padding: 20,
    background: '#ffffff', color: '#1f2937', border: '1px solid #d9d9d9', borderRadius: 12,
    boxShadow: '0 6px 24px #00000026', pointerEvents: 'auto', fontSize: 16 },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: { fontSize: 20, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', margin: '16px 0' },
  options: { display: 'grid', gap: 8 },
  option: { height: 'auto', minHeight: 40, padding: '8px 12px', textAlign: 'left',
    whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', justifyContent: 'flex-start' },
  footer: { display: 'flex', gap: 12, alignItems: 'center', marginTop: 16, flexWrap: 'wrap' }
}
