import { useState } from 'react'
import type { VocabularyPageElement } from '../../types'
import { SubjectCardFrame } from './SubjectCardFrame'
import { SavedSubjectText } from './SavedSubjectText'
import { PronounceButton } from './PronounceButton'
import { brand, subjectStyles as styles } from './styles'

const tabs = [['Semantic', '释义'], ['Phrase', '词组'], ['Sentence', '例句'], ['Synonym', '近义词']] as const
export function VocabularyPageRenderer({ element, scale, active, resourceMap }: {
  element: VocabularyPageElement; scale: number; active: boolean; resourceMap: Record<string, string>
}) {
  const [tab, setTab] = useState(element.currentContentType)
  return <SubjectCardFrame element={element} scale={scale} active={active} label={`词汇详解 ${element.word}`}
    style={{ background: 'transparent', boxShadow: 'none' }}>
    <div style={{ position: 'absolute', inset: '96px 91px 64px' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 16, paddingBottom: 16, borderBottom: '1px solid #191d260d' }}>
        <strong style={{ fontSize: 58 }}>{element.word}</strong><strong style={{ fontSize: 36 }}>{element.soundmark}</strong>
        <PronounceButton source={element.pronounceSource} resourceMap={resourceMap} active={active} />
      </header>
      <div role="tabpanel" style={{ overflow: 'auto', height: 'calc(100% - 100px)', padding: '10px 10px 0' }}>
        {(tab === 'Semantic' ? element.semantics : tab === 'Phrase' ? element.phrases : []).map((text, index) =>
          <SavedSubjectText key={index} text={text} lineHeight={2.2} />)}
        {tab === 'Sentence' && element.sentences.map((item, index) => <div key={index} style={{ marginBottom: 20 }}>
          <SavedSubjectText text={item.text} /><SavedSubjectText text={item.translation} />
        </div>)}
        {tab === 'Synonym' && element.synonyms.map((item, index) => <div key={index} style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 30 }}><strong>{item.word}</strong>{item.soundmark}
            <PronounceButton source={item.pronounceSource} resourceMap={resourceMap} active={active} /></div>
          <SavedSubjectText text={item.text} />
        </div>)}
      </div>
    </div>
    <div role="tablist" aria-label="词汇内容" style={{ position: 'absolute', left: 0, bottom: 80, display: 'grid', gap: 8 }}>
      {tabs.map(([type, label]) => <button key={type} type="button" role="tab" aria-selected={type === tab}
        disabled={!active} onClick={() => setTab(type)} style={{ ...styles.pageTab,
          background: type === tab ? brand : '#ffffff', color: type === tab ? '#ffffff' : '#626773' }}>{label}</button>)}
    </div>
  </SubjectCardFrame>
}
