import { useRef, useState } from 'react'

interface Props {
  label: string
  value: number
  max: number
  onChange: (value: number) => void
  onStart?: () => void
  onFinish?: () => void
}

/** 官方 4px 轨道及 12/10px 双层滑块，拖动期间暂停，结束恢复原播放状态。 */
export function AudioSlider({ label, value, max, onChange, onStart, onFinish }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const [focused, setFocused] = useState(false)
  const progress = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0
  const seek = (clientX: number) => {
    const rect = ref.current!.getBoundingClientRect()
    onChange(Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)) * Math.max(0, max))
  }
  const finish = () => {
    if (!dragging.current) return
    dragging.current = false
    onFinish?.()
  }
  return <div ref={ref} role='slider' tabIndex={max > 0 ? 0 : -1} aria-label={label}
    aria-valuemin={0} aria-valuemax={Math.max(0, max)} aria-valuenow={Math.max(0, value)}
    style={{ flex: 1, minWidth: 24, height: 16, position: 'relative', cursor: 'pointer', touchAction: 'none',
      outline: focused ? '1px solid #ffffff80' : 'none' }}
    onFocus={() => setFocused(true)} onBlur={() => { setFocused(false); finish() }}
    onMouseDown={event => event.stopPropagation()}
    onPointerDown={event => {
      event.stopPropagation()
      if (max <= 0) return
      dragging.current = true
      onStart?.()
      event.currentTarget.setPointerCapture(event.pointerId)
      seek(event.clientX)
    }} onPointerMove={event => { if (dragging.current) seek(event.clientX) }}
    onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish}
    onKeyDown={event => {
      const delta = event.key === 'ArrowRight' || event.key === 'ArrowUp' ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -1 : 0
      if (!delta) return
      event.preventDefault()
      event.stopPropagation()
      onChange(Math.max(0, Math.min(max, value + delta * (max <= 1 ? 0.1 : 1))))
    }}>
    <div style={{ position: 'absolute', top: 6, left: 0, right: 0, height: 4, borderRadius: 2, background: '#ffffff33' }} />
    <div style={{ position: 'absolute', top: 6, left: 0, width: `${progress * 100}%`, height: 4,
      borderRadius: 2, background: '#3f9fff' }} />
    <div style={{ position: 'absolute', left: `calc(${progress * 100}% - 6px)`, top: 2, width: 12, height: 12,
      borderRadius: 6, border: '1px solid #00000019', boxSizing: 'border-box', background: '#ffffff' }} />
  </div>
}
