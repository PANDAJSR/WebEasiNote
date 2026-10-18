import { useEffect, useState } from 'react'
import type { ImgHTMLAttributes } from 'react'
import { Button } from 'antd'

/** 保持原有布局与元素实例；仅重试失败的云图片请求。 */
export function ProgressiveImage({ src, style, ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => { setState('loading'); setAttempt(0) }, [src])
  const cloud = src?.includes('/courseware/')
  const url = cloud && attempt ? `${src}${src?.includes('?') ? '&' : '?'}retry=${attempt}` : src
  return <>
    <img {...props} src={url} style={style} onLoad={() => setState('ready')} onError={() => setState('error')} />
    {cloud && state !== 'ready' && <div style={{ position: 'absolute', inset: 0, display: 'flex',
      alignItems: 'center', justifyContent: 'center', background: '#e2e8f0', color: '#718096', fontSize: 12,
      pointerEvents: state === 'error' ? 'auto' : 'none' }}>
      {state === 'error' ? <Button size='small' onClick={event => {
        event.stopPropagation()
        setState('loading')
        setAttempt(value => value + 1)
      }}>重试图片</Button> : '图片加载中…'}
    </div>}
  </>
}
