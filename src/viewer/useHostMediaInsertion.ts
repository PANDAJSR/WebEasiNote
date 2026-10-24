import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { AudioElement, CoursewareMetadata, SlideData, VideoElement } from '../types'
import { postToEnbxHost, subscribeToEnbxHost } from '../platform/host-bridge'

export const HOST_MEDIA_INSERTION_TIMEOUT_MS = 10_000

interface InsertedMedia {
  pageId: string
  element: AudioElement | VideoElement
  dataUrl: string
  requestId: string
}

interface MediaRequest {
  pageId: string
  inserted?: InsertedMedia
  finish: (error?: string) => void
}

/** 宿主资料夹音视频仅属于当前放映会话，复用课件媒体渲染器。 */
export function useHostMediaInsertion(slide: SlideData | undefined, metadata: CoursewareMetadata,
  onInserted: () => void, active = true) {
  const [media, setMedia] = useState<InsertedMedia[]>([])
  const latest = useRef({ slide, onInserted, active })
  latest.current = { slide, onInserted, active }
  const requests = useRef(new Map<string, MediaRequest>())

  useLayoutEffect(() => {
    for (const request of requests.current.values()) {
      if (!active || request.pageId !== slide?.id) request.finish('当前页面已切换或已退出播放，请重试')
    }
    for (const item of media) {
      const request = requests.current.get(item.requestId)
      if (request?.inserted === item) request.finish()
    }
  }, [media, slide?.id, active])

  useEffect(() => {
    setMedia([])
    const processed = new Set<string>()
    const fail = (requestId: unknown, error: string) => postToEnbxHost({
      type: 'media-inserted', requestId, success: false, error
    })
    const unsubscribe = subscribeToEnbxHost(message => {
      if (message.type === 'cancel-media') {
        if (typeof message.requestId === 'string') requests.current.get(message.requestId)?.finish('媒体插入已取消')
        return
      }
      if (message.type !== 'insert-media') return
      const { requestId, dataUrl, mediaKind, name } = message
      if (typeof requestId !== 'string' || !requestId.trim()) {
        fail(requestId, '缺少有效的 requestId')
        return
      }
      // 同一会话的请求只提交和回复一次，防止宿主重发造成重复插入。
      if (processed.has(requestId)) return
      processed.add(requestId)
      const page = latest.current.slide
      if (!latest.current.active || !page || !Number.isFinite(page.width) || !Number.isFinite(page.height)
        || page.width <= 0 || page.height <= 0) {
        fail(requestId, '当前没有可插入媒体的播放页面')
        return
      }
      if (mediaKind !== 'audio' && mediaKind !== 'video') {
        fail(requestId, '不支持的媒体类型')
        return
      }
      if (typeof dataUrl !== 'string'
        || !new RegExp(`^data:${mediaKind}/[a-z0-9.+-]+(?:;[^,]*)?,`, 'i').test(dataUrl)) {
        fail(requestId, '媒体必须使用对应 audio 或 video 类型的 data URL')
        return
      }
      const decoder = document.createElement(mediaKind)
      decoder.preload = 'metadata'
      let settled = false
      let timer: number | undefined
      const release = () => {
        decoder.onloadedmetadata = null
        decoder.onerror = null
        decoder.removeAttribute('src')
        decoder.load()
      }
      const request: MediaRequest = { pageId: page.id, finish: error => {
        if (settled) return
        settled = true
        requests.current.delete(requestId)
        window.clearTimeout(timer)
        release()
        if (error) {
          if (request.inserted) setMedia(previous => previous.filter(item => item !== request.inserted))
          fail(requestId, error)
        } else postToEnbxHost({ type: 'media-inserted', requestId, success: true })
      } }
      requests.current.set(requestId, request)
      decoder.onerror = () => request.finish('媒体损坏或当前浏览器不支持此格式')
      decoder.onloadedmetadata = () => {
        if (settled || request.inserted) return
        if (!latest.current.active || latest.current.slide?.id !== page.id) {
          request.finish('当前页面已切换或已退出播放，请重试')
          return
        }
        if (!Number.isFinite(decoder.duration) || decoder.duration <= 0) {
          request.finish('媒体时长无效')
          return
        }
        const width = mediaKind === 'video' ? (decoder as HTMLVideoElement).videoWidth : 111
        const height = mediaKind === 'video' ? (decoder as HTMLVideoElement).videoHeight : 48
        if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
          request.finish('媒体尺寸无效')
          return
        }
        const scale = mediaKind === 'video' ? Math.min(1, page.width * 0.8 / width, page.height * 0.8 / height) : 1
        const id = `host-${mediaKind}-${crypto.randomUUID()}`
        const common = {
          id, sourceId: id, mediaName: typeof name === 'string' ? name : '资料夹媒体',
          x: Math.max(0, (page.width - width * scale) / 2), y: Math.max(0, (page.height - height * scale) / 2),
          width: width * scale, height: height * scale, rotation: 0, volume: 1, clipStart: 0,
          isLoopPlay: false, isAutoPlay: false, isCrossSlidePlay: false, stopPlayPageNumber: 0
        }
        const element: AudioElement | VideoElement = mediaKind === 'audio'
          ? { ...common, type: 'audio', clipEnd: null, playPoints: [], isHidden: false }
          : { ...common, type: 'video' }
        const inserted = { pageId: page.id, requestId, dataUrl, element }
        request.inserted = inserted
        release()
        setMedia(previous => [...previous, inserted])
        latest.current.onInserted()
      }
      timer = window.setTimeout(() => request.finish('媒体加载超时，请重试'), HOST_MEDIA_INSERTION_TIMEOUT_MS)
      try {
        decoder.src = dataUrl
        decoder.load()
      } catch {
        request.finish('媒体加载失败')
      }
    })
    return () => {
      unsubscribe()
      for (const request of requests.current.values()) request.finish('课件已关闭或切换')
    }
  }, [metadata])

  const resources = useMemo(() => Object.fromEntries(media.map(item => [item.element.sourceId, item.dataUrl])), [media])
  return { media, resources }
}
