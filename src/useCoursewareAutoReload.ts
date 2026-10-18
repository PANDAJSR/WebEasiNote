import { useEffect, useRef } from 'react'
import type { ENBXWatchState, ViewMode } from './app-utils'

export function useCoursewareAutoReload({ autoReloadEnabled, watchedENBX, viewMode, loadENBXFile, setWatchedENBX }: {
  autoReloadEnabled: boolean
  watchedENBX: ENBXWatchState | null
  viewMode: ViewMode
  loadENBXFile: (file: File, options?: { autoReload?: boolean }) => Promise<boolean>
  setWatchedENBX: (value: ENBXWatchState) => void
}) {
  const autoReloadingRef = useRef(false)
  useEffect(() => {
    if (!autoReloadEnabled || !watchedENBX || viewMode !== 'viewer') return
    let disposed = false
    const timerId = window.setInterval(async () => {
      if (autoReloadingRef.current) return
      autoReloadingRef.current = true
      try {
        const latestFile = await watchedENBX.handle.getFile()
        const hasChanged =
          latestFile.lastModified !== watchedENBX.lastModified ||
          latestFile.size !== watchedENBX.size
        if (!hasChanged) return
        console.log('[App] 检测到 ENBX 文件变化，开始自动重载...')
        const loaded = await loadENBXFile(latestFile, { autoReload: true })
        if (loaded && !disposed) {
          setWatchedENBX({
            handle: watchedENBX.handle,
            lastModified: latestFile.lastModified,
            size: latestFile.size
          })
        }
      } catch (err) {
        console.warn('[App] 自动检测 ENBX 文件变化失败:', err)
      } finally {
        autoReloadingRef.current = false
      }
    }, 2000)
    return () => {
      disposed = true
      window.clearInterval(timerId)
    }
  }, [autoReloadEnabled, watchedENBX, viewMode])

}
