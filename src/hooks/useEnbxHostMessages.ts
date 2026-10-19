import { useEffect } from 'react'
import type { Dispatch, SetStateAction, MutableRefObject } from 'react'
import { isEnbxHostRuntime, postToEnbxHost, subscribeToEnbxHost, type EnbxHostMessage } from '../platform/host-bridge'
import type { ViewMode } from '../viewer/app-utils'

interface HostMessageOptions {
  loadENBXUrlRef: MutableRefObject<(url: string, fileName: string) => Promise<boolean>>
  openManifest: (url: string) => void
  viewModeRef: MutableRefObject<ViewMode>
  setNavigationCommand: Dispatch<SetStateAction<{ id: number; direction: 'previous' | 'next'; requestId: string } | null>>
  setToggleThumbnailsCommand: Dispatch<SetStateAction<{ side: 'left' | 'right'; id: number } | null>>
  setClickToNextEnabled: (value: boolean) => void
  setSwipeNavigationEnabled: (value: boolean) => void
}

export function useEnbxHostMessages({ loadENBXUrlRef, openManifest, viewModeRef, setNavigationCommand,
  setToggleThumbnailsCommand, setClickToNextEnabled, setSwipeNavigationEnabled }: HostMessageOptions) {
  useEffect(() => {
    if (!isEnbxHostRuntime()) return
    const handleHostMessage = async (message: EnbxHostMessage) => {
      try {
        if (message.type === 'enbx:open') {
          if (message.sourceKind === 'http-manifest' && typeof message.manifestUrl === 'string') {
            openManifest(message.manifestUrl)
            return
          }
          const url = typeof message.url === 'string' ? message.url : ''
          const fileName = typeof message.fileName === 'string' ? message.fileName : 'courseware.enbx'
          if (url) await loadENBXUrlRef.current(url, fileName)
          return
        }
        if (message.type === 'enbx:navigate') {
          const requestId = typeof message.requestId === 'string' ? message.requestId : ''
          const direction = message.direction === 'previous' ? 'previous' : 'next'
          if (viewModeRef.current === 'viewer') {
            setNavigationCommand({
              id: Date.now() + Math.random(),
              direction,
              requestId
            })
          } else {
            postToEnbxHost({ type: 'enbx:navigation-complete', requestId, page: 0 })
          }
          return
        }
        if (message.type === 'enbx:toggle-thumbnails') {
          const side = message.side === 'left' ? 'left' : 'right'
          setToggleThumbnailsCommand(prev => ({
            side,
            id: (prev?.id ?? 0) + 1
          }))
          return
        }
        if (message.type === 'enbx:update-settings') {
          if (typeof message.clickToNextEnabled === 'boolean') {
            setClickToNextEnabled(message.clickToNextEnabled)
          }
          if (typeof message.swipeNavigationEnabled === 'boolean') {
            setSwipeNavigationEnabled(message.swipeNavigationEnabled)
          }
          return
        }
      } catch (error) {
        postToEnbxHost({
          type: 'enbx:error',
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }
    return subscribeToEnbxHost(handleHostMessage)
  }, [])
}
