import { useLayoutEffect, useRef, useState } from 'react'
import type { SlideElement } from '../../types'
import type { PlaybackSelection } from '../../viewer/usePlaybackSelection'
import { resolveShapeIsClosed } from '../../rendering/shape-stroke'
import { selectionStyles as styles } from './styles'
import { PictureActions } from './PictureActions'
import { SelectionActionButton } from './SelectionActionButton'
import { SelectionColorAction } from './SelectionColorAction'

interface SelectionActionBarProps {
  members: SlideElement[]
  selection: PlaybackSelection
  left: number
  top: number
  viewportWidth: number
  onDelete: () => void
  resourceMap: Record<string, string>
}

export function SelectionActionBar({ members, selection, left, top, viewportWidth, onDelete, resourceMap }: SelectionActionBarProps) {
  const row = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(192)
  const shapes = members.filter(element => element.type === 'shape')
  const allShapes = shapes.length === members.length
  const canFill = allShapes && shapes.every(shape => resolveShapeIsClosed(shape.geometryType, shape.path))
  const cloneAllowed = members.every(element => !['video', 'audio', 'flash', 'unknown'].includes(element.type))
  const picture = members.length === 1 && members[0].type === 'picture' ? members[0] : null
  useLayoutEffect(() => {
    if (!row.current) return
    const measure = () => setWidth(row.current!.offsetWidth || 192)
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(row.current)
    return () => observer.disconnect()
  }, [allShapes, canFill, cloneAllowed, !!picture])
  const menuScale = Math.min(1, Math.max(1, viewportWidth - 14) / width)
  const menuLeft = Math.max(7, Math.min(viewportWidth - width * menuScale - 7, left - width * menuScale / 2))
  return <div role='toolbar' aria-label='元素操作' data-selection-menu
    style={{ ...styles.menu, top, left: menuLeft, transformOrigin: 'top left', transform: `scale(${menuScale})` }}
    onPointerDown={event => event.stopPropagation()}>
    <div aria-hidden='true' style={styles.menuShadow} />
    <div ref={row} style={styles.menuRow}>
      {picture && <PictureActions picture={picture}
        resourceMap={resourceMap} onChange={picture => selection.onChange([picture])} />}
      {allShapes && <SelectionColorAction shapes={shapes} onChange={selection.onChange} />}
      {canFill && <SelectionColorAction shapes={shapes} fill onChange={selection.onChange} />}
      {(picture || allShapes) && <div role='separator' style={styles.separator} />}
      <SelectionActionButton icon='Front' label='置顶' onClick={() => selection.onCommand('bring-front', members.map(element => element.id))} />
      {cloneAllowed && <SelectionActionButton icon='Clone' label='克隆'
        checked={members.every(element => element.canClone)} onClick={() => {
          const canClone = !members.every(element => element.canClone)
          selection.onChange(members.map(element => ({ ...element, canClone })))
        }} />}
      <SelectionActionButton icon='Delete' label='删除' onClick={onDelete} />
    </div>
  </div>
}
