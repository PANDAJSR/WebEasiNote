import { useEffect, useRef } from 'react'
import type { PlaybackAnnotation } from '../usePlaybackSelection'
import { isEnbxHostRuntime } from '../../platform/host-bridge'

/** 宿主负责转发自己的快捷键，浏览器独立运行时在此处理。 */
export function useAnnotationKeyboard(annotation: PlaybackAnnotation, enabled: boolean) {
  const latest = useRef(annotation)
  latest.current = annotation
  useEffect(() => {
    if (!enabled || isEnbxHostRuntime()) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || !(event.ctrlKey || event.metaKey)) return
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]')) return
      const key = event.key.toLowerCase()
      if (key !== 'z' && key !== 'y') return
      event.preventDefault()
      latest.current.command(key === 'y' || event.shiftKey ? 'redo' : 'undo')
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [enabled])
}
