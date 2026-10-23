import type { CSSProperties } from 'react'

const shadowUrl = new URL('./assets/shadow-bottom-radius4-thin.png', import.meta.url).href

export const selectionStyles: Record<string, CSSProperties> = {
  surface: { position: 'absolute', inset: 0, zIndex: 2147483646, touchAction: 'none',
    userSelect: 'none', outline: 'none' },
  box: { position: 'absolute', outline: '1.5px solid #168cff', boxSizing: 'border-box',
    pointerEvents: 'none', transformOrigin: 'center' },
  handle: { position: 'absolute', width: 12, height: 12, borderRadius: '50%',
    background: '#ffffff', border: '2px solid #168cff', transform: 'translate(-50%, -50%)',
    pointerEvents: 'auto', touchAction: 'none' },
  rotationStem: { position: 'absolute', left: '50%', width: 1, height: 24,
    background: '#168cff', transform: 'translateX(-50%)' },
  // EasiNote 5.2.4.10148 DisplayFunctionBar 静态样式，WPF DIP 按 CSS px 还原。
  menu: { position: 'absolute', display: 'inline-flex', padding: 0, border: 0, borderRadius: 4,
    background: '#f4f6f9cc', isolation: 'isolate', pointerEvents: 'auto' },
  menuShadow: { position: 'absolute', pointerEvents: 'none', zIndex: -1, inset: '-5px -7px -9px',
    boxSizing: 'border-box', borderStyle: 'solid', borderColor: 'transparent', borderWidth: '9px 11px 13px',
    borderImageSource: `url("${shadowUrl}")`,
    borderImageSlice: '8.998744061822 10.998464964449 12.998185867076 10.998464964449 fill',
    borderImageWidth: '9px 11px 13px 11px', borderImageRepeat: 'stretch' },
  menuRow: { display: 'flex', alignItems: 'center', padding: 0, gap: 0, borderRadius: 4,
    overflow: 'hidden', background: '#f4f6f9cc' },
  separator: { flex: '0 0 1px', width: 1, height: 36, margin: '0 4px', background: 'rgba(25, 29, 38, 0.1)' },
  button: { appearance: 'none', boxSizing: 'border-box', flex: '0 0 64px', width: 64, height: 56,
    margin: 0, padding: '2px 0 0', border: 0, borderRadius: 0, background: 'transparent', color: '#626773',
    fontFamily: '"Microsoft YaHei", sans-serif', fontSize: 12, fontWeight: 400, fontStyle: 'normal',
    lineHeight: '20px', letterSpacing: 'normal', textTransform: 'none', display: 'flex', alignItems: 'center',
    justifyContent: 'center', outline: 'none', whiteSpace: 'nowrap', touchAction: 'none', cursor: 'pointer' },
  buttonLayout: { display: 'flex', flexDirection: 'column', alignItems: 'center', pointerEvents: 'none' },
  buttonIcon: { display: 'block', width: 24, height: 24, flex: 'none', marginBottom: 3,
    fill: 'currentColor', overflow: 'hidden' },
  buttonLabel: { display: 'block', whiteSpace: 'nowrap', lineHeight: '20px' }
}
