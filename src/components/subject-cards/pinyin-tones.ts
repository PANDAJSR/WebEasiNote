import { pronunciationKey } from './chinese-pronunciation'

const tones: Record<string, string> = { a: 'āáǎà', o: 'ōóǒò', e: 'ēéěè', i: 'īíǐì', u: 'ūúǔù', ü: 'ǖǘǚǜ' }
export function pinyinTones(pinyin: string) {
  const base = pronunciationKey(pinyin).replace(/[0-5]$/, '')
  const index = base.includes('a') ? base.indexOf('a') : base.includes('e') ? base.indexOf('e')
    : base.includes('ou') ? base.indexOf('o') : Math.max(...[...base].map((c, i) => tones[c] ? i : -1))
  if (index < 0 || !tones[base[index]]) return []
  return [...tones[base[index]]].map(c => base.slice(0, index) + c + base.slice(index + 1))
}
