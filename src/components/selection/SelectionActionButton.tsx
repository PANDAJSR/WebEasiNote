import { forwardRef, useState } from 'react'
import type { ButtonHTMLAttributes } from 'react'
import icons from './assets/icon-geometries.json'
import { selectionStyles as styles } from './styles'

export type SelectionIcon = keyof typeof icons
interface SelectionActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: SelectionIcon
  label: string
  checked?: boolean
}

/** 原放映菜单的图标、两行布局和状态色；笔悬停不显示鼠标 hover。 */
export const SelectionActionButton = forwardRef<HTMLButtonElement, SelectionActionButtonProps>(
  function SelectionActionButton({ icon, label, checked, disabled, onPointerEnter, onPointerLeave,
    onPointerDown, onPointerUp, onPointerCancel, onBlur, style, ...props }, ref) {
    const [hover, setHover] = useState(false)
    const [pressed, setPressed] = useState(false)
    const geometry = icons[icon]
    return <button {...props} ref={ref} type='button' disabled={disabled} title={label}
      data-selection-action={icon.toLowerCase()} aria-pressed={checked}
      style={{ ...styles.button, ...style, opacity: disabled ? 0.4 : 1,
        background: checked ? '#00c881' : !disabled && pressed ? 'rgba(25, 29, 38, 0.08)'
          : !disabled && hover ? 'rgba(25, 29, 38, 0.04)' : 'transparent', color: checked ? '#ffffff' : '#626773' }}
      onPointerEnter={event => { setHover(event.pointerType === 'mouse'); onPointerEnter?.(event) }}
      onPointerLeave={event => { setHover(false); setPressed(false); onPointerLeave?.(event) }}
      onPointerDown={event => { if (event.button === 0) setPressed(true); onPointerDown?.(event) }}
      onPointerUp={event => { setPressed(false); onPointerUp?.(event) }}
      onPointerCancel={event => { setPressed(false); onPointerCancel?.(event) }}
      onBlur={event => { setPressed(false); onBlur?.(event) }}>
      <span style={styles.buttonLayout}>
        <svg aria-hidden='true' viewBox={geometry.viewBox.join(' ')}
          style={{ ...styles.buttonIcon, marginBottom: icon === 'Front' || icon === 'Delete' ? 4 : 3 }}>
          <path d={geometry.d} fillRule='evenodd' />
        </svg>
        <span style={styles.buttonLabel}>{label}</span>
      </span>
    </button>
  }
)
