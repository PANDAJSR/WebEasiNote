import { getElementText } from './xml-utils'
import type { FlashElement } from '../types/elements'

export type { FlashElement } from '../types/elements'

/** FlashSaveInfo 中 FlashWidth/FlashHeight 的契约默认值 */
const DEFAULT_FLASH_SIZE = 99
/** FlashElementContent 的模板尺寸，缺省时按官方图标的 64×64 处理 */
const DEFAULT_ELEMENT_SIZE = 64

function parseNumber(value: string | null, fallback: number): number {
  const parsed = parseFloat(value || '')
  return Number.isFinite(parsed) ? parsed : fallback
}

/**
 * 解析 Flash 元素
 *
 * 官方 Flash 元素的 Width/Height 是那个 64×64 红色图标按钮的尺寸，
 * FlashWidth/FlashHeight 才是 SWF 舞台原生尺寸（播放时按此比例等比填充）。
 */
export function parseFlashElement(flashNode: Element): FlashElement | null {
  try {
    const sourceText = getElementText(flashNode, 'Source') || ''
    const sourceId = sourceText.replace('id://', '')
    const flashWidth = parseNumber(getElementText(flashNode, 'FlashWidth'), DEFAULT_FLASH_SIZE)
    const flashHeight = parseNumber(getElementText(flashNode, 'FlashHeight'), DEFAULT_FLASH_SIZE)

    return {
      type: 'flash',
      id: getElementText(flashNode, 'Id') || 'unknown',
      x: parseNumber(getElementText(flashNode, 'X'), 0),
      y: parseNumber(getElementText(flashNode, 'Y'), 0),
      width: parseNumber(getElementText(flashNode, 'Width'), DEFAULT_ELEMENT_SIZE),
      height: parseNumber(getElementText(flashNode, 'Height'), DEFAULT_ELEMENT_SIZE),
      rotation: parseNumber(getElementText(flashNode, 'Rotation'), 0),
      sourceId,
      flashName: getElementText(flashNode, 'FlashName') || '',
      // 舞台尺寸为 0 会让播放器无法按比例撑开，回退到默认值
      flashWidth: flashWidth > 0 ? flashWidth : DEFAULT_FLASH_SIZE,
      flashHeight: flashHeight > 0 ? flashHeight : DEFAULT_FLASH_SIZE
    }
  } catch (error) {
    console.error('[Flash] ✗ 解析异常:', error)
    return null
  }
}
