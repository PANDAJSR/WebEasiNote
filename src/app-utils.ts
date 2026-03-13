export type ViewMode = 'welcome' | 'loading' | 'error' | 'viewer'

export type ENBXWatchState = {
  handle: FileSystemFileHandle
  lastModified: number
  size: number
}

export const AUTO_RELOAD_STORAGE_KEY = 'webeasinote:autoReloadEnabled'
export const CLICK_TO_NEXT_STORAGE_KEY = 'webeasinote:clickToNextEnabled'

export type PickerWindow = Window & {
  showOpenFilePicker?: (options?: {
    multiple?: boolean
    excludeAcceptAllOption?: boolean
    types?: Array<{
      description: string
      accept: Record<string, string[]>
    }>
  }) => Promise<FileSystemFileHandle[]>
}

export function ensureSpinKeyframes() {
  if (typeof document === 'undefined') return
  if (document.getElementById('spin-keyframes')) return

  const styleSheet = document.createElement('style')
  styleSheet.id = 'spin-keyframes'
  styleSheet.textContent = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `
  document.head.appendChild(styleSheet)
}

export function revokeObjectUrls(map: Record<string, string>) {
  Object.values(map).forEach(url => {
    URL.revokeObjectURL(url)
  })
}
