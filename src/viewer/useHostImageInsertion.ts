import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CoursewareMetadata, PictureElement, SlideData } from '../types'
import { postToEnbxHost, subscribeToEnbxHost } from '../platform/host-bridge'

interface InsertedImage {
  pageId: string
  element: PictureElement
  dataUrl: string
  requestId: string
}

/** 手机传图沿用放映临时元素，仅保留在当前课件会话中。 */
export function useHostImageInsertion(slide: SlideData | undefined, metadata: CoursewareMetadata,
  onInserted: () => void) {
  const [images, setImages] = useState<InsertedImage[]>([])
  const latest = useRef({ slide, onInserted })
  latest.current = { slide, onInserted }
  const pending = useRef(new Set<InsertedImage>())

  useLayoutEffect(() => {
    for (const image of images) {
      if (!pending.current.delete(image)) continue
      postToEnbxHost({ type: 'image-inserted', requestId: image.requestId, success: true })
    }
  }, [images])

  useEffect(() => {
    setImages([])
    let active = true
    const decoding = new Set<() => void>()
    const fail = (requestId: unknown, error: string) => postToEnbxHost({
      type: 'image-inserted', requestId, success: false, error
    })
    const unsubscribe = subscribeToEnbxHost(message => {
      if (message.type !== 'insert-image') return
      const { requestId, dataUrl, name } = message
      const page = latest.current.slide
      if (typeof requestId !== 'string' || !requestId.trim()) {
        fail(requestId, '缺少有效的 requestId')
        return
      }
      if (!page || !Number.isFinite(page.width) || !Number.isFinite(page.height)
        || page.width <= 0 || page.height <= 0) {
        fail(requestId, '当前没有可插图的课件页面')
        return
      }
      if (typeof dataUrl !== 'string' || !/^data:image\/[a-z0-9.+-]+(?:;[^,]*)?,/i.test(dataUrl)) {
        fail(requestId, '图片必须使用 image 类型的 data URL')
        return
      }
      const image = new window.Image()
      let settled = false
      const finish = (error?: string) => {
        if (settled) return
        settled = true
        decoding.delete(cancel)
        image.onload = null
        image.onerror = null
        if (error) fail(requestId, error)
      }
      const cancel = () => finish('课件已关闭或切换')
      decoding.add(cancel)
      image.onerror = () => finish('图片解码失败')
      image.onload = () => {
        if (!active || latest.current.slide?.id !== page.id) {
          finish('当前页面已切换，请重试')
          return
        }
        const width = image.naturalWidth
        const height = image.naturalHeight
        if (!width || !height) {
          finish('图片尺寸无效')
          return
        }
        const scale = Math.min(1, page.width * 0.8 / width, page.height * 0.8 / height)
        const id = `host-image-${crypto.randomUUID()}`
        const inserted: InsertedImage = { pageId: page.id, requestId, dataUrl, element: {
          type: 'picture', id, sourceId: id, pictureName: typeof name === 'string' ? name : '手机图片',
          x: (page.width - width * scale) / 2, y: (page.height - height * scale) / 2,
          width: width * scale, height: height * scale, alpha: 1, rotation: 0,
          pictureSize: { width, height }
        } }
        finish()
        pending.current.add(inserted)
        setImages(previous => [...previous, inserted])
        latest.current.onInserted()
      }
      image.src = dataUrl
    })
    return () => {
      active = false
      unsubscribe()
      for (const cancel of decoding) cancel()
      for (const image of pending.current) fail(image.requestId, '课件已关闭或切换')
      pending.current.clear()
    }
  }, [metadata])

  const resources = useMemo(() => Object.fromEntries(images.map(image => [image.element.sourceId, image.dataUrl])), [images])
  return { images, resources }
}
