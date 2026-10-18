// 仅列入已确认不改变当前绘制语义的字段；新增未知字段默认回退。
const common = ['Id', 'X', 'Y', 'Width', 'Height', 'Rotation', 'IsLocked',
  'CanClone', 'ElementPptxOriginId', 'SaveInfoMetadata', 'RotateOrigin', 'ShowRotateOrigin', 'HasMask', 'Animations']
const shapeFields = new Set([...common, 'Geometry', 'Path', 'ShapePaths', 'Opacity',
  'Background', 'Foreground', 'Thickness', 'LineType', 'Line', 'PenSetting',
  'CustomGeometryInfoExtension', 'IsTextLocationCustomize', 'TextContainerMargin',
  'TextMargin', 'TextWidth', 'FillRule', 'PathFillRule'])
const groupFields = new Set([...common, 'Elements'])

export function isStaticNodeSafe(node: Element): boolean {
  const allowed = node.tagName === 'Shape' ? shapeFields : groupFields
  return Array.from(node.children).every(child => {
    if (!allowed.has(child.tagName)) return false
    if (child.tagName === 'HasMask') return child.textContent?.trim().toLowerCase() === 'false'
    if (child.tagName === 'ShowRotateOrigin') return child.textContent?.trim().toLowerCase() === 'false'
    if (child.tagName === 'Animations') return child.children.length === 0
    return true
  })
}
