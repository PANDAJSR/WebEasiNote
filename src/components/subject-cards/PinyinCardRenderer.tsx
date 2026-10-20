import { useState } from 'react'
import type { PinyinCardElement, PinyinInfo } from '../../types'
import { PronounceButton } from './PronounceButton'
import { SubjectCardFrame } from './SubjectCardFrame'
import { findPronounceSource } from './chinese-pronunciation'
import { pinyinTones } from './pinyin-tones'
import { brand, chineseFont, subjectStyles as styles } from './styles'

function PinyinSyllable({ info, active, resourceMap, sentence, initiallyExpanded }: {
  info: PinyinInfo; active: boolean; resourceMap: Record<string, string>; sentence: boolean; initiallyExpanded: boolean
}) {
  const [selected, setSelected] = useState(info.tonePinyin || info.pinyin)
  const [expanded, setExpanded] = useState(initiallyExpanded)
  const [popup, setPopup] = useState(false)
  const tones = pinyinTones(info.pinyin)
  const handleSelect = (tone: string) => {
    setSelected(tone === selected ? info.pinyin : tone)
    setExpanded(false)
    setPopup(false)
  }
  return <div style={{ display: 'flex', position: 'relative', height: 170 }}>
    <div style={{ minWidth: sentence ? 120 : 162, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
      <div style={{ height: 134, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: sentence ? '0 8px' : '0 36px' }}>
        <span style={{ fontFamily: chineseFont, fontSize: 72, lineHeight: '110px', marginTop: -13, whiteSpace: 'nowrap' }}>{selected}</span>
        <span style={{ position: 'absolute', right: 0, opacity: .85 }}>
          <PronounceButton source={findPronounceSource(info.pronounceList, selected)} resourceMap={resourceMap}
            active={active} label={`播放 ${selected} 发音`} />
        </span>
      </div>
      <div style={{ ...styles.footer, height: 24, position: 'relative' }}>
        {!sentence && <button type="button" disabled style={styles.button} title="课件未包含书写动画数据">书写</button>}
        <button type="button" style={{ ...styles.button, width: sentence ? 64 : 60, color: expanded ? brand : '#626773' }}
          disabled={!active || tones.length === 0} aria-label={`${info.pinyin} 的声调`} aria-expanded={sentence ? popup : expanded}
          onClick={() => sentence ? setPopup(value => !value) : setExpanded(value => !value)}>声调{sentence ? ' ▾' : ''}</button>
        {sentence && popup && <div role="listbox" aria-label={`${info.pinyin} 声调候选`} style={styles.popup}>
          {tones.map(tone => <button key={tone} type="button" role="option" aria-selected={tone === selected}
            style={{ ...styles.flat, display: 'block', width: 90, height: 30, fontSize: 19, fontFamily: chineseFont,
              background: tone === selected ? '#eceef3' : '#ffffff' }} onClick={() => handleSelect(tone)}>{tone}</button>)}
        </div>}
      </div>
    </div>
    {!sentence && expanded && tones.map(tone => <div key={tone} style={{ minWidth: 90, textAlign: 'center' }}>
      <div style={{ height: 134, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: chineseFont, fontSize: 72, marginTop: -14 }}>{tone}</span>
        <PronounceButton source={findPronounceSource(info.pronounceList, tone)} resourceMap={resourceMap} active={active} label={`播放 ${tone} 发音`} />
      </div>
      <button type="button" disabled={!active} style={{ ...styles.button, color: tone === selected ? brand : '#626773' }}
        aria-label={`标调 ${tone}`} aria-pressed={tone === selected} onClick={() => handleSelect(tone)}>标调</button>
    </div>)}
  </div>
}

export function PinyinCardRenderer({ element, scale, resourceMap, active }: {
  element: PinyinCardElement; scale: number; resourceMap: Record<string, string>; active: boolean
}) {
  const sentence = element.pinyins.length > 1
  // 官方整句模式忽略每个 PinyinInfo 的展开状态，使用逐音节下拉菜单。
  const ratio = element.height / 170
  return <SubjectCardFrame element={element} scale={scale} active={active} label="拼音卡片" style={{ opacity: element.opacity }}>
    <div style={{ width: 'max-content', minWidth: element.width / ratio, height: 170, position: 'relative',
      background: '#ffffff', transform: `scale(${ratio})`, transformOrigin: 'top left', borderRadius: 2, boxShadow: '0 0 17px #00000012' }}>
      <div style={{ position: 'absolute', top: 12, left: 12, right: 12, height: 110, borderTop: `2px solid ${element.lineColor}`,
        borderBottom: `2px solid ${element.lineColor}`, boxSizing: 'border-box', pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', inset: '34px 0', borderTop: `2px solid ${element.lineColor}`,
          borderBottom: `2px solid ${element.lineColor}`, opacity: .5 }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-around' }}>
        {element.pinyins.map((info, index) => <PinyinSyllable key={`${index}-${info.pinyin}`} info={info} sentence={sentence}
          initiallyExpanded={!sentence && element.isTonePinyinsVisible} active={active} resourceMap={resourceMap} />)}
      </div>
    </div>
  </SubjectCardFrame>
}
