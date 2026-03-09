export const XML_LINE_SPACING_TO_CSS_MULTIPLIER_FACTOR = 1 / 8

/**
 * 将 XML LineSpacing 映射为 CSS line-height 倍数
 */
export function convertSeewoLineSpacingToMultiplier(lineSpacing?: number): number | null {
  if (!lineSpacing || lineSpacing <= 0) return null

  return 1 + lineSpacing * XML_LINE_SPACING_TO_CSS_MULTIPLIER_FACTOR
}
