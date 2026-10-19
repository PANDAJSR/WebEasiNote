import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ImgHTMLAttributes } from 'react'
import { Button } from 'antd'

/** 保持原有布局与元素实例；仅重试失败的云图片请求。 */
export function ProgressiveImage({ src, style, ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [attempt, setAttempt] = useState(0)
  const [showLoading, setShowLoading] = useState(false)
  const image = useRef<HTMLImageElement>(null)
  useLayoutEffect(() => { setAttempt(0) }, [src])
  const cloud = src?.includes('/courseware/')
  const url = cloud && attempt ? `${src}${src?.includes('?') ? '&' : '?'}retry=${attempt}` : src
  useLayoutEffect(() => {
    setShowLoading(false)
    // 缓存命中的图片可能在 effect 执行前已完成，首帧就采用实际状态。
    setState(image.current?.complete && image.current.naturalWidth > 0 ? 'ready' : 'loading')
  }, [url])
  useEffect(() => {
    if (!cloud || state !== 'loading') return
    const timer = setTimeout(() => {
      setShowLoading(true)
      console.info(`[CloudLoading] image-wait src=${src} attempt=${attempt} delay=250`)
    }, 250)
    return () => clearTimeout(timer)
  }, [cloud, state, url])
  return <>
    <img {...props} ref={image} src={url} style={style} onLoad={() => setState('ready')} onError={() => {
      setState('error')
      if (cloud) console.warn(`[CloudLoading] image-failed src=${src} attempt=${attempt}`)
    }} />
    {cloud && (state === 'error' || state === 'loading' && showLoading) && <div style={{ position: 'absolute', inset: 0, display: 'flex',
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
