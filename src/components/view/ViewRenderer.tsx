import type { ComponentProps } from 'react'
import { ElementRenderer } from '../slide-renderer/ElementRenderer'
import type { ViewElement } from '../../types/view'
import { layoutView } from './view-layout'
import { viewStyle } from './styles'

type ViewRendererProps = Omit<ComponentProps<typeof ElementRenderer>, 'element'> & { element: ViewElement }

export function ViewRenderer({ element, scale, ...props }: ViewRendererProps) {
  if (element.isHidden) return null
  const layout = layoutView(element)
  return <div data-view-id={element.id} style={viewStyle(element, scale)}>
    {layout.elements.map(child => <ElementRenderer key={child.id} {...props} element={child} scale={scale * layout.scale} />)}
  </div>
}
