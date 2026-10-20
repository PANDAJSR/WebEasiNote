import { useState } from 'react'
import type { HanziCardElement, HanziInfo, PronounceResource } from '../../types'
import { PronounceButton } from './PronounceButton'
import { SubjectCardFrame } from './SubjectCardFrame'
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
    <div style={{ ...styles.grid, width: 156, height: 156, margin: '0 12px 3px' }}>
      <svg aria-hidden="true" viewBox="0 0 156 156" width="156" height="156" style={{ position: 'absolute', inset: 0 }}>
        <rect x="1" y="1" width="154" height="154" fill="none" stroke="#00c881" strokeWidth="2" />
        <path d="M78 1V155M1 78H155" fill="none" stroke="#00c881" strokeWidth="2" strokeDasharray="3 3" />
      </svg>
      <span style={styles.hanzi}>{info.hanzi}</span>
    </div>
    <div style={{ height: 46, display: 'flex', alignItems: 'center', padding: '0 12px', gap: 10 }}>
      <div style={{ fontSize: 10, lineHeight: '18px', color: '#626773', minWidth: 58 }}>
        <div>笔画：{info.strokeCount || ''}</div><div>部首：{info.radical}</div>
      </div>
      <button type="button" disabled title="课件未包含笔顺数据" style={{ ...styles.button, width: 40, height: 26 }}>连写</button>
      <button type="button" disabled title="课件未包含笔顺数据" style={{ ...styles.button, width: 40, height: 26 }}>单步</button>
    </div>
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
