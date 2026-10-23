import { useState } from 'react'
import type { HanziCardElement, HanziInfo, PronounceResource } from '../../types'
import { PronounceButton } from './PronounceButton'
import { SubjectCardFrame } from './SubjectCardFrame'
import { HanziStrokeDisplay } from './HanziStrokeDisplay'
import { findPronounceSource } from './chinese-pronunciation'
import { chineseFont, subjectStyles as styles } from './styles'
export { PinyinCardRenderer } from './PinyinCardRenderer'

function HanziCharacter({ info, resources, resourceMap, active }: {
  info: HanziInfo; resources: PronounceResource[]; resourceMap: Record<string, string>; active: boolean
}) {
  const [pinyin, setPinyin] = useState(info.pinyin || info.pinyinList[0] || '')
  return <div style={{ width: 180, height: 261, flexShrink: 0 }}>
    <div style={{ ...styles.footer, height: 56, position: 'relative', fontFamily: chineseFont, fontSize: 30 }}>
      {info.pinyinList.length > 1 ? <select aria-label={`${info.hanzi} 的读音`} value={pinyin} disabled={!active}
        style={{ ...styles.flat, fontFamily: chineseFont, fontSize: 30, appearance: 'none', textAlign: 'center' }}
        onChange={event => setPinyin(event.target.value)}>
        {info.pinyinList.map(value => <option key={value} value={value}>{value}</option>)}
      </select> : <span>{pinyin}</span>}
      {info.pinyinList.length > 1 && <span style={{ fontSize: 12, color: '#626773' }}>▾</span>}
      <PronounceButton source={findPronounceSource(resources, pinyin)} resourceMap={resourceMap} active={active}
        label={`播放 ${info.hanzi} 发音`} />
    </div>
    <HanziStrokeDisplay key={info.hanzi} character={info.hanzi} active={active}>
      <div style={{ fontSize: 10, lineHeight: '18px', color: '#626773', minWidth: 58 }}>
        <div>笔画：{info.strokeCount || ''}</div><div>部首：{info.radical}</div>
      </div>
    </HanziStrokeDisplay>
  </div>
}

export function HanziCardRenderer({ element, scale, resourceMap, active }: {
  element: HanziCardElement; scale: number; resourceMap: Record<string, string>; active: boolean
}) {
  return <SubjectCardFrame element={element} scale={scale} active={active} label="汉字卡片"
    designWidth={180 * Math.max(1, element.characters.length)} designHeight={261}>
    <div style={{ display: 'flex' }}>
      {element.characters.map((info, index) => <HanziCharacter key={`${index}-${info.hanzi}`} info={info}
        resources={element.pronounceList} resourceMap={resourceMap} active={active} />)}
    </div>
  </SubjectCardFrame>
}
