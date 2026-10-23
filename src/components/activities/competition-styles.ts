import type { CSSProperties } from 'react'

export const competitionStyles: Record<string, CSSProperties> = {
  panel: { position: 'absolute', inset: 12, zIndex: 18, background: '#f8fafc', color: '#1e293b',
    borderRadius: 12, display: 'flex', flexDirection: 'column', padding: 12, gap: 10 },
  header: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  board: { flex: 1, minHeight: 0, display: 'flex', gap: 4 },
  lane: { flex: 1, position: 'relative', overflow: 'hidden', background: '#e0f2fe', borderRadius: 8 },
  score: { position: 'absolute', inset: '0 0 auto 0', zIndex: 2, padding: 8, background: '#ffffffed',
    textAlign: 'center', fontWeight: 600 },
  drop: { position: 'absolute', width: '46%', minHeight: 48, height: 'auto', padding: 6,
    overflowWrap: 'anywhere', whiteSpace: 'normal', touchAction: 'none' },
  summary: { position: 'absolute', inset: 0, background: '#ffffffee', display: 'flex', alignItems: 'center',
    justifyContent: 'center', flexDirection: 'column', gap: 12, zIndex: 3 },
  launcher: { position: 'absolute', right: 12, bottom: 12, zIndex: 12 }
}
