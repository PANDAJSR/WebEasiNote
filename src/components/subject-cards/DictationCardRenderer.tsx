import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { DictationCardElement } from '../../types'
import { SubjectCardFrame } from './SubjectCardFrame'
import { PronounceButton } from './PronounceButton'
import { subjectStyles as styles } from './styles'

export function DictationCardRenderer({ element, scale, active, resourceMap }: {
  element: DictationCardElement; scale: number; active: boolean; resourceMap: Record<string, string>
}) {
  const [open, setOpen] = useState(false)
  useEffect(() => { if (!active) setOpen(false) }, [active])
  return <>
    <SubjectCardFrame element={element} scale={scale} active={active} label={`听写 ${element.title}`} designWidth={442} designHeight={72}>
      <div style={{ display: 'flex', alignItems: 'center', height: 72, padding: '0 12px', gap: 12 }}>
        <svg width="42" height="42" viewBox="0 0 42 42" aria-hidden="true" fill="none" stroke="#797980" strokeWidth="5">
          <path d="M8 25v-6a13 13 0 0 1 26 0v6M7 23v14m28-14v14" /><path stroke="#00c881" strokeWidth="3" d="M16 26v8m5-5v2m5-5v8" />
        </svg>
        <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 16, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{element.title}</div>
          <div style={{ fontSize: 12, color: '#969ca3', marginTop: 6 }}>听写单词：{element.count}个</div></div>
        <button type="button" disabled={!active} style={{ ...styles.accent, width: 80, padding: 0 }} onClick={() => setOpen(true)}>查看单词</button>
      </div>
    </SubjectCardFrame>
    {active && open && createPortal(<section role="dialog" aria-label="听写单词" data-subject-control="true" data-prevent-swipe="true"
      onClick={event => event.stopPropagation()} onKeyDown={event => { event.stopPropagation(); if (event.key === 'Escape') setOpen(false) }} style={styles.dialog}>
      <header style={{ display: 'flex', padding: 20, justifyContent: 'space-between' }}><strong>{element.title}</strong>
        <button type="button" style={styles.button} onClick={() => setOpen(false)}>关闭</button></header>
      <div style={{ overflow: 'auto', padding: '0 24px 24px' }}>{element.words.map((word, index) => <div key={index}
        style={{ display: 'flex', alignItems: 'center', gap: 20, padding: 12, borderBottom: '1px solid #eceef3' }}>
        <span>{index + 1}.</span><strong>{word.word}</strong><span>{word.soundmark}</span><span style={{ flex: 1 }}>{word.interpretation}</span>
        <PronounceButton source={word.femaleAudio || word.maleAudio} resourceMap={resourceMap} active={active} label={`播放 ${word.word} 发音`} />
      </div>)}</div>
    </section>, document.body)}
  </>
}
