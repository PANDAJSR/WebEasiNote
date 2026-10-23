import type { SlideElement } from '../../types'
import type { PlaybackSelection } from '../../viewer/usePlaybackSelection'
import { resolveShapeIsClosed } from '../../rendering/shape-stroke'
import { selectionStyles as styles } from './styles'
import { PictureActions } from './PictureActions'

interface SelectionActionBarProps {
  members: SlideElement[]
  selection: PlaybackSelection
  left: number
  top: number
  onDelete: () => void
  resourceMap: Record<string, string>
}

export function SelectionActionBar({ members, selection, left, top, onDelete, resourceMap }: SelectionActionBarProps) {
  const shapes = members.filter(element => element.type === 'shape')
  const allShapes = shapes.length === members.length
  const canFill = allShapes && shapes.every(shape => resolveShapeIsClosed(shape.geometryType, shape.path))
  const cloneAllowed = members.every(element => !['video', 'audio', 'flash', 'unknown'].includes(element.type))
  const colorInput = (fill: boolean) => <label style={styles.button}>
    {fill ? '填充' : '描边'}
    <input aria-label={fill ? '填充颜色' : '描边颜色'} type='color'
      style={{ width: 20, height: 20, padding: 0, border: 0, marginLeft: 4, verticalAlign: 'middle' }}
      value={(fill ? shapes[0]?.backgroundColor : shapes[0]?.borderColor)?.match(/^#[0-9a-f]{6}$/i)?.[0] || '#000000'}
      onChange={event => selection.onChange(shapes.map(shape => fill
        ? { ...shape, backgroundColor: event.target.value, backgroundBrush: undefined }
        : { ...shape, borderColor: event.target.value, borderWidth: Math.max(1, shape.borderWidth || 1) }))} />
  </label>
  return <div style={{ ...styles.menu, top, left, maxWidth: `calc(100% - ${left + 6}px)`, flexWrap: 'wrap' }}
    onPointerDown={event => event.stopPropagation()}>
    {members.length === 1 && members[0].type === 'picture' && <PictureActions picture={members[0]}
      resourceMap={resourceMap} onChange={picture => selection.onChange([picture])} />}
    {allShapes && colorInput(false)}
    {canFill && colorInput(true)}
    <button style={styles.button} onClick={() => selection.onCommand('bring-front', members.map(element => element.id))}>置顶</button>
    {cloneAllowed && <button style={{ ...styles.button, background: members.every(element => element.canClone) ? '#e6f4ff' : undefined }}
      aria-pressed={members.every(element => element.canClone)} onClick={() => {
        const canClone = !members.every(element => element.canClone)
        selection.onChange(members.map(element => ({ ...element, canClone })))
      }}>克隆</button>}
    <button style={styles.button} onClick={onDelete}>删除</button>
  </div>
}
