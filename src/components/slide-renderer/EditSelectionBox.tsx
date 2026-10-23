import type { CSSProperties, MouseEvent } from 'react'
import type { SlideElement } from '../../types'
import type { ResizeHandleDirection } from './useElementEditInteractions'

interface EditSelectionBoxProps {
  element: SlideElement
  handles: { key: ResizeHandleDirection; left: number; top: number; cursor: CSSProperties['cursor'] }[]
  onResize: (element: SlideElement, direction: ResizeHandleDirection, event: MouseEvent<HTMLDivElement>) => void
}

export function EditSelectionBox({ element, handles, onResize }: EditSelectionBoxProps) {
  return <div style={{ position: 'absolute', left: element.x, top: element.y, width: element.width,
    height: element.height, boxSizing: 'border-box', outline: '2px solid #4a90e2',
    outlineOffset: '2px', borderRadius: '2px', pointerEvents: 'none', zIndex: 2147483647 }}>
    {handles.map(handle => <div key={handle.key} style={{ position: 'absolute',
      left: element.width * handle.left, top: element.height * handle.top, width: 12, height: 12,
      borderRadius: '50%', border: '2px solid #1890ff', backgroundColor: '#ffffff',
      transform: 'translate(-50%, -50%)', boxSizing: 'border-box', pointerEvents: 'auto', cursor: handle.cursor }}
      onMouseDown={event => onResize(element, handle.key, event)} />)}
  </div>
}
