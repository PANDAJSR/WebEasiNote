import { useState } from 'react'
import { ColorPicker } from 'antd'
import type { ShapeElement } from '../../types'
import { SelectionActionButton } from './SelectionActionButton'

interface SelectionColorActionProps {
  shapes: ShapeElement[]
  fill?: boolean
  onChange: (shapes: ShapeElement[]) => void
}

export function SelectionColorAction({ shapes, fill = false, onChange }: SelectionColorActionProps) {
  const [open, setOpen] = useState(false)
  const color = (fill ? shapes[0]?.backgroundColor : shapes[0]?.borderColor)
    ?.match(/^#[0-9a-f]{6}$/i)?.[0] || '#000000'
  return <ColorPicker open={open} onOpenChange={setOpen} value={color}
    onChange={value => onChange(shapes.map(shape => fill
      ? { ...shape, backgroundColor: value.toHexString(), backgroundBrush: undefined }
      : { ...shape, borderColor: value.toHexString(), borderWidth: Math.max(1, shape.borderWidth || 1) }))}>
    <SelectionActionButton icon={fill ? 'Fill' : 'Stroke'} label={fill ? '填充' : '描边'} checked={open} />
  </ColorPicker>
}
