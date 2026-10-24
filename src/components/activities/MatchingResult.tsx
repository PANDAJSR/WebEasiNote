import { useLayoutEffect, useRef } from 'react'
import { matchingStyles as styles } from './matching-styles'

/** 官方答案提示以两倍大小淡入，再缩至正常大小（300ms）。 */
export function MatchingResult({ id, index, x, y, correct, empty, delay }: {
  id: string; index: number; x: number; y: number; correct: boolean; empty: boolean; delay: number
}) {
  const node = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    const animation = node.current?.animate?.([{ opacity: 0, transform: 'scale(2)' },
      { opacity: 1, transform: 'scale(1)' }], { duration: 300, delay, fill: 'backwards' })
    void animation?.finished?.catch(() => {})
    return () => animation?.cancel()
  }, [correct, empty, delay])
  return <span ref={node} role='status' data-matching-result={id}
    aria-label={`空位 ${index + 1}：${correct ? '正确' : empty ? '未填' : '错误'}`}
    style={{ ...styles.result, left: x, top: y, background: correct ? '#15803d' : '#dc2626' }}>
    {correct ? '✓ 正确' : empty ? '！未填' : '✗ 错误'}
  </span>
}
