import type { CSSProperties } from 'react'

export const competitionStyles: Record<string, CSSProperties> = {
  panel: { position: 'absolute', inset: 12, color: '#1e293b',
    display: 'flex', flexDirection: 'column', padding: 12, gap: 10, pointerEvents: 'none' },
  header: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', pointerEvents: 'auto' },
  board: { flex: 1, minHeight: 0, display: 'flex', gap: 4 },
  lane: { flex: 1, position: 'relative', overflow: 'hidden', borderLeft: '1px solid #94a3b8' },
  score: { position: 'absolute', inset: '0 0 auto 0', zIndex: 2, padding: 8, background: '#ffffffed',
    textAlign: 'center', fontWeight: 600 },
  drop: { position: 'absolute', width: '46%', minHeight: 48, height: 'auto', padding: 6,
    overflowWrap: 'anywhere', whiteSpace: 'normal', touchAction: 'none', pointerEvents: 'auto',
    border: 0, background: 'transparent', boxShadow: 'none' },
  summary: { position: 'absolute', inset: 0, background: '#ffffffee', display: 'flex', alignItems: 'center',
    justifyContent: 'center', flexDirection: 'column', gap: 12, zIndex: 3 },
}
