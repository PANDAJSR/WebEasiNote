import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { Button } from 'antd'
import type { ActivityDefinition, ActivityElement, SlideElement } from '../../types'
import { checkMatchingAnswers, clearWrongMatchingPlacements, placeMatchingMaterial } from '../../viewer/activities/matching'
import { matchingSession } from '../../viewer/activities/matching-session'
import { matchingDropTarget } from '../../viewer/activities/matching-drop'
import { ActivityElementRenderer } from './ActivityElementRenderer'
import { matchingStyles as styles } from './matching-styles'

interface Point { x: number; y: number }
interface Gesture { id: string; pointer: number; start: Point; origin: Point; node: HTMLElement }

/** 在画布原坐标中操作保存素材；只有摆放和判题结果属于放映会话。 */
export function MatchingActivity({ definition, elements, resourceMap, active, width, height, scale }: {
  definition: ActivityDefinition; elements: SlideElement[]; resourceMap: Record<string, string>; active: boolean
  width: number; height: number; scale: number
}) {
  const [, refresh] = useState(0)
  const [preview, setPreview] = useState<{ id: string; point: Point } | null>(null)
  const [targets, setTargets] = useState<Record<string, Point>>({})
  const root = useRef<HTMLDivElement>(null)
  const slots = useRef(new Map<string, HTMLButtonElement>())
  const gesture = useRef<Gesture | null>(null)
  const suppressClick = useRef(false)
  const config = definition.matching!
  const session = matchingSession(definition)
  const update = () => refresh(value => value + 1)
  const members = elements.filter((element): element is ActivityElement => element.type === 'activity'
    && element.activityId === definition.id)
  const byId = new Map(members.map(element => [element.id, element]))
  const plainText: Record<string, string> = {}
  for (const element of members) {
    if (!element.contents.length && !/ExtChar|ElementRootChar|Formula/i.test(element.rawXml || '') && element.text) {
      plainText[element.id] = element.text.textLines.map(line => line.textRuns.map(run => run.text).join('')).join('\n')
    }
  }
  const cancel = () => {
    const current = gesture.current
    gesture.current = null
    if (current?.node.hasPointerCapture?.(current.pointer)) current.node.releasePointerCapture(current.pointer)
    setPreview(null)
  }
  useEffect(() => {
    cancel()
    const blur = () => { cancel(); session.selectedId = null; update() }
    window.addEventListener('blur', blur)
    document.addEventListener('visibilitychange', blur)
    return () => { cancel(); window.removeEventListener('blur', blur); document.removeEventListener('visibilitychange', blur) }
  }, [active, definition, scale])
  // 空位来自画布中的实际排版，缩放后仍按幻灯片坐标吸附。
  useLayoutEffect(() => {
    const measure = () => {
      const bounds = root.current?.getBoundingClientRect()
      if (!bounds || !(scale > 0)) return
      const next: Record<string, Point> = {}
      slots.current.forEach((node, id) => {
        const rect = node.getBoundingClientRect()
        const material = byId.get(session.placements[id])
        next[id] = { x: (rect.left - bounds.left) / scale + (rect.width / scale - (material?.width || rect.width / scale)) / 2,
          y: (rect.top - bounds.top) / scale + (rect.height / scale - (material?.height || rect.height / scale)) / 2 }
      })
      setTargets(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next)
    }
    measure()
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    if (root.current) observer?.observe(root.current)
    slots.current.forEach(node => observer?.observe(node))
    let disposed = false
    void document.fonts?.ready.then(() => { if (!disposed) measure() })
    return () => { disposed = true; observer?.disconnect() }
  })
  const place = (id: string, targetId: string | null) => {
    if (!active) return
    session.placements = placeMatchingMaterial(config, session.placements, id, targetId)
    session.checked = null
    session.selectedId = null
    update()
  }
  const materialPoint = (element: ActivityElement) => {
    const target = Object.keys(session.placements).find(id => session.placements[id] === element.id)
    return target && targets[target] ? targets[target] : { x: element.x, y: element.y }
  }
  const handleEnd = (event: ReactPointerEvent) => {
    const current = gesture.current
    if (!current || current.pointer !== event.pointerId) return
    const moved = Math.hypot(event.clientX - current.start.x, event.clientY - current.start.y) > 5
    cancel()
    if (!active || !moved) return
    suppressClick.current = true
    const bounds = root.current!.getBoundingClientRect()
    const element = byId.get(current.id)!
    const left = bounds.left + current.origin.x * scale + event.clientX - current.start.x
    const top = bounds.top + current.origin.y * scale + event.clientY - current.start.y
    const material = { left, top, width: element.width * scale, height: element.height * scale,
      right: left + element.width * scale, bottom: top + element.height * scale }
    const targetId = matchingDropTarget([...slots.current].map(([id, node]) => ({ id, rect: node.getBoundingClientRect() })),
      material, { x: event.clientX, y: event.clientY })
    place(current.id, targetId)
    event.preventDefault()
    event.stopPropagation()
  }
  const slot = (id: string, index: number) => {
    const material = byId.get(session.placements[id])
    const answers = config.targets.find(target => target.id === id)!.answerIds.map(answer => byId.get(answer))
    const slotWidth = Math.max(80, ...answers.map(answer => answer?.width || 0))
    const slotHeight = Math.max(40, ...answers.map(answer => answer?.height || 0))
    const correct = session.checked?.correctTargetIds.includes(id)
    const wrong = session.checked?.wrongTargetIds.includes(id) || session.checked?.emptyTargetIds.includes(id)
    return <button key={id} ref={node => { if (node) slots.current.set(id, node); else slots.current.delete(id) }}
      type='button' data-matching-target={id} aria-label={`空位 ${index + 1}`} disabled={!active}
      style={{ ...styles.target, width: Math.max(slotWidth, material?.width || 0), height: Math.max(slotHeight, material?.height || 0),
        borderColor: correct ? '#16a34a' : wrong ? '#dc2626' : undefined }}
      onClick={() => {
        if (session.selectedId) place(session.selectedId, id)
        else if (material) place(material.id, null)
       }}>{material ? '' : `空位 ${index + 1}`}</button>
  }
  const stem = config.stemId ? byId.get(config.stemId) : undefined
  return <div ref={root} style={{ ...styles.canvas, width, height }} data-activity-canvas={config.kind}
    data-activity-control='true' data-prevent-swipe='true'
    onPointerDownCapture={() => { suppressClick.current = false }}
    onClickCapture={event => {
      if (suppressClick.current) { suppressClick.current = false; event.preventDefault(); event.stopPropagation() }
    }}>
    {config.kind === 'TextMatch' ? config.targets.map((target, index) => {
      const container = byId.get(target.containerId)!
      const answer = byId.get(target.answerIds[0])!
      return <div key={target.id} style={{ position: 'absolute', pointerEvents: 'auto',
        left: Math.max(0, container.x - answer.width - 16), top: container.y + (container.height - answer.height) / 2 }}>
        {slot(target.id, index)}
      </div>
    }) : stem && <div style={{ position: 'absolute', left: stem.x, top: stem.y, width: stem.width,
      height: stem.height, transform: `rotate(${stem.rotation}deg)`, pointerEvents: 'none' }}>
      <ActivityElementRenderer element={{ ...stem, x: 0, y: 0, text: undefined, contents: [] }} scale={1}
        resourceMap={resourceMap} slideIndex={0} currentIndex={0} isEditMode={false} />
      <div style={{ ...styles.stem, left: stem.text?.x || 0, top: stem.text?.y || 0,
        width: stem.text?.width || stem.width, minHeight: stem.height,
        fontSize: stem.text?.textLines[0]?.textRuns[0]?.fontSize || 24 }}>
        {config.paragraphs.map((parts, i) => <p key={i} style={{ margin: '0 0 8px', whiteSpace: 'pre-wrap' }}>
          {parts.map((part, j) => part.kind === 'text' ? <span key={j}>{part.text}</span>
            : slot(part.targetId, config.targets.findIndex(target => target.id === part.targetId)))}
        </p>)}
      </div>
    </div>}
    {config.materials.map(item => {
      const element = byId.get(item.id)!
      const point = preview?.id === item.id ? preview.point : materialPoint(element)
      const selected = session.selectedId === item.id
      return <div key={item.id} role='button' tabIndex={active ? 0 : -1} aria-label={plainText[item.id] || item.name || '素材'}
        aria-disabled={!active} aria-pressed={selected} data-matching-material={item.id}
        style={{ ...styles.material, left: point.x, top: point.y, width: element.width, height: element.height,
          outline: selected ? '2px solid #1677ff' : undefined, zIndex: preview?.id === item.id ? 6 : 3,
          cursor: active ? preview?.id === item.id ? 'grabbing' : 'grab' : undefined }}
        onPointerDown={event => {
          if (!active || event.button !== 0 || gesture.current || !(scale > 0)) return
          event.preventDefault(); event.stopPropagation()
          session.selectedId = item.id
          gesture.current = { id: item.id, pointer: event.pointerId, start: { x: event.clientX, y: event.clientY },
            origin: materialPoint(element), node: event.currentTarget }
          event.currentTarget.setPointerCapture?.(event.pointerId)
          update()
        }} onPointerMove={event => {
          const current = gesture.current
          if (!current || current.pointer !== event.pointerId) return
          setPreview({ id: current.id, point: { x: current.origin.x + (event.clientX - current.start.x) / scale,
            y: current.origin.y + (event.clientY - current.start.y) / scale } })
        }} onPointerUp={handleEnd} onPointerCancel={cancel}
        onLostPointerCapture={event => { if (gesture.current?.pointer === event.pointerId) cancel() }}
        onClick={() => { if (active) { session.selectedId = item.id; update() } }}
        onKeyDown={event => {
          if (active && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); session.selectedId = item.id; update() }
        }}>
        <ActivityElementRenderer element={{ ...element, x: 0, y: 0 }} scale={1}
          resourceMap={resourceMap} slideIndex={0} currentIndex={0} isEditMode={false} />
      </div>
    })}
    {session.checked && config.targets.map((target, index) => {
      const point = targets[target.id]
      if (!point) return null
      const correct = session.checked!.correctTargetIds.includes(target.id)
      const empty = session.checked!.emptyTargetIds.includes(target.id)
      const material = byId.get(session.placements[target.id])
      return <span key={target.id} role='status' data-matching-result={target.id}
        aria-label={`空位 ${index + 1}：${correct ? '正确' : empty ? '未填' : '错误'}`}
        style={{ position: 'absolute', left: point.x, top: point.y - 22, zIndex: 7,
          pointerEvents: 'none', background: correct ? '#15803d' : '#dc2626', color: '#ffffff',
          borderRadius: 4, padding: '2px 6px', fontSize: 16, lineHeight: '20px',
          boxShadow: material ? `0 0 0 2px ${correct ? '#15803d' : '#dc2626'}` : undefined }}>
        {correct ? '✓ 正确' : empty ? '！未填' : '✗ 错误'}
      </span>
    })}
    <div style={styles.controls} onClick={event => event.stopPropagation()}>
      <span role='status'>{!active ? '活动已暂停' : session.checked?.complete ? '活动完成！'
        : session.checked ? `正确 ${session.checked.correctTargetIds.length} / ${config.targets.length}` : '拖动素材到空位'}</span>
      <Button type='primary' disabled={!active} onClick={() => {
        cancel(); session.checked = checkMatchingAnswers(config, session.placements, plainText)
        session.placements = clearWrongMatchingPlacements(config, session.placements, session.checked)
        session.selectedId = null; update()
      }}>检查答案</Button>
      <Button disabled={!active} onClick={() => {
        cancel(); session.placements = {}; session.selectedId = null; session.checked = null; update()
      }}>重新开始</Button>
    </div>
  </div>
}
