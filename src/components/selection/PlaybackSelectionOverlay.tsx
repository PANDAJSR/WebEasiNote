import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import type { SlideData, SlideElement } from '../../types'
import type { PlaybackSelection } from '../../viewer/usePlaybackSelection'
import { handlePosition, resizeSelection, rotatePoint, selectionBounds,
  selectionHandles, selectionMembers, snapSelectionRotation, transformSelection,
  type SelectionBounds, type SelectionHandle, type SelectionPoint } from '../../viewer/selection-geometry'
import { selectionStyles as styles } from './styles'
import { hitSelectionElement } from '../../viewer/selection-hit-test'
import { SelectionActionBar } from './SelectionActionBar'
import { cloneSelection } from '../../viewer/selection-clone'

interface PlaybackSelectionOverlayProps {
  slide: SlideData
  scale: number
  selection: PlaybackSelection
  elementDisplayStyles: Record<string, CSSProperties>
  elementRenderStates: Record<string, boolean>
  onPreview: (elements: SlideElement[] | null) => void
  resourceMap: Record<string, string>
}
interface Gesture {
  pointerId: number
  start: SelectionPoint
  original: SlideElement[]
  bounds: SelectionBounds
  handle: SelectionHandle | 'move' | 'rotate'
  next: SlideElement[] | null
  clones: SlideElement[] | null
}

