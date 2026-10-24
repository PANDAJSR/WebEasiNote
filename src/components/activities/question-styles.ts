import type { CSSProperties } from 'react'

export const questionStyles: Record<string, CSSProperties> = {
  panel: { position: 'absolute', inset: '8%', display: 'flex', flexDirection: 'column',
    color: '#1f2937', pointerEvents: 'none', fontSize: 24 },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, pointerEvents: 'auto' },
  title: { fontSize: 32, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', margin: '24px 0' },
  options: { display: 'grid', gap: 16, flex: 1, minHeight: 0, overflow: 'auto', pointerEvents: 'auto' },
  option: { height: 'auto', minHeight: 48, fontSize: 26, padding: '8px 12px', textAlign: 'left', background: '#ffffff40',
    whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', justifyContent: 'flex-start' },
  footer: { display: 'flex', gap: 12, alignItems: 'center', marginTop: 16, flexWrap: 'wrap', pointerEvents: 'auto' }
}
