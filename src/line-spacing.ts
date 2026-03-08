/**
 * 希沃行距编码转换为 CSS line-height 倍数
 * 常见样本：
 * - 1 -> 单倍（约 1.0）
 * - 4 -> 1.5 倍
 * - 8 -> 2.0 倍
 */
export function convertSeewoLineSpacingToMultiplier(lineSpacing?: number): number | null {
  if (!lineSpacing || lineSpacing <= 0) return null

  if (lineSpacing <= 1) {
    return 1
  }

  return 1 + lineSpacing / 8
}
