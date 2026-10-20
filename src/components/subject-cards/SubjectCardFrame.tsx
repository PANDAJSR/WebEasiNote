import type { CSSProperties, ReactNode } from 'react'
import { subjectStyles } from './styles'

interface Props {
  element: { x: number; y: number; width: number; height: number; rotation: number }
  scale: number
  active: boolean
  label: string
  children: ReactNode
  style?: CSSProperties
  designWidth?: number
  designHeight?: number
}

/** 授课时控件消费自身操作；编辑时仍允许父层选择和拖动。 */
export function SubjectCardFrame({ element, scale, active, label, children, style, designWidth, designHeight }: Props) {
  const ratio = designWidth && designHeight ? Math.min(element.width / designWidth, element.height / designHeight) : 1
  return <div style={{ position: 'absolute', left: element.x * scale, top: element.y * scale,
    transform: `scale(${scale})`, transformOrigin: 'top left' }}>
    <section data-subject-control={active ? 'true' : undefined} data-prevent-swipe="true"
    aria-label={label}
    onClick={event => { if (active) event.stopPropagation() }}
    onMouseDown={event => { if (active) event.stopPropagation() }}
    onPointerDown={event => { if (active) event.stopPropagation() }}
    onTouchStart={event => { if (active) event.stopPropagation() }}
    onPlayCapture={event => {
      const audio = event.target
      event.currentTarget.querySelectorAll('audio').forEach(other => { if (other !== audio) other.pause() })
    }}
    style={{ ...subjectStyles.card, width: element.width, height: element.height,
      transform: `rotate(${element.rotation}deg)`, transformOrigin: 'center center',
      fontSize: 18, ...style }}>
    {designWidth && designHeight ? <div style={{ width: designWidth, height: designHeight, flexShrink: 0,
      transform: `scale(${ratio})`, transformOrigin: 'top left', position: 'absolute',
      left: (element.width - designWidth * ratio) / 2, top: (element.height - designHeight * ratio) / 2 }}>{children}</div> : children}
    </section>
  </div>
}
