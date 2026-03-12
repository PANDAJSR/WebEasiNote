const GENERIC_FAMILIES = new Set([
  'serif',
  'sans-serif',
  'monospace',
  'cursive',
  'fantasy',
  'system-ui'
])

const fontAliasMap: Record<string, string[]> = {
  '微软雅黑': ['Microsoft YaHei', 'MSYH'],
  '苹方-简': ['PingFang SC', 'PingFangSC-Regular'],
  '宋体': ['SimSun', 'STSong', 'Songti SC'],
  '冬青黑体简': ['Hiragino Sans GB', 'HiraginoSansGB-W3'],
  '黑体': ['SimHei', 'STHeiti'],
  '楷体': ['KaiTi', 'STKaiti'],
  '华文楷体': ['STKaiti', 'Kaiti SC'],
  '仿宋': ['FangSong', 'STFangsong'],
  '华文仿宋': ['STFangsong', 'FangSong SC'],
  '微软正黑体': ['Microsoft JhengHei', 'MSJH'],
  '报隶-繁': ['报隶', 'Baoli SC', 'STBaoliSC-Regular', 'STBaoliSC'],
  '幼圆': ['YouYuan', 'Yuanti SC'],
  '隶书': ['LiSu', 'Baoli SC'],
  '华文细黑': ['STXihei', 'Heiti SC Light', 'STHeitiLight'],
  '华文宋体': ['STSong', 'Songti SC'],
  'Arial': ['ArialMT', 'Microsoft YaHei', '微软雅黑', 'PingFang SC', 'Hiragino Sans GB', 'Noto Sans CJK SC'],
  'Times New Roman': ['TimesNewRomanPSMT'],
  'Helvetica': ['Helvetica Neue'],
  'Segoe UI': ['SegoeUI'],
  'Courier New': ['CourierNewPSMT'],
  'Tahoma': [],
  '兰亭黑': ['Microsoft YaHei UI', '微软雅黑 UI', 'MSYHUI'],
  '苹方-繁': ['PingFang TC', 'PingFangTC-Regular'],
  '新細明體': ['PMingLiU', 'Apple LiSung Light'],
  '标楷体': ['DFKai-SB', 'BiauKai'],
  '华文黑体': ['STHeiti', 'Heiti SC'],
  '华文琥珀': ['STHupo', 'Huapo'],
  '华文行楷': ['STXingkai', 'Xingkai SC'],
  '华文新魏': ['STXinwei', 'Xinwei SC'],
  '华文中宋': ['STZhongsong'],
  '方正舒体': ['FZShuTi'],
  '方正姚体': ['FZYaoti'],
  'Georgia': ['Georgia-Italic'],
  'Verdana': ['Verdana-Bold'],
  'Trebuchet MS': ['TrebuchetMS'],
  'Impact': ['ImpactMT'],
  'Comic Sans MS': ['ComicSansMS'],
  'Consolas': ['Consolas-Regular'],
  'Monaco': [],
  'Menlo': ['Menlo-Regular'],
  'Palatino': ['Palatino Linotype', 'Book Antiqua'],
  '苹方-港': ['PingFang HK', 'PingFangHK-Regular'],
  '冬青黑体': ['Hiragino Sans', 'HiraginoSans-W3'],
  '雅兰细黑': ['Microsoft YaHei Light', '微软雅黑 Light', 'MSYH Light'],
  '微软正黑体 UI': ['Microsoft JhengHei UI', 'MSJHUI'],
  '中易宋体': ['SimSun', 'NSimSun', '新宋体'],
  '华文隶书': ['STLiti', 'LiSu SC'],
  '手札体-简': ['Hannotate SC', 'HannotateSC-W5'],
  '魏碑': ['STWeiBei', 'WeiBei SC'],
  '行楷': ['Xingkai SC', '行楷-简', 'STXingkai'],
  '娃娃体-简': ['Wawati SC', 'WawatiSC-Regular'],
  '宋体-繁': ['Songti TC', 'STSongti-TC'],
  '楷体-繁': ['Kaiti TC', 'STKaiti-TC'],
  '雅宋': ['STZhongsong', '华文中宋', 'Zhongsong SC'],
  '细明体': ['MingLiU', 'Apple LiSung Light'],
  '俪宋 Pro': ['LiSong Pro'],
  '俪黑 Pro': ['LiHei Pro'],
  '翩翩体-简': ['HanziPen SC', 'HanziPenSC-W3'],
  '圆体-简': ['Yuanti SC', 'STYuanti-SC'],
  '仿宋_GB2312': ['FangSong_GB2312'],
  'SeewoEnglishHandwriting': [
    'Segoe Script',
    'Bradley Hand',
    'Lucida Handwriting',
    'Comic Sans MS',
    'Snell Roundhand',
    'Apple Chancery',
    'cursive'
  ]
}

function quoteFontFamily(name: string): string {
  const escaped = name.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  return `"${escaped}"`
}

function normalizeFontName(name: string): string {
  return name.trim().toLowerCase()
}

export function resolveFontCandidates(fontFamily?: string): string[] {
  if (!fontFamily) return []

  const primary = fontFamily.trim()
  if (!primary) return []

  const packName = (() => {
    const hashIndex = primary.lastIndexOf('#')
    if (hashIndex === -1 || hashIndex === primary.length - 1) return null
    return primary.slice(hashIndex + 1).trim()
  })()

  const aliasList = [
    ...(fontAliasMap[primary] || []),
    ...(packName ? [packName, ...(fontAliasMap[packName] || [])] : [])
  ]
  return Array.from(new Set([primary, ...aliasList]))
}

export function isGenericFont(name: string): boolean {
  return GENERIC_FAMILIES.has(normalizeFontName(name))
}

export function isFontAvailable(name: string): boolean {
  const fontName = name.trim()
  if (!fontName || isGenericFont(fontName)) return true
  if (typeof document === 'undefined' || !document.fonts?.check) return true

  try {
    return document.fonts.check(`12px ${quoteFontFamily(fontName)}`)
  } catch {
    return true
  }
}

export function isFontFamilyMissing(fontFamily?: string): boolean {
  const candidates = resolveFontCandidates(fontFamily)
  if (candidates.length === 0) return false
  return candidates.every(candidate => !isFontAvailable(candidate))
}

/**
 * 构建字体族字符串，优先使用文件字体，其次尝试常见别名，最后回退到通用 sans-serif
 */
export function buildFontFamily(fontFamily?: string): string | undefined {
  const candidates = resolveFontCandidates(fontFamily)
  if (candidates.length === 0) return undefined
  const families = [...candidates, 'sans-serif']
  const uniqueFamilies = Array.from(new Set(families))

  return uniqueFamilies
    .map(name => (GENERIC_FAMILIES.has(name) ? name : quoteFontFamily(name)))
    .join(', ')
}

/**
 * 希沃导出的 FontSize 在 Web 端并不直接等价于 CSS 像素。
 * 不同平台字体回退链会带来字面尺寸差异，这里使用经验系数做统一校准。
 */
const SEEWO_FONT_SIZE_RATIO = 1

export function convertSeewoFontSizeToCssPx(fontSizePt: number): number {
  return fontSizePt * SEEWO_FONT_SIZE_RATIO
}
