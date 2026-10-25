import type { CSSProperties } from 'react'

export const documentStyles: Record<string, CSSProperties> = {
  root: { position: 'fixed', inset: 0, background: '#343840', color: '#ffffff' },
  viewport: { position: 'absolute', inset: '12px', overflow: 'auto', touchAction: 'none',
    overscrollBehavior: 'none', userSelect: 'none', scrollBehavior: 'auto' },
  toolbar: { position: 'absolute', bottom: 104, maxWidth: 'calc(100% - 48px)', padding: '12px 16px',
    borderRadius: 12, background: '#ffffff', color: '#222222', boxShadow: '0 4px 20px #0004' },
  status: { display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, color: '#666666', marginTop: 4 },
  message: { position: 'absolute', top: 40, left: 40, padding: 16, background: '#222222', borderRadius: 8 }
}
