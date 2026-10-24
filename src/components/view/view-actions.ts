import type { ViewElement } from '../../types/view'
import { layoutView, viewDesiredSize } from './view-layout'

export interface ViewPropertySetting { localId: string; property: string; value: string }

/** PropertySettingGroup 按最后一个点分隔 LocalId 和属性，省略 LocalId 表示 self。 */
export function parseViewLink(uri: string): ViewPropertySetting[] | null {
  if (!/^view:\/\/property\?/i.test(uri)) return null
  try {
    return uri.slice(uri.indexOf('?') + 1).split('&').map(part => {
      const equal = part.indexOf('=')
      if (equal < 0) throw new Error('缺少属性值')
      const key = part.slice(0, equal)
      const dot = key.lastIndexOf('.')
      return { localId: dot < 0 ? 'self' : key.slice(0, dot),
        property: (dot < 0 ? key : key.slice(dot + 1)).toLowerCase(),
        value: decodeURIComponent(decodeURIComponent(part.slice(equal + 1)).replace(/\+/g, ' ')) }
    })
  } catch { return null }
}

export function executeViewLink(root: ViewElement, uri: string) {
  const settings = parseViewLink(uri)
  let front = false
  if (!settings) return { root, front }
  for (const { localId, property, value } of settings) {
    if (!['ishidden', 'width', 'height', 'front'].includes(property)) continue
    let found = false
    const visit = (view: ViewElement, isRoot: boolean): ViewElement => {
      const matches = !found && (['this', 'self'].includes(localId.toLowerCase()) ? isRoot : view.localId === localId)
      if (matches) {
        found = true
        if (property === 'front') { front ||= value.trim().toLowerCase() === 'true'; return view }
        if (property === 'ishidden') return { ...view, isHidden: value.trim().toLowerCase() === 'true' }
        const number = Number(value)
        const size = viewDesiredSize(view.elements)
        const dimension = property === 'width' ? 'width' : 'height'
        return { ...view, [dimension]: value.trim() && Number.isFinite(number) && number >= 0 ? number : size[dimension] }
      }
      const elements = view.elements.map(child => child.type === 'view' ? visit(child, false) : child)
      if (elements.every((child, index) => child === view.elements[index])) return view
      const size = viewDesiredSize(elements)
      const zoom = ['Default', 'Zoom', '0'].includes(view.layoutType)
      // ResizeToFitChildrenBounds 清除祖先显式尺寸，并保留原 ElementViewbox.Scale。
      const scale = zoom ? layoutView(view).scale : 1
      return { ...view, elements, width: size.width * scale, height: size.height * scale }
    }
    root = visit(root, true)
  }
  return { root, front }
}

export function viewLinkLabel(uri: string) {
  const setting = parseViewLink(uri)?.find(item => item.property === 'ishidden')
  if (!setting) return '切换卡片视图'
  // 周期表链接的第一个属性控制当前面板，展开和收起均切换为隐藏。
  return /_UnFold_Element_Card/i.test(uri) ? '收起元素卡片'
    : /_Fold_Element_Card/i.test(uri) ? '展开元素卡片' : '切换卡片视图'
}
