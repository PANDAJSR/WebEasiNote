import type { CSSProperties } from 'react'

export const audioStyles: Record<string, CSSProperties> = {
  bar: { position: 'relative', height: 64, fontSize: 12, fontFamily: 'Segoe UI, Microsoft YaHei, sans-serif',
    display: 'flex', alignItems: 'center', userSelect: 'none', color: '#ffffff' },
  background: { position: 'absolute', inset: 0, borderRadius: 32, border: '2px solid #ffffff80',
    background: '#575f73cc', transition: 'opacity 200ms', pointerEvents: 'none' },
  play: { position: 'relative', flexShrink: 0, width: 48, height: 48, boxSizing: 'border-box',
    marginLeft: 8, marginRight: 14, borderRadius: 24, border: '2px solid #dfe0e2',
    background: '#575e73', display: 'grid', placeItems: 'center', padding: 0, cursor: 'pointer', color: '#ffffffcc' },
  button: { position: 'relative', background: 'transparent', border: 0, padding: 3,
    color: '#ffffffcc', cursor: 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0 },
  ring: { position: 'absolute', inset: -2, pointerEvents: 'none' },
  main: { position: 'relative', width: 270, flexShrink: 0 },
  row: { display: 'flex', alignItems: 'center', height: 16 },
  time: { marginLeft: 6, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' },
  points: { display: 'flex', height: 26, overflow: 'hidden', alignItems: 'flex-end' },
  point: { flexShrink: 0, height: 20, padding: '0 4px', marginRight: 6, borderRadius: 3,
    border: '1px solid currentColor', color: '#ffffff4d', background: 'transparent', font: 'inherit', cursor: 'pointer' },
  shrink: { position: 'relative', marginLeft: 12, marginRight: 16, height: 48,
    display: 'flex', alignItems: 'center', borderLeft: '1px solid #00000033', paddingLeft: 3 },
  volume: { position: 'absolute', bottom: 30, left: -52, width: 120, height: 34,
    border: '1px solid #ffffff33', borderRadius: 3, background: '#333333cc', display: 'flex', alignItems: 'center', padding: '0 12px', boxSizing: 'border-box', zIndex: 3 },
  error: { position: 'absolute', left: 0, top: 68, borderRadius: 3, padding: '4px 8px',
    background: '#333333ee', color: '#ffdb9c', whiteSpace: 'nowrap', zIndex: 3 }
}

export const audioInteractionCss = `
[data-audio-control] button:hover { color: #ffffff !important; }
[data-audio-control] button:active { color: #ffffff99 !important; }
[data-audio-control] button:disabled { opacity: .33; cursor: default !important; }
`
