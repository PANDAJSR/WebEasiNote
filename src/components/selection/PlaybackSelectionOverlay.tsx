import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import type { SlideData, SlideElement } from '../../types'
import type { PlaybackSelection } from '../../viewer/usePlaybackSelection'
import { handlePosition, resizeSelection, rotatePoint, selectionBounds,
  selectionContains, selectionHandles, selectionMembers, snapSelectionRotation, transformSelection,
  type SelectionBounds, type SelectionHandle, type SelectionPoint } from '../../viewer/selection-geometry'
import { selectionStyles as styles } from './styles'
import { hitSelectionElement } from '../../viewer/selection-hit-test'
import { SelectionActionBar } from './SelectionActionBar'
import { cloneSelection } from '../../viewer/selection-clone'
import { lassoSelection } from '../../viewer/selection-lasso'
import { pointerToSlide } from '../../viewer/pointer-coordinates'

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
  kind: 'transform'
  pointerId: number
  start: SelectionPoint
  original: SlideElement[]
  bounds: SelectionBounds
  handle: SelectionHandle | 'move' | 'rotate'
  next: SlideElement[] | null
  clones: SlideElement[] | null
  selected: boolean
}
interface LassoGesture {
  kind: 'lasso'
  pointerId: number
  points: SelectionPoint[]
  additive: boolean
}

