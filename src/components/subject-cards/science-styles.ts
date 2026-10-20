import type { CSSProperties } from 'react'

export const scienceStyles: Record<string, CSSProperties> = {
  button: { background: '#1d1e26cd', color: '#ffffff', border: '1px solid #ffffff33', borderRadius: 4,
    height: 32, padding: '0 10px', fontSize: 12, cursor: 'pointer' },
  zoom: { background: '#1d1e26cd', color: '#ffffff', border: '1px solid #ffffff33', borderRadius: 3,
    height: 32, width: 37, fontSize: 22, padding: 0, cursor: 'pointer' },
  reset: { background: '#1d1e26cd', color: '#00c881', border: '1px solid #ffffff33', borderRadius: '50%',
    width: 47, height: 47, fontSize: 38, lineHeight: '40px', cursor: 'pointer', padding: 0 },
  maps: { position: 'absolute', right: 100, bottom: 52, display: 'grid', gap: 4, padding: 8,
    width: 160, background: '#1d1e26ee', border: '1px solid #ffffff33', borderRadius: 4 }
}
