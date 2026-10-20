import type { HanziCardElement, HanziInfo, PinyinCardElement, PinyinInfo, PronounceResource } from '../types'
import { getDirectChildElement, getDirectChildText, parseColor } from './xml-utils'

const text = (node: Element, name: string) => getDirectChildText(node, name) || ''
const number = (node: Element, name: string, fallback: number) => {
  const value = Number.parseFloat(text(node, name))
  return Number.isFinite(value) ? value : fallback
}
const items = (node: Element, name: string) => Array.from(getDirectChildElement(node, name)?.children || [])

function bounds(node: Element) {
  return { id: text(node, 'Id') || 'unknown', x: number(node, 'X', 0), y: number(node, 'Y', 0),
    width: Math.max(1, number(node, 'Width', 300)), height: Math.max(1, number(node, 'Height', 240)),
    rotation: number(node, 'Rotation', 0) }
}

function pronunciations(node: Element): PronounceResource[] {
  return items(node, 'PronounceList').map(item => ({ name: text(item, 'Name'), source: text(item, 'Source') }))
}

function hanziInfo(node: Element): HanziInfo {
  const pinyin = text(node, 'Pinyin')
  const pinyinList = items(node, 'PinyinList').map(item => item.textContent || '').filter(Boolean)
  return { hanzi: text(node, 'Hanzi'), pinyin, pinyinList: [...new Set([pinyin, ...pinyinList].filter(Boolean))],
    radical: text(node, 'Radical'), strokeCount: Math.max(0, number(node, 'StrokeCount', 0)),
    strokeCode: text(node, 'StrokeCode') }
}

export function parseHanziCardElement(node: Element): HanziCardElement {
  let characters = items(node, 'HanziList').map(hanziInfo)
  if (!characters.length) {
    const info = hanziInfo(node)
    characters = [{ ...info, hanzi: text(node, 'Character') }]
  }
  return { ...bounds(node), type: 'hanziCard', characters, pronounceList: pronunciations(node),
    isInHandWriteMode: text(node, 'IsInHandWriteMode').trim().toLowerCase() === 'true' }
}

function pinyinInfo(node: Element): PinyinInfo {
  return { pinyin: text(node, 'Pinyin'), tonePinyin: text(node, 'TonePinyin'),
    isTonePinyinsVisible: text(node, 'IsTonePinyinsVisible').trim().toLowerCase() === 'true',
    pronounceList: pronunciations(node) }
}

function color(node: Element, name: string, fallback: string) {
  const brush = getDirectChildElement(node, name)
  const value = brush && text(brush, 'ColorBrush')
  return value ? parseColor(value, true) : fallback
}

export function parsePinyinCardElement(node: Element): PinyinCardElement {
  const pinyins = items(node, 'PinyinInfoList').map(pinyinInfo)
  const legacyResources = pronunciations(node)
  pinyins.forEach(info => { if (!info.pronounceList.length) info.pronounceList = legacyResources })
  return { ...bounds(node), type: 'pinyinCard', pinyins: pinyins.length ? pinyins : [pinyinInfo(node)],
    isTonePinyinsVisible: text(node, 'IsTonePinyinsVisible').trim().toLowerCase() === 'true',
    lineColor: color(node, 'LineColor', '#00c881'), backgroundColor: '#ffffff',
    opacity: Math.max(0, Math.min(1, number(node, 'Opacity', 1))) }
}
