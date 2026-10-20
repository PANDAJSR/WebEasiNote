import { useId, useMemo, useRef, useState } from 'react'
import type { MathFunctionElement } from '../../types'
import { SubjectCardFrame } from './SubjectCardFrame'
import { compileMathExpression, functionPath } from './math-expression'
import { subjectStyles as styles } from './styles'

function ExpressionLabel({ expression }: { expression: string }) {
  const power = expression.match(/^\(?x\)?\^\(?(-?\d+)\)?$/)
  return <span style={{ fontFamily: '"Cambria Math", math, serif', fontSize: 20, fontStyle: 'italic' }}>
    y={power ? <>x<sup style={{ fontSize: '.7em' }}>{power[1]}</sup></> : expression}
  </span>
}
export function MathFunctionRenderer({ element, scale, active }: {
  element: MathFunctionElement; scale: number; active: boolean
}) {
  const clip = useId().replace(/:/g, '')
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState([0, 0])
  const [mesh, setMesh] = useState(element.showTypes.includes('Mesh'))
  const drag = useRef<number[] | null>(null)
  const size = Math.max(1, Math.min(element.height - 6, element.width - 184))
  const ratio = size / Math.max(1, element.visualBounds[2])
  const initial = [(1000 - element.visualBounds[0]) * ratio, (1000 - element.visualBounds[1]) * ratio]
  const origin = [initial[0] + offset[0], initial[1] + offset[1]]
  const unit = element.basicSize.map((n, i) => n * element.tagStep[i] / (element.tagValueStep[i] * element.tagScale) * ratio * zoom)
  const grid = element.basicSize.map(n => Math.max(4, n * ratio * zoom))
  const functions = useMemo(() => element.functions.map(item => ({ ...item, fn: compileMathExpression(item.expression) })), [element.functions])
  const lines = (axis: number) => {
    const span = size / grid[axis]
    const start = Math.ceil(-origin[axis] / grid[axis])
    return Array.from({ length: Math.min(300, Math.ceil(span) + 1) }, (_, i) => start + i)
  }
  const handleReset = () => { setZoom(1); setOffset([0, 0]); setMesh(element.showTypes.includes('Mesh')) }
  return <SubjectCardFrame element={element} scale={scale} active={active} label="函数图像" style={{ background: '#fafafa', boxShadow: 'none', border: '1px solid #f0f0f0', borderRadius: 0 }}>
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ margin: 3, background: '#ffffff', cursor: active ? 'grab' : undefined, touchAction: 'none' }}
      onPointerDown={event => { if (active) { drag.current = [event.clientX, event.clientY, ...offset]; event.currentTarget.setPointerCapture(event.pointerId) } }}
      onPointerMove={event => { if (active && drag.current) setOffset([drag.current[2] + (event.clientX - drag.current[0]) / scale, drag.current[3] + (event.clientY - drag.current[1]) / scale]) }}
      onPointerUp={() => { drag.current = null }} onPointerCancel={() => { drag.current = null }}>
      <defs><clipPath id={clip}><rect width={size} height={size} /></clipPath></defs>
      <g clipPath={`url(#${clip})`}>
        {mesh && [0, 1].map(axis => lines(axis).map(i => {
          const pos = origin[axis] + i * grid[axis]
          return <path key={`${axis}-${i}`} d={axis ? `M0 ${pos}H${size}` : `M${pos} 0V${size}`} stroke={i % element.tagStep[axis] === 0 ? '#999999' : '#dedede'} strokeWidth={.7} />
        }))}
        {element.showTypes.includes('CoordinateAxes') && <g stroke="#464646" fill="#464646" strokeWidth={1.5}>
          <path d={`M0 ${origin[1]}H${size}M${origin[0]} 0V${size}`} fill="none" />
          <path d={`M${size} ${origin[1]}l-5 -3v6zM${origin[0]} 0l-3 5h6z`} stroke="none" />
          <text x={size - 7} y={origin[1] - 8} fontSize="12" stroke="none">x</text><text x={origin[0] - 18} y="10" fontSize="12" stroke="none">y</text>
        </g>}
        {element.showTypes.includes('GraduationTag') && <g fill="#191d26" fontSize="11" fontFamily="Arial, sans-serif" style={{ paintOrder: 'stroke', stroke: '#ffffff', strokeWidth: 2 }}>
          {[0, 1].map(axis => lines(axis).filter(i => i !== 0 && i % element.tagStep[axis] === 0).map(i => {
            const pos = origin[axis] + i * grid[axis]
            const value = i / element.tagStep[axis] * element.tagValueStep[axis] * element.tagScale * (axis ? -1 : 1)
            return <text key={`${axis}-${i}`} x={axis ? origin[0] - 5 : pos} y={axis ? pos + 4 : origin[1] + 16} textAnchor={axis ? 'end' : 'middle'}>{Number(value.toPrecision(6))}</text>
          }))}
          <text x={origin[0] - 5} y={origin[1] + 16} textAnchor="end">0</text>
        </g>}
        {functions.map(item => item.fn && <path key={item.id} data-function={item.expression}
          d={functionPath(item.fn, size, size, origin, unit)} fill="none" stroke={item.color} strokeWidth={2.8} />)}
      </g>
    </svg>
    <div style={{ position: 'absolute', left: size + 25, right: 18, top: '40%', display: 'grid' }}>
      {functions.map((item, index) => <div key={item.id} title={item.fn ? undefined : '暂不支持此表达式'}
        style={{ padding: '16px 6px', borderBottom: index < functions.length - 1 ? '1px solid #dedede' : undefined }}><ExpressionLabel expression={item.expression} /></div>)}
    </div>
    <div style={{ position: 'absolute', left: size - 21, bottom: 8, display: 'grid', gap: 1 }}>
      <button type="button" aria-label="切换网格" aria-pressed={mesh} disabled={!active} onClick={() => setMesh(value => !value)} style={{ ...styles.button, width: 18, height: 18, background: mesh ? '#00c881' : '#ffffff', color: mesh ? '#ffffff' : '#626773' }}>▦</button>
      <button type="button" aria-label="复位函数图像" disabled={!active} onClick={handleReset} style={{ ...styles.button, width: 18, height: 18 }}>↻</button>
      <button type="button" aria-label="放大函数图像" disabled={!active} onClick={() => setZoom(value => Math.min(8, value * 1.25))} style={{ ...styles.button, width: 18, height: 18 }}>＋</button>
      <button type="button" aria-label="缩小函数图像" disabled={!active} onClick={() => setZoom(value => Math.max(.2, value / 1.25))} style={{ ...styles.button, width: 18, height: 18 }}>−</button>
    </div>
  </SubjectCardFrame>
}
