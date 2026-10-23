import type { TextElement } from '../../types'
import { ruledPaperFontCss, RULED_PAPER_FONT } from '../../text/ruled-paper-font'
import { buildTextGradient } from './text-style-utils'

/** 官方 Viewbox 内使用 96 字号、140 高的重复格线和 24 顶边距。 */
export function getRuledPaperLayout(height: number, rowCount: number) {
  const rows = Math.max(1, rowCount)
  const naturalHeight = 140.3 * rows + 24
  return { rows, naturalHeight, ratio: height / naturalHeight }
}

/** 独立渲染练习纸，避免普通文本的自动换行、字体回退与段落边距改变格线对齐。 */
export function RuledPaperRenderer({ element, scale }: { element: TextElement; scale: number }) {
  const paper = element.ruledPaper!
  const { rows, naturalHeight, ratio } = getRuledPaperLayout(element.height, element.textLines.length)
  const logicalWidth = element.width / ratio
  const color = paper.lineColor
  return (
    <div aria-label="四线三格" style={{
      position: 'absolute', left: element.x * scale, top: element.y * scale,
      width: element.width * scale, height: element.height * scale,
      boxShadow: `0 ${10 * scale}px ${24 * scale}px rgba(0, 0, 0, ${0.18 * paper.opacity})`,
      transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
      transformOrigin: 'center center', pointerEvents: 'none'
    }}>
      <style>{ruledPaperFontCss}</style>
      <svg width="100%" height="100%" viewBox={`0 0 ${logicalWidth} ${naturalHeight}`}
        style={{ overflow: 'visible' }}>
        <rect width={logicalWidth} height={naturalHeight} rx="2"
          fill={paper.backgroundColor} opacity={paper.opacity} />
        <svg x="12" y="24" width={Math.max(0, logicalWidth - 24)} height={naturalHeight - 24}>
          {Array.from({ length: rows }, (_, row) =>
            [20, 52, 83, 116].map((offset, index) => (
              <rect key={`${row}-${index}`} x="0" y={row * 140 + offset}
                width="100%" height={index === 2 ? 3 : 1} fill={color} />
            )))}
        </svg>
        <foreignObject x="36" y="0" width={Math.max(0, logicalWidth - 72)} height={naturalHeight - 12}>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: 'max-content', fontFamily: `"${RULED_PAPER_FONT}"`,
              fontSize: 96, lineHeight: '140.3px', whiteSpace: 'pre', color: '#000000' }}>
              {element.textLines.map((line, index) => (
                <div key={index} style={{ height: 140.3, textAlign: 'left' }}>
                  {line.textRuns.map((run, runIndex) => (
                    <span key={runIndex} style={{ color: buildTextGradient(run) ? 'transparent' : run.color,
                      backgroundImage: buildTextGradient(run), backgroundClip: 'text',
                      fontWeight: run.fontWeight, fontStyle: run.fontStyle,
                      fontSize: run.fontSize,
                      opacity: run.opacity ?? 1,
                      textDecoration: run.decoration === 'Underline' ? 'underline' : undefined }}>
                      {run.text}
                    </span>
                  ))}
                  {!line.textRuns.some(run => run.text) && '\u00a0'}
                </div>
              ))}
            </div>
          </div>
        </foreignObject>
      </svg>
    </div>
  )
}
