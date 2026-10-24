import type { ComponentProps } from 'react'
import { ElementRenderer } from '../slide-renderer/ElementRenderer'
import type { ViewElement } from '../../types/view'
import { layoutView } from './view-layout'
import { viewStyle, viewButtonStyle } from './styles'
import { ViewInteractionRoot, useViewInteraction } from './ViewInteraction'
import { parseViewLink, viewLinkLabel } from './view-actions'

type ViewRendererProps = Omit<ComponentProps<typeof ElementRenderer>, 'element'> & { element: ViewElement }

export function ViewRenderer({ element, scale, ...props }: ViewRendererProps) {
  const interaction = useViewInteraction()
  if (!interaction) return <ViewInteractionRoot element={element} onFront={props.onViewFront}>
    {view => <ViewContent element={view} scale={scale} {...props} />}
  </ViewInteractionRoot>
  return <ViewContent element={element} scale={scale} {...props} />
}

function ViewContent({ element, scale, ...props }: ViewRendererProps) {
  const interaction = useViewInteraction()
  if (element.isHidden) return null
  const layout = layoutView(element)
  const childScale = scale * layout.scale
  const active = props.viewControlsEnabled !== false && props.isVisible !== false && props.slideIndex === props.currentIndex
  return <div data-view-id={element.id} style={viewStyle(element, scale)}>
    {layout.elements.map(child => <div key={child.id}>
      <ElementRenderer {...props} element={child} scale={childScale} />
      {active && !(child.type === 'view' && child.isHidden) && child.hyperlink && parseViewLink(child.hyperlink) && <button type='button'
        data-subject-control='true' aria-label={viewLinkLabel(child.hyperlink)}
        style={{ ...viewButtonStyle, left: child.x * childScale, top: child.y * childScale,
          width: child.width * childScale, height: child.height * childScale,
          transform: `rotate(${('rotation' in child && child.rotation) || 0}deg)` }}
        onPointerDown={event => event.stopPropagation()} onMouseDown={event => event.stopPropagation()}
        onClick={event => { event.stopPropagation(); interaction?.(child.hyperlink!) }} />}
    </div>)}
  </div>
}
