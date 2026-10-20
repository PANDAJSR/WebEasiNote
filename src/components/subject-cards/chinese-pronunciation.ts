import type { PronounceResource } from '../../types'

const vowels = ['aāáǎà', 'oōóǒò', 'eēéěè', 'iīíǐì', 'uūúǔù', 'üǖǘǚǜ']

/** 与数字声调资源名对应；ü 保持独立，避免与 u 的读音混淆。 */
export function pronunciationKey(value: string) {
  let tone = ''
  const normalized = value.normalize('NFC').toLowerCase().replace(/\.mp3$/i, '').replace(/u:|v/g, 'ü')
  const base = Array.from(normalized).map(char => {
    for (const group of vowels) {
      const index = group.indexOf(char)
      if (index > 0) { tone = String(index); return group[0] }
    }
    return char
  }).join('')
  return tone ? base.replace(/[1-5]$/, '') + tone : base
}

export function findPronounceSource(resources: PronounceResource[], pinyin: string) {
  const key = pronunciationKey(pinyin)
  if (!key) return ''
  return resources.find(resource => pronunciationKey(resource.name.trim()) === key)?.source || ''
}
