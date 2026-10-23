import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { Button } from 'antd'
import type { ActivityDefinition, ActivityElement, SlideElement } from '../../types'
import { checkMatchingAnswers, clearWrongMatchingPlacements, placeMatchingMaterial } from '../../viewer/activities/matching'
import { matchingSession } from '../../viewer/activities/matching-session'
import { ActivityElementRenderer } from './ActivityElementRenderer'
import { matchingStyles as styles } from './matching-styles'

/** 基于保存配置的答题面板，避免猜测官方模板与富文本空位热点。 */
export function MatchingActivity({ definition, elements, resourceMap, active }: {
  definition: ActivityDefinition; elements: SlideElement[]; resourceMap: Record<string, string>; active: boolean
}) {
  const [open, setOpen] = useState(false)
  const [, refresh] = useState(0)
  const [dragPoint, setDragPoint] = useState<{ x: number; y: number } | null>(null)
  const drag = useRef<{ id: string; pointer: number; x: number; y: number } | null>(null)
  const suppressClick = useRef(false)
  const panel = useRef<HTMLDivElement>(null)
  const config = definition.matching!
  const session = matchingSession(definition)
  const elementsById = new Map(elements.map(element => [element.id, element]))
  const update = () => refresh(value => value + 1)
  const title = config.kind === 'TextMatch' ? '知识配对' : '选词填空'
  useEffect(() => {
    if (!active) { drag.current = null; setDragPoint(null); session.selectedId = null; update() }
  }, [active, definition])
  useEffect(() => {
    const cancel = () => { drag.current = null; setDragPoint(null) }
    window.addEventListener('blur', cancel)
    document.addEventListener('visibilitychange', cancel)
    return () => { window.removeEventListener('blur', cancel); document.removeEventListener('visibilitychange', cancel) }
  }, [])
  const place = (id: string, target: string | null) => {
    if (!active) return
    session.placements = placeMatchingMaterial(config, session.placements, id, target)
    session.selectedId = null
    session.checked = null
    update()
  }
  const handleEnd = (event: ReactPointerEvent) => {
    const current = drag.current
    drag.current = null
    setDragPoint(null)
    if (!active || !current || current.pointer !== event.pointerId) return
    const moved = Math.hypot(event.clientX - current.x, event.clientY - current.y) > 5
    if (!moved) return
    suppressClick.current = true
    const hit = document.elementFromPoint?.(event.clientX, event.clientY)?.closest<HTMLElement>('[data-matching-target]')
    if (hit && panel.current?.contains(hit)) {
      place(current.id, hit.dataset.matchingTarget!)
      event.preventDefault()
    }
  }
  const plainText: Record<string, string> = {}
  for (const element of elements) {
    // 原始富文本含 ExtChar 时保守按 ID 检查，防止公式/图片占位符混入同文规则。
    if (element.type === 'activity' && !element.contents.length && !/ExtChar|ElementRootChar|Formula/i.test(element.rawXml || '')
      && element.text) plainText[element.id] = element.text.textLines
        .map(line => line.textRuns.map(run => run.text).join('')).join('\n')
  }
  const content = (id: string, fallback: string) => {
    const element = elementsById.get(id)
    if (element?.type !== 'activity' || (!element.contents.length && element.background?.type !== 'image')) {
      return plainText[id] || fallback || '素材'
    }
    const factor = Math.min(1, 220 / element.width, 80 / element.height)
    return <span style={{ ...styles.content, width: element.width * factor, height: element.height * factor }}>
      <ActivityElementRenderer element={{ ...element, x: 0, y: 0 } as ActivityElement} scale={factor}
        resourceMap={resourceMap} slideIndex={0} currentIndex={0} isEditMode={false} />
    </span>
  }
  const target = (id: string, index: number) => {
    const materialId = session.placements[id]
    const material = config.materials.find(item => item.id === materialId)
    const correct = session.checked?.correctTargetIds.includes(id)
    const wrong = session.checked?.wrongTargetIds.includes(id)
    return <button key={id} type='button' data-matching-target={id} aria-label={`空位 ${index + 1}`}
      disabled={!active} style={{ ...styles.target, borderColor: correct ? '#16a34a' : wrong ? '#dc2626' : undefined }}
      onClick={() => {
        if (session.selectedId) place(session.selectedId, id)
        else if (materialId) place(materialId, null)
      }}>
      {material ? content(material.id, material.name) : `空位 ${index + 1}`}{correct ? ' ✓' : wrong ? ' ✗' : ''}
    </button>
  }
  if (!open) return <div style={styles.launcher} data-activity-control='true' data-prevent-swipe='true'>
    <Button disabled={!active} onClick={() => setOpen(true)}>{title} · 开始答题</Button>
  </div>
  return <div ref={panel} style={styles.panel} data-activity-control='true' data-prevent-swipe='true'
    role='region' aria-label={title} onClick={event => event.stopPropagation()}
    onPointerDownCapture={() => { suppressClick.current = false }}
    onClickCapture={event => {
      if (suppressClick.current) { suppressClick.current = false; event.preventDefault(); event.stopPropagation() }
    }} onPointerUp={handleEnd}
    onPointerMove={event => {
      const current = drag.current
      if (current?.pointer === event.pointerId && Math.hypot(event.clientX - current.x, event.clientY - current.y) > 5) {
        setDragPoint({ x: event.clientX, y: event.clientY })
      }
    }} onPointerCancel={() => { drag.current = null; setDragPoint(null) }}>
    <div style={styles.header}><strong>{title}</strong>
      <span role='status'>{!active ? '活动已暂停' : session.checked?.complete ? '活动完成！'
        : session.checked ? `正确 ${session.checked.correctTargetIds.length} / ${config.targets.length}`
          : '拖动素材到空位，或先选择素材再点击空位'}</span>
      <Button onClick={() => { drag.current = null; setDragPoint(null); setOpen(false) }}>返回课件</Button>
    </div>
    <div style={styles.body}>
      {config.kind === 'TextMatch' ? config.targets.map((item, index) => <div key={item.id} style={styles.row}>
        <span style={styles.label}>{content(item.containerId, item.name)}</span>{target(item.id, index)}
      </div>) : config.paragraphs.map((parts, i) => <p key={i} style={styles.row}>
        {parts.map((part, j) => part.kind === 'text' ? <span key={j}>{part.text}</span>
          : target(part.targetId, config.targets.findIndex(item => item.id === part.targetId)))}
      </p>)}
    </div>
    <div style={styles.materials}>
      {config.materials.filter(item => !Object.values(session.placements).includes(item.id)).map(item =>
        <Button key={item.id} disabled={!active} type={session.selectedId === item.id ? 'primary' : 'default'}
          style={{ ...styles.material, height: 'auto', minHeight: 36 }} data-matching-material={item.id}
          onPointerDown={event => {
            if (!active || event.button !== 0) return
            suppressClick.current = false
            session.selectedId = item.id
            drag.current = { id: item.id, pointer: event.pointerId, x: event.clientX, y: event.clientY }
            event.currentTarget.setPointerCapture?.(event.pointerId)
            update()
          }} onClick={() => { if (active) { session.selectedId = item.id; update() } }}>
          {content(item.id, item.name)}
        </Button>)}
    </div>
    <div style={styles.header}>
      <Button type='primary' disabled={!active} onClick={() => {
        session.checked = checkMatchingAnswers(config, session.placements, plainText)
        session.placements = clearWrongMatchingPlacements(config, session.placements, session.checked)
        session.selectedId = null
        update()
      }}>检查答案</Button>
      <Button disabled={!active} onClick={() => {
        session.placements = {}; session.selectedId = null; session.checked = null; update()
      }}>重新开始</Button>
    </div>
    {dragPoint && session.selectedId && <div style={{ ...styles.ghost, left: dragPoint.x + 12, top: dragPoint.y + 12 }}>
      {content(session.selectedId, config.materials.find(item => item.id === session.selectedId)?.name || '')}
    </div>}
  </div>
}
