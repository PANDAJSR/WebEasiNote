import { useState } from 'react'
import type { QuestionCardElement } from '../../types'
import { SubjectCardFrame } from './SubjectCardFrame'
import { resolvePronounceUrl } from './PronounceButton'
import { subjectStyles as styles } from './styles'

function QuestionImage({ source, label, imageScale }: { source?: string; label: string; imageScale: number }) {
  const [width, setWidth] = useState<number>()
  return <img src={source} alt={label} onLoad={event => setWidth(event.currentTarget.naturalWidth * imageScale)}
    style={{ display: 'block', width, maxWidth: '100%', height: 'auto' }} />
}

export function QuestionCardRenderer({ element, scale, resourceMap, active }: {
  element: QuestionCardElement; scale: number; resourceMap: Record<string, string>; active: boolean
}) {
  const [expanded, setExpanded] = useState(!element.isCollapsed)
  const image = (source: string, label: string) => source && <QuestionImage key={source} source={resolvePronounceUrl(source, resourceMap)} label={label} imageScale={element.imageScale} />
  // ScaleRatio 缩放整个题卡，ImageScale 独立作用于原始题目图片。
  const ratio = element.scaleRatio
  const bounds = { ...element, x: element.x / ratio, y: element.y / ratio,
    width: element.width / ratio, height: element.height / ratio }
  return <SubjectCardFrame element={bounds} scale={scale * ratio} active={active} label={`题卡 ${element.title}`}
    style={{ height: expanded ? 'auto' : bounds.height, minHeight: bounds.height, overflow: 'hidden' }}>
    <div style={{ padding: '0 18px', height: 64, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 16, color: '#626773' }}>
      {element.title}<button type="button" disabled={!active} aria-expanded={expanded} aria-label={expanded ? '收起答案解析' : '展开答案解析'}
        onClick={() => setExpanded(value => !value)} style={{ ...styles.button, width: 40, height: 40, borderRadius: 20 }}>
        <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
          <path d={expanded ? 'M8 2v6H2m6 0L2 2m10 16v-6h6m-6 0 6 6' : 'M2 8V2h6M2 2l6 6M12 18h6v-6m0 6-6-6'} />
        </svg>
      </button>
    </div>
    <div style={{ padding: '0 18px 18px', overflow: expanded ? 'visible' : 'hidden', minHeight: 0 }}>
      {image(element.question, '题干')}
      {element.options && <div style={{ borderLeft: '4px solid #e6e6e6', paddingLeft: 22, marginTop: 12 }}>{image(element.options, '选项')}</div>}
      {expanded && <div style={{ borderTop: '1px solid #eceef3', paddingTop: 16 }}>
        <div style={{ color: '#00c881', fontSize: 16 }}>答案</div>{image(element.answer, '答案')}
        <div style={{ color: '#00c881', fontSize: 16 }}>解析</div>{image(element.analysis, '解析')}
      </div>}
    </div>
  </SubjectCardFrame>
}
