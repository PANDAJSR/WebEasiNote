import type { ViewElement } from '../../types/view'
import type { SlideElement } from '../../types'

/** CoreCanvas 以可见子元素的旋转外接框尺寸测量，坐标原点不随外接框平移。 */
function desiredSize(elements: SlideElement[]) {
  const bounds = elements.filter(e => e.type !== 'view' || !e.isHidden).map(e => {
    const angle = ('rotation' in e ? e.rotation || 0 : 0) * Math.PI / 180
    const width = Math.abs(e.width * Math.cos(angle)) + Math.abs(e.height * Math.sin(angle))
    const height = Math.abs(e.width * Math.sin(angle)) + Math.abs(e.height * Math.cos(angle))
    return { left: e.x + (e.width - width) / 2, top: e.y + (e.height - height) / 2, width, height }
  })
  if (!bounds.length) return { width: .0625, height: .0625 }
  return {
    width: Math.max(.0625, Math.max(...bounds.map(b => b.left + b.width)) - Math.min(...bounds.map(b => b.left))),
    height: Math.max(.0625, Math.max(...bounds.map(b => b.top + b.height)) - Math.min(...bounds.map(b => b.top)))
  }
}

export function layoutView(view: ViewElement) {
  const layout = { '0': 'Default', '1': 'Grid', '2': 'StackPanel' }[view.layoutType] || view.layoutType
  if (layout === 'Default' || layout === 'Zoom') {
    const size = desiredSize(view.elements)
    return { scale: Math.min(view.width / size.width, view.height / size.height), elements: view.elements }
  }
  let y = 0
  const elements = view.elements.map(element => {
    // WPF Grid / StackPanel 不使用 Canvas.Left / Top，显式尺寸的元素居中排布。
    const hidden = element.type === 'view' && element.isHidden
    const next = { ...element, x: (view.width - element.width) / 2,
      y: layout === 'StackPanel' ? y : (view.height - element.height) / 2 }
    if (!hidden && layout === 'StackPanel') y += element.height
    return next
  })
  return { scale: 1, elements }
}
