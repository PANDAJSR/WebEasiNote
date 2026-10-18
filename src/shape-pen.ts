import { getDirectChildElement, getDirectChildText } from './xml-utils'
import type { PenSettingInfo } from './shape-stroke'

/** 解析 Shape/PenSetting；显式空 Dashes 代表覆盖为实线。 */
export function parsePenSetting(shapeNode: Element): PenSettingInfo {
  const pen: PenSettingInfo = {}
  const penNode = getDirectChildElement(shapeNode, 'PenSetting')
  if (!penNode) return pen

  const lineCap = getDirectChildText(penNode, 'LineCap')
  if (lineCap) pen.lineCap = lineCap.trim()
  const lineJoin = getDirectChildText(penNode, 'LineJoin')
  if (lineJoin) pen.lineJoin = lineJoin.trim()
  const isArrowDash = getDirectChildText(penNode, 'IsArrowDash')
  if (isArrowDash) pen.isArrowDash = isArrowDash.trim().toLowerCase() === 'true'

  const dashStyleNode = getDirectChildElement(penNode, 'DashStyle')
  if (dashStyleNode) {
    const dashesNode = getDirectChildElement(dashStyleNode, 'Dashes')
    pen.dashes = Array.from(dashesNode?.children || [])
      .map(item => Number(item.textContent?.trim()))
      .filter(Number.isFinite)
  }
  return pen
}