export function PlaybackSelectionOverlay({ slide, scale, selection, elementDisplayStyles,
  elementRenderStates, onPreview, resourceMap }: PlaybackSelectionOverlayProps) {
  const surface = useRef<HTMLDivElement>(null)
  const gesture = useRef<Gesture | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [preview, setPreview] = useState<SlideElement[] | null>(null)
  const [previewBounds, setPreviewBounds] = useState<SelectionBounds | null>(null)
  const selected = slide.elements.find(element => element.id === selectedId)
  const members = selected ? selectionMembers(slide.elements, selected) : []
  const bounds = members.length ? previewBounds || selectionBounds(members) : null
  const onPreviewRef = useRef(onPreview)
  onPreviewRef.current = onPreview

  useEffect(() => () => {
    gesture.current = null
    onPreviewRef.current(null)
  }, [slide.id])

  useEffect(() => {
    if (!selectedId || slide.elements.some(element => element.id === selectedId)) return
    setSelectedId(null)
  }, [selectedId, slide.elements])

  const point = (event: ReactPointerEvent): SelectionPoint => {
    const rect = surface.current!.getBoundingClientRect()
    return { x: (event.clientX - rect.left) / scale, y: (event.clientY - rect.top) / scale }
  }
  const clearGesture = () => {
    const active = gesture.current
    gesture.current = null
    if (active && surface.current?.hasPointerCapture(active.pointerId)) surface.current.releasePointerCapture(active.pointerId)
    setPreview(null)
    setPreviewBounds(null)
    onPreview(null)
  }
  const visible = (element: SlideElement) => {
    if (element.isLocked || element.type === 'unknown') return false
    if (selectionMembers(slide.elements, element).some(member => member.isLocked)) return false
    const style = elementDisplayStyles[element.id]
    if (elementRenderStates[element.id] === false || Number(style?.opacity ?? 1) <= 0) return false
    // 正在运动的元素等动画结束后才允许变换，避免在动画坐标和页面坐标之间跳动。
    const node = surface.current?.parentElement?.querySelector<HTMLElement>(`[data-element-id="${CSS.escape(element.id)}"]`)
    return !node || !node.getAnimations?.().some(animation => animation.playState === 'running')
  }
  const handleStart = (event: ReactPointerEvent, handle?: SelectionHandle | 'rotate') => {
    if (event.button !== 0 || gesture.current) return
    event.preventDefault()
    event.stopPropagation()
    surface.current?.focus({ preventScroll: true })
    const start = point(event)
    let target = selected
    if (!handle) {
      target = [...slide.elements].reverse().find(element => visible(element) && hitSelectionElement(element, start, scale))
      setSelectedId(target?.id || null)
    }
    if (!target) return
    const original = selectionMembers(slide.elements, target)
    if (!original.every(visible)) return
    gesture.current = { pointerId: event.pointerId, start, original, bounds: selectionBounds(original),
      handle: handle || 'move', next: null, clones: null }
    surface.current?.setPointerCapture(event.pointerId)
  }
  const handleMove = (event: ReactPointerEvent) => {
    const active = gesture.current
    if (!active || event.pointerId !== active.pointerId) return
    event.preventDefault()
    const position = point(event)
    const delta = { x: position.x - active.start.x, y: position.y - active.start.y }
    if (Math.hypot(delta.x, delta.y) * scale < 3 && !active.next) return
    const from = active.bounds
    let next = { ...from }
    if (active.handle === 'move') {
      next.x += delta.x
      next.y += delta.y
    } else if (active.handle === 'rotate') {
      const center = { x: from.x + from.width / 2, y: from.y + from.height / 2 }
      const startAngle = Math.atan2(active.start.y - center.y, active.start.x - center.x)
      const angle = Math.atan2(position.y - center.y, position.x - center.x)
      next.rotation = snapSelectionRotation((from.rotation || 0) + (angle - startAngle) * 180 / Math.PI,
        from.rotation || 0, Math.hypot(position.x - center.x, position.y - center.y) * scale, event.shiftKey, event.altKey)
    } else {
      const proportional = active.original.length > 1 || event.shiftKey
      next = resizeSelection(from, active.handle, delta, proportional, event.ctrlKey)
    }
    if (active.handle === 'move' && active.original.every(element => element.canClone) && !active.clones) {
      active.clones = cloneSelection(active.original)
    }
    active.next = transformSelection(active.clones || active.original, from, next)
    setPreview(active.next)
    setPreviewBounds(next)
    onPreview(active.next)
  }
  const handleEnd = (event: ReactPointerEvent) => {
    if (gesture.current?.pointerId !== event.pointerId) return
    const { next, clones } = gesture.current
    clearGesture()
    if (next) {
      if (clones) selection.onDuplicate(next)
      else selection.onChange(next)
    }
  }
  const handleCommand = (command: 'bring-front' | 'delete') => {
    clearGesture()
    selection.onCommand(command, members.map(element => element.id))
    if (command === 'delete') setSelectedId(null)
  }

  const corners = bounds ? [[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([x, y]) => {
    const offset = rotatePoint({ x: x * bounds.width / 2, y: y * bounds.height / 2 }, bounds.rotation || 0)
    return { x: (bounds.x + bounds.width / 2 + offset.x) * scale,
      y: (bounds.y + bounds.height / 2 + offset.y) * scale }
  }) : []
  const bottom = Math.max(...corners.map(corner => corner.y)) + 16
  const menuTop = bottom + 48 < slide.height * scale - 90 ? bottom
    : Math.max(6, Math.min(...corners.map(corner => corner.y)) - 56)

  return <div ref={surface} style={styles.surface} tabIndex={0} data-playback-selection
    onPointerDown={event => handleStart(event)} onPointerMove={handleMove} onPointerUp={handleEnd}
    onPointerCancel={clearGesture} onLostPointerCapture={() => { if (gesture.current) clearGesture() }}
    onBlur={clearGesture} onClick={event => { event.preventDefault(); event.stopPropagation() }}
    onDoubleClick={event => { event.preventDefault(); event.stopPropagation() }}
    onContextMenu={event => event.preventDefault()}
    onKeyDown={event => {
      if ((event.target as HTMLElement).closest('input, textarea, select, button, [role="slider"]')) return
      if (event.key === 'Escape') { clearGesture(); setSelectedId(null); event.stopPropagation() }
      if (event.key === 'Delete' && members.length) { handleCommand('delete'); event.stopPropagation() }
    }}>
    {bounds && <>
      <div style={{ ...styles.box, left: bounds.x * scale, top: bounds.y * scale,
        width: bounds.width * scale, height: bounds.height * scale, transform: `rotate(${bounds.rotation || 0}deg)` }}>
        {selectionHandles.map(handle => {
          const position = handlePosition(handle)
          return <div key={handle} role='button' aria-label={`缩放 ${handle}`} style={{ ...styles.handle,
            left: `${position.x * 100}%`, top: `${position.y * 100}%`, cursor: `${handle}-resize` }}
            onPointerDown={event => handleStart(event, handle)} />
        })}
        <div style={{ ...styles.rotationStem, top: -24 }} />
        <div role='button' aria-label='旋转' style={{ ...styles.handle, left: '50%', top: -28, cursor: 'grab' }}
          onPointerDown={event => handleStart(event, 'rotate')} />
      </div>
      {!preview && <SelectionActionBar members={members} selection={selection} top={menuTop}
        resourceMap={resourceMap}
        left={Math.max(6, Math.min(slide.width * scale - 380, (bounds.x + bounds.width / 2) * scale - 190))}
        onDelete={() => handleCommand('delete')} />}
    </>}
  </div>
}
