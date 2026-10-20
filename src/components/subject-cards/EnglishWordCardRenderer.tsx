import { useState } from 'react'
import type { EnglishWordCardElement, EnglishWordContentType, WordSemantic } from '../../types'
import { PronounceButton } from './PronounceButton'
import { SubjectCardFrame } from './SubjectCardFrame'
import { brand, subjectStyles as styles } from './styles'

const tabs: [EnglishWordContentType, string][] = [
  ['Semantic', '释义'], ['Phrase', '词组'], ['Sentence', '例句'], ['Synonym', '近义词']
]

function Semantics({ items }: { items: WordSemantic[] }) {
  return <>{items.map((item, index) => <div key={index} style={styles.entry}>
    {item.partOfSpeech && <span style={styles.secondary}>{item.partOfSpeech} </span>}{item.semantic}
  </div>)}</>
}

export function EnglishWordCardRenderer({ element, scale, resourceMap, active }: {
  element: EnglishWordCardElement; scale: number; resourceMap: Record<string, string>; active: boolean
}) {
  const [collapsed, setCollapsed] = useState(element.isCollapsed)
  const [tab, setTab] = useState(element.currentContentType)
  const items = tab === 'Phrase' ? element.phrases : element.sentences
  const count = tab === 'Semantic' ? element.semantics.length : tab === 'Synonym' ? element.synonyms.length : items.length
  return <SubjectCardFrame element={element} scale={scale} active={active} label={`英汉词典 ${element.word}`}
    style={{ height: collapsed ? 98 * element.scaleRatio : element.height, overflow: 'hidden' }}>
    <div style={{ width: element.width / element.scaleRatio, height: collapsed ? 98 : element.height / element.scaleRatio,
      transform: `scale(${element.scaleRatio})`, transformOrigin: 'top left', display: 'flex', flexDirection: 'column' }}>
    <header style={styles.header}>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 12, whiteSpace: 'nowrap' }}>
        <strong style={{ fontSize: 48, marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis' }}>{element.word}</strong>
        {element.soundmark && <span style={{ fontSize: 24, marginBottom: 4 }}>{element.soundmark}</span>}
        <PronounceButton source={element.pronounceSource} resourceMap={resourceMap} active={active} />
      </div>
      <button type="button" style={{ ...styles.button, borderRadius: 16, width: 30, height: 30, marginLeft: 12 }} disabled={!active} aria-expanded={!collapsed}
        aria-label={collapsed ? '展开词典' : '收起词典'} onClick={() => setCollapsed(value => !value)}>
        <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
          <path d={collapsed ? 'M2 8V2h6M2 2l6 6M12 18h6v-6m0 6-6-6' : 'M8 2v6H2m6 0L2 2m10 16v-6h6m-6 0 6 6'} />
        </svg>
      </button>
    </header>
    {!collapsed && <>
      <div role="tablist" aria-label="词条内容" style={styles.tabs}>
        {tabs.map(([type, label]) => <button key={type} type="button" role="tab" aria-selected={type === tab}
          disabled={!active} style={{ ...styles.tab, color: type === tab ? brand : '#191d26', borderBottomColor: type === tab ? brand : 'transparent' }}
          onClick={() => setTab(type)}>{label}</button>)}
      </div>
      <div role="tabpanel" aria-label={tabs.find(([type]) => type === tab)?.[1]} style={styles.content}>
        {count === 0 && <span style={styles.secondary}>暂无内容</span>}
        {tab === 'Semantic' && <Semantics items={element.semantics} />}
        {(tab === 'Phrase' || tab === 'Sentence') && items.map((item, index) => <div key={index} style={styles.entry}>
          <div>{tab === 'Sentence' && `${index + 1}. `}{item.text}</div><div>{item.translation}</div>
        </div>)}
        {tab === 'Synonym' && element.synonyms.map((item, index) => <div key={index} style={styles.entry}>
          <strong style={{ fontSize: 30 }}>{item.word}</strong> <span>{item.soundmark}</span>{' '}
          <PronounceButton source={item.pronounceSource} resourceMap={resourceMap} active={active} label={`播放 ${item.word} 发音`} />
          <Semantics items={item.semantics} />
        </div>)}
        {element.remark && <div style={styles.secondary}>{element.remark}</div>}
      </div>
    </>}
    </div>
  </SubjectCardFrame>
}
