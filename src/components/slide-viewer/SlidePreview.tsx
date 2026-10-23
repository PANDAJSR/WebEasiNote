import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { SlideData } from '../../enbx/parser'
import type { SlideElement } from '../../types'
import { SlideRenderer } from '../SlideRenderer'
import { thumbnailHeight, thumbnailWidth } from './constants'

export const SlidePreviewLoader = createContext<((index: number, signal: AbortSignal) => Promise<SlideData>) | undefined>(undefined)

const previews = new WeakMap<SlideData, SlideData>()
const staticElements = (elements: SlideElement[]): SlideElement[] => elements
  .filter(element => element.type !== 'audio' && element.type !== 'video' && element.type !== 'flash')
  .map(element => element.type === 'activity' ? { ...element, contents: staticElements(element.contents) } : element)

/** 预览只复用静态元素，绝不挂载媒体播放器或 Flash 运行时。 */
export function staticPreview(slide: SlideData): SlideData {
  let preview = previews.get(slide)
  if (!preview) {
    preview = { ...slide, elements: staticElements(slide.elements), activities: undefined }
    previews.set(slide, preview)
  }
  return preview
}

/** 仅在滚动容器可见范围内挂载预览；离开视口立即释放渲染树。 */
export function SlidePreview({ slide, index, resourceMap }: {
  slide: SlideData; index: number; resourceMap: Record<string, string>
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const [visible, setVisible] = useState(false)
  const [loaded, setLoaded] = useState<SlideData>()
  const load = useContext(SlidePreviewLoader)
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      root: element.closest('[data-slide-list]'), threshold: 0
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    if (!visible || !slide.loadState || !load) return
    const controller = new AbortController()
    void load(index, controller.signal).then(result => {
      if (!controller.signal.aborted) setLoaded(result)
    }).catch(() => undefined)
    return () => { controller.abort(); setLoaded(undefined) }
  }, [visible, slide, index, load])
  const source = slide.loadState ? loaded : slide
  return <span ref={ref} style={{ display: 'block', width: thumbnailWidth, height: thumbnailHeight,
    overflow: 'hidden', pointerEvents: 'none' }}>
    {visible && source
      ? <SlideRenderer slide={staticPreview(source)} resourceMap={resourceMap}
          scale={Math.min(thumbnailWidth / source.width, thumbnailHeight / source.height, 1)}
          currentIndex={-1} />
      : <span>第 {index + 1} 页</span>}
  </span>
}
