export interface DocumentViewSettings {
  columns: number
  continuous: boolean
  fit: 'width' | 'page' | 'custom'
  scale: number
  fingerInk: boolean
  inertia: boolean
  left: boolean
  current: number
}

export function readViewSettings(key: string): DocumentViewSettings {
  const defaults: DocumentViewSettings = { columns: 1, continuous: true, fit: 'width', scale: 1,
    fingerInk: true, inertia: true, left: false, current: 0 }
  try {
    const value = JSON.parse(localStorage.getItem(`document-view:${key}`) || '{}')
    for (const name of ['continuous', 'fingerInk', 'inertia', 'left'] as const) {
      if (typeof value[name] === 'boolean') defaults[name] = value[name]
    }
    if (value.columns === 2) defaults.columns = 2
    if (['width', 'page', 'custom'].includes(value.fit)) defaults.fit = value.fit
    if (Number.isFinite(value.scale)) defaults.scale = Math.max(0.2, Math.min(4, value.scale))
    if (Number.isInteger(value.current) && value.current >= 0) defaults.current = value.current
  } catch { /* 存储不可用时仍允许查看文档。 */ }
  return defaults
}

export function writeViewSettings(key: string, value: DocumentViewSettings) {
  try { localStorage.setItem(`document-view:${key}`, JSON.stringify(value)) } catch { /* 不阻塞阅读。 */ }
}