export function PlaybackSelectionOverlay({ slide, scale, selection, elementDisplayStyles,
  elementRenderStates, onPreview, resourceMap }: PlaybackSelectionOverlayProps) {
  const surface = useRef<HTMLDivElement>(null)
  const gestures = useRef(new Map<number, Gesture | LassoGesture>())
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [lasso, setLasso] = useState<SelectionPoint[] | null>(null)
  const [preview, setPreview] = useState<SlideElement[] | null>(null)
  const [previewBounds, setPreviewBounds] = useState<SelectionBounds | null>(null)
  const members = slide.elements.filter(element => selectedIds.includes(element.id))
  const bounds = members.length ? previewBounds || selectionBounds(members) : null
  const onPreviewRef = useRef(onPreview)
  onPreviewRef.current = onPreview

  useEffect(() => () => {
    gestures.current.clear()
    onPreviewRef.current(null)
  }, [slide.id])

  useEffect(() => {
    setSelectedIds(ids => ids.filter(id => slide.elements.some(element => element.id === id)))
  }, [slide.elements])

  useEffect(() => { setSelectedIds([]); setLasso(null); setPreview(null); setPreviewBounds(null) }, [slide.id])

  const point = (event: ReactPointerEvent): SelectionPoint => {
    const rect = surface.current!.getBoundingClientRect()
    return pointerToSlide(event, rect, scale)
  }
  const refreshPreview = () => {
    const transforms = [...gestures.current.values()].filter((active): active is Gesture => active.kind === 'transform')
    const elements = transforms.flatMap(active => active.next || [])
    const selectedPreview = transforms.find(active => active.selected && active.next)?.next
    setPreview(elements.length ? elements : null)
    setPreviewBounds(selectedPreview ? selectionBounds(selectedPreview) : null)
    setLasso([...gestures.current.values()].find((active): active is LassoGesture => active.kind === 'lasso')?.points || null)
    onPreview(elements.length ? elements : null)
  }
  const clearGesture = (pointerId?: number) => {
    const ids = pointerId === undefined ? [...gestures.current.keys()] : [pointerId]
    for (const id of ids) {
      gestures.current.delete(id)
      if (surface.current?.hasPointerCapture(id)) surface.current.releasePointerCapture(id)
    }
    refreshPreview()
  }
  const visible = (element: SlideElement) => {
    if (element.type === 'ink' && element.brush.kind === 'laser') return false
    if (element.isLocked || element.type === 'unknown' || element.type === 'activity') return false
    if (selectionMembers(slide.elements, element).some(member => member.isLocked || member.type === 'activity')) return false
    const style = elementDisplayStyles[element.id]
    if (elementRenderStates[element.id] === false || Number(style?.opacity ?? 1) <= 0
      || style?.display === 'none' || style?.visibility === 'hidden') return false
    // 正在运动的元素等动画结束后才允许变换，避免在动画坐标和页面坐标之间跳动。
    const node = surface.current?.parentElement?.querySelector<HTMLElement>(`[data-element-id="${CSS.escape(element.id)}"]`)
    return !node || !node.getAnimations?.().some(animation => animation.playState === 'running')
  }
  const handleStart = (event: ReactPointerEvent, handle?: SelectionHandle | 'rotate') => {
    if (event.button !== 0 || gestures.current.has(event.pointerId)) return
    event.preventDefault()
    event.stopPropagation()
    surface.current?.focus({ preventScroll: true })
    const start = point(event)
    let original = members
    if (!handle) {
      const target = [...slide.elements].reverse().find(element => visible(element)
        && selectionMembers(slide.elements, element).every(visible) && hitSelectionElement(element, start, scale))
      const additive = event.shiftKey || event.ctrlKey || event.metaKey
      if (target) {
        const hitMembers = selectionMembers(slide.elements, target)
        original = additive ? slide.elements.filter(element => selectedIds.includes(element.id)
          || hitMembers.some(member => member.id === element.id))
          : selectedIds.includes(target.id) ? members : hitMembers
      } else if (!additive && bounds && selectionContains(bounds, start)) {
        original = members
      } else {
        if (gestures.current.size) return
        gestures.current.set(event.pointerId, { kind: 'lasso', pointerId: event.pointerId, points: [start], additive })
        setLasso([start])
        surface.current?.setPointerCapture(event.pointerId)
        return
      }
    }
    if (!original.length || !original.every(visible)) return
    // 同一元素（含组合）只归一个指针；套索期间不混入元素拖动。
    if ([...gestures.current.values()].some(active => active.kind === 'lasso'
      || active.original.some(element => original.some(member => member.id === element.id)))) return
    const selected = original.every(element => selectedIds.includes(element.id))
    gestures.current.set(event.pointerId, { kind: 'transform', pointerId: event.pointerId, start, original, bounds: selectionBounds(original),
      handle: handle || 'move', next: null, clones: null, selected })
    surface.current?.setPointerCapture(event.pointerId)
  }
  const handleMove = (event: ReactPointerEvent) => {
    const active = gestures.current.get(event.pointerId)
    if (!active) return
    event.preventDefault()
    const position = point(event)
    if (active.kind === 'lasso') {
      const last = active.points[active.points.length - 1]
      if (Math.hypot(position.x - last.x, position.y - last.y) * scale >= 2) {
        active.points.push(position)
        setLasso([...active.points])
      }
      return
    }
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
      next = resizeSelection(from, active.handle, delta, true, event.ctrlKey)
    }
    if (active.handle === 'move' && active.original.every(element => element.canClone) && !active.clones) {
      active.clones = cloneSelection(active.original)
    }
    active.next = transformSelection(active.clones || active.original, from, next)
    refreshPreview()
  }
  const handleEnd = (event: ReactPointerEvent) => {
    const active = gestures.current.get(event.pointerId)
    if (!active) return
    if (active.kind === 'lasso') {
      const enclosed = lassoSelection(slide.elements, [...active.points, point(event)], visible).map(element => element.id)
      setSelectedIds(ids => active.additive ? [...new Set([...ids, ...enclosed])] : enclosed)
      clearGesture(event.pointerId)
      return
    }
    const { next, clones } = active
    clearGesture(event.pointerId)
    if (next) {
      if (clones) { selection.onDuplicate(next); if (active.selected) setSelectedIds(next.map(element => element.id)) }
      else selection.onChange(next)
    } else setSelectedIds(active.original.map(element => element.id))
  }
  const handleCommand = (command: 'bring-front' | 'delete') => {
    clearGesture()
    selection.onCommand(command, members.map(element => element.id))
    if (command === 'delete') setSelectedIds([])
  }

  const corners = bounds ? [[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([x, y]) => {
    const offset = rotatePoint({ x: x * bounds.width / 2, y: y * bounds.height / 2 }, bounds.rotation || 0)
    return { x: (bounds.x + bounds.width / 2 + offset.x) * scale,
      y: (bounds.y + bounds.height / 2 + offset.y) * scale }
  }) : []
  const bottom = Math.max(...corners.map(corner => corner.y)) + 16
  const menuTop = bottom + 56 < slide.height * scale - 90 ? bottom
    : Math.max(6, Math.min(...corners.map(corner => corner.y)) - 72)

  return <div ref={surface} style={styles.surface} tabIndex={0} data-playback-selection
    onPointerDown={event => handleStart(event)} onPointerMove={handleMove} onPointerUp={handleEnd}
    onPointerCancel={event => clearGesture(event.pointerId)}
    onLostPointerCapture={event => { if (gestures.current.has(event.pointerId)) clearGesture(event.pointerId) }}
    onBlur={() => clearGesture()} onClick={event => { event.preventDefault(); event.stopPropagation() }}
    onDoubleClick={event => { event.preventDefault(); event.stopPropagation() }}
    onContextMenu={event => event.preventDefault()}
    onKeyDown={event => {
      if ((event.target as HTMLElement).closest('input, textarea, select, button, [role="slider"]')) return
      if (event.key === 'Escape') { clearGesture(); setSelectedIds([]); event.preventDefault(); event.stopPropagation() }
      if (event.key === 'Delete' && members.length) { handleCommand('delete'); event.preventDefault(); event.stopPropagation() }
    }}>
    {lasso && <svg data-selection-lasso aria-hidden='true' width='100%' height='100%'
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <polygon points={lasso.map(point => `${point.x * scale},${point.y * scale}`).join(' ')}
        fill='#168cff14' stroke='#168cff' strokeWidth={1.5} strokeDasharray='5 3' />
    </svg>}
    {bounds && !lasso && <>
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
        resourceMap={resourceMap} viewportWidth={slide.width * scale}
        left={(bounds.x + bounds.width / 2) * scale}
        onDelete={() => handleCommand('delete')} />}
    </>}
  </div>
}
