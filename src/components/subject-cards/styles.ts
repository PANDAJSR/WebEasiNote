import type { CSSProperties } from 'react'

export const brand = '#00c881'
export const chineseFont = '"楷体_GB2312", KaiTi, "楷体", serif'
export const subjectStyles: Record<string, CSSProperties> = {
  card: { boxSizing: 'border-box', background: '#ffffff', color: '#191d26',
    borderRadius: 2, boxShadow: '0 0 17px #00000012', display: 'flex', flexDirection: 'column',
    fontFamily: '"Microsoft YaHei", Arial, sans-serif' },
  header: { display: 'flex', alignItems: 'center', gap: 12, padding: '0 20px', height: 98,
    background: '#f4f6f9', flexShrink: 0, borderRadius: '2px 2px 0 0' },
  button: { boxSizing: 'border-box', border: '1px solid #dbdee4', borderRadius: 2, background: '#ffffff',
    color: '#626773', padding: 0, height: 24, width: 60, fontSize: 12, fontFamily: 'inherit', cursor: 'pointer', flexShrink: 0 },
  accent: { border: 0, borderRadius: 2, background: brand, color: '#ffffff', height: 30,
    fontSize: 12, cursor: 'pointer', padding: '0 16px', flexShrink: 0 },
  icon: { padding: 0, border: 0, background: 'transparent', width: 24, height: 24,
    color: brand, cursor: 'pointer', flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },
  tabs: { display: 'flex', height: 44, borderBottom: '1px solid #eceef3', flexShrink: 0 },
  tab: { border: 0, borderBottom: '2px solid transparent', background: 'transparent', color: '#191d26',
    font: 'inherit', fontSize: 16, width: 100, height: 44, padding: 0, flexShrink: 0, cursor: 'pointer' },
  content: { padding: '10px 30px 18px', overflow: 'auto', minHeight: 0, flex: 1, whiteSpace: 'pre-wrap', fontSize: 24, lineHeight: 2 },
  entry: { padding: '0 0 4px' },
  secondary: { color: '#626773' },
  grid: { position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  hanzi: { fontFamily: '"华文楷体", STKaiti, KaiTi, serif', fontSize: 130, zIndex: 1, lineHeight: 1 },
  hanziStroke: { position: 'relative', zIndex: 1, overflow: 'visible', flexShrink: 0 },
  footer: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 },
  popup: { position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', background: '#ffffff',
    boxShadow: '0 2px 12px #00000024', borderRadius: 4, padding: '4px 8px', zIndex: 10 },
  flat: { border: 0, background: 'transparent', color: 'inherit', padding: 0, cursor: 'pointer', font: 'inherit' },
  pageTab: { width: 74, height: 38, border: '1px solid #eceef3', borderRadius: '0 6px 6px 0',
    background: '#ffffff', boxShadow: '0 0 4px #00000012', color: '#626773', fontSize: 14, cursor: 'pointer' },
  dialog: { position: 'fixed', inset: '8vh 8vw', zIndex: 10000, background: '#ffffff', color: '#191d26',
    borderRadius: 4, boxShadow: '0 0 0 100vmax #00000066', display: 'flex', flexDirection: 'column',
    fontFamily: '"Microsoft YaHei", sans-serif', overflow: 'hidden' }
}
