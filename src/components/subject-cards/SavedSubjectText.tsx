import type { SavedSubjectText as SavedText } from '../../types'
import { buildFontFamily } from '../../text/font-utils'

/** 保留课件中分段、文字颜色和字号；不将保存文本作为 HTML 执行。 */
export function SavedSubjectText({ text, lineHeight = 1.85 }: { text: SavedText; lineHeight?: number }) {
  return <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'break-word', lineHeight }}>
    {text.lines.map((line, index) => <div key={index} style={{ textAlign: line.textAlignment.toLowerCase() as 'left' | 'center' | 'right',
      paddingLeft: line.marginLeft || 0, marginTop: line.spaceBefore || 0, marginBottom: line.spaceAfter || 0 }}>
      {line.textRuns.map((run, i) => <span key={i} style={{ fontSize: run.fontSize, color: run.color,
        fontFamily: buildFontFamily(run.fontFamily), fontWeight: run.fontWeight, fontStyle: run.fontStyle,
        textDecoration: run.decoration === 'Underline' ? 'underline' : undefined }}>{run.text.replace(/\r\n|\r/g, '\n')}</span>)}
    </div>)}
  </div>
}
