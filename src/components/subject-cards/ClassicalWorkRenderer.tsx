import { useState } from 'react'
import type { ClassicalWorkElement } from '../../types'
import { SubjectCardFrame } from './SubjectCardFrame'
import { SavedSubjectText } from './SavedSubjectText'
import { brand, subjectStyles as styles } from './styles'

export function ClassicalWorkRenderer({ element, scale, active }: {
  element: ClassicalWorkElement; scale: number; active: boolean
}) {
  const [translation, setTranslation] = useState(element.state === 'Translation')
  const [titleOpen, setTitleOpen] = useState(element.showTitleIntroduction)
  const [authorOpen, setAuthorOpen] = useState(element.showAuthorIntroduction)
  return <SubjectCardFrame element={element} scale={scale} active={active} label={`古诗词 ${element.title}`}
    style={{ background: 'transparent', boxShadow: 'none', fontFamily: 'KaiTi, "楷体", serif' }}>
    <div style={{ position: 'absolute', inset: '50px 70px 0 50px', overflow: 'auto', textAlign: 'center' }}>
      <button type="button" disabled={!active} style={{ ...styles.flat, fontSize: 60, color: element.themeColor, maxWidth: 1080 }}
        aria-expanded={titleOpen} onClick={() => setTitleOpen(value => !value)}>{element.title}<span style={{ fontSize: 18, color: '#969ca3' }}> ▾</span></button>
      {titleOpen && <div style={{ background: '#0000000f', textAlign: 'left', fontSize: 24, padding: '5px 12px' }}>{element.introduction}</div>}
      <div style={{ margin: '15px 0 20px' }}>
        <button type="button" disabled={!active} style={{ ...styles.flat, fontSize: 28, color: element.themeColor }}
          aria-expanded={authorOpen} onClick={() => setAuthorOpen(value => !value)}>{element.author}<span style={{ fontSize: 14, color: '#969ca3' }}> ▾</span></button>
      </div>
      {authorOpen && <div style={{ background: '#0000000f', textAlign: 'left', fontSize: 24, padding: '5px 12px' }}>{element.authorIntroduction}</div>}
      <div style={{ width: 'max-content', maxWidth: '100%', margin: '0 auto', textAlign: 'left' }}>
        {!translation && element.content.map((text, index) => <SavedSubjectText key={index} text={text} />)}
        {translation && element.translations.map((text, index) => <div key={index} style={{ display: 'flex', gap: 48, marginBottom: 16 }}>
          <div style={{ width: element.originals[index]?.width || 341 }}>{element.originals[index]
            ? <SavedSubjectText text={element.originals[index]} /> : element.content[index] && <SavedSubjectText text={element.content[index]} />}</div>
          <div style={{ width: text.width || 500, borderLeft: '1px solid #dbdee4', paddingLeft: 24 }}><SavedSubjectText text={text} /></div>
        </div>)}
      </div>
    </div>
    <div role="tablist" aria-label="诗词内容" style={{ position: 'absolute', left: 8, top: element.height / 2 + 155, width: 32 }}>
      {['原文', '翻译'].map((label, index) => <button type="button" key={label} role="tab" aria-selected={translation === !!index}
        disabled={!active} onClick={() => setTranslation(!!index)} style={{ ...styles.flat, display: 'block', writingMode: 'vertical-rl',
          width: 32, height: translation === !!index ? 80 : 70, padding: '12px 8px', fontSize: 16,
          background: translation === !!index ? brand : '#ffffffcc', color: translation === !!index ? '#ffffff' : '#626773',
          boxShadow: '0 0 4px #00000022', borderRadius: '5px 0 0 5px' }}>{label}</button>)}
    </div>
  </SubjectCardFrame>
}
