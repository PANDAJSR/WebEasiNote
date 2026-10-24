import assert from 'node:assert/strict'
import { test } from 'node:test'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { Window } from 'happy-dom'
import type { CoursewareMetadata, SlideData } from '../src/types'
import { AudioRenderer } from '../src/components/AudioRenderer'
import { VideoRenderer } from '../src/components/VideoRenderer'

test('资料夹音视频插入、真实渲染器播放、请求取消及失败清理', async () => {
  const window = new Window()
  const messages: any[] = []
  const listeners = new Set<(event: any) => void>()
  Object.assign(window, { chrome: { webview: {
    postMessage: (message: unknown) => messages.push(message),
    addEventListener: (_: string, listener: any) => listeners.add(listener),
    removeEventListener: (_: string, listener: any) => listeners.delete(listener)
  } } })
  Object.assign(globalThis, { window, document: window.document, React, IS_REACT_ACT_ENVIRONMENT: true })
  const { usePlaybackSelection } = await import('../src/viewer/usePlaybackSelection')
  const { useEnbxHostMessages } = await import('../src/hooks/useEnbxHostMessages')
  const { HOST_MEDIA_INSERTION_TIMEOUT_MS } = await import('../src/viewer/useHostMediaInsertion')
  const decoders: any[] = []
  const createElement = window.document.createElement.bind(window.document)
  window.document.createElement = ((tag: string, ...args: any[]) => {
    const element = (createElement as any)(tag, ...args)
    if (tag === 'audio' || tag === 'video') decoders.push(element)
    return element
  }) as typeof window.document.createElement
  const proto = window.HTMLMediaElement.prototype
  const paused = new WeakMap<object, boolean>()
  let plays = 0
  Object.defineProperties(proto, {
    duration: { configurable: true, get: () => 12 },
    paused: { configurable: true, get() { return paused.get(this) ?? true } }
  })
  Object.defineProperties(window.HTMLVideoElement.prototype, {
    videoWidth: { configurable: true, get: () => 1920 },
    videoHeight: { configurable: true, get: () => 1080 }
  })
  proto.load = () => undefined
  proto.play = async function () {
    plays++
    paused.set(this, false)
    this.dispatchEvent(new window.Event('play'))
  }
  proto.pause = function () {
    if (paused.get(this) !== false) return
    paused.set(this, true)
    this.dispatchEvent(new window.Event('pause'))
  }
  // 仅接管媒体加载超时，播放器自己的计时器仍使用正常实现。
  const timers = new Map<number, () => void>()
  const setTimeout = window.setTimeout.bind(window)
  const clearTimeout = window.clearTimeout.bind(window)
  let timerId = -1
  window.setTimeout = ((callback: () => void, delay?: number) => {
    if (delay !== HOST_MEDIA_INSERTION_TIMEOUT_MS) return setTimeout(callback, delay)
    const id = timerId--
    timers.set(id, callback)
    return id
  }) as typeof window.setTimeout
  window.clearTimeout = ((id: number) => {
    if (!timers.delete(id)) clearTimeout(id)
  }) as typeof window.clearTimeout
  const pages: SlideData[] = ['a', 'b'].map(id => ({ id, width: 800, height: 600,
    backgroundColor: '#fff', elements: [], animationOrders: [], animations: [], issues: [] }))
  let metadata = { name: 'test' } as CoursewareMetadata
  let index = 0
  let active = true
  let state!: ReturnType<typeof usePlaybackSelection>
  function Player() {
    state = usePlaybackSelection(pages, index, metadata, active)
    return <div>{state.slides[index].elements.map(element => element.type === 'audio'
      ? <AudioRenderer key={element.id} element={element} scale={1} resourceMap={state.resources}
        isCurrentSlide currentSlideNumber={index + 1} sourceSlideNumber={index + 1}
        isEditMode={false} isVisible slideWidth={800} slideHeight={600} />
      : element.type === 'video' ? <VideoRenderer key={element.id} element={element} scale={1}
        resourceMap={state.resources} isCurrentSlide currentSlideNumber={index + 1} sourceSlideNumber={index + 1} /> : null)}</div>
  }
  const container = document.createElement('div')
  const root = createRoot(container as unknown as HTMLElement)
  const render = () => act(async () => root.render(<Player />))
  const emit = (data: any) => { for (const listener of listeners) listener({ data }) }
  const send = (requestId: unknown, mediaKind: unknown = 'audio', dataUrl = `data:${mediaKind}/mpeg;base64,aGVsbG8=`) =>
    act(async () => emit({ type: 'insert-media', requestId, mediaKind, dataUrl, name: '资料夹素材' }))
  const cancel = (requestId: string) => act(async () => emit({ type: 'cancel-media', requestId }))
  const receipt = (id: unknown) => messages.filter(message => message.type === 'media-inserted' && message.requestId === id)
  const finish = (decoder = decoders.at(-1)!) => act(async () => decoder.onloadedmetadata())
  const failed = (id: unknown, error: RegExp) => {
    assert.equal(receipt(id).length, 1)
    assert.equal(receipt(id)[0].success, false)
    assert.match(receipt(id)[0].error, error)
  }
  await render()
  try {
    await send('audio')
    const audioDecoder = decoders.at(-1)!
    assert.equal(receipt('audio').length, 0)
    assert.equal(audioDecoder.preload, 'metadata')
    await send('audio')
    assert.equal(decoders.at(-1), audioDecoder)
    await finish(audioDecoder)
    assert.deepEqual(receipt('audio'), [{ type: 'media-inserted', requestId: 'audio', success: true }])
    assert.equal(timers.size, 0)
    assert.equal(audioDecoder.getAttribute('src'), null)
    assert.equal(state.selection.enabled, false)
    const audio = state.slides[0].elements[0]
    assert.equal(audio.type, 'audio')
    assert.deepEqual([audio.x, audio.y, audio.width, audio.height], [344.5, 276, 111, 48])
    assert.equal(container.querySelector('audio')!.getAttribute('src'), 'data:audio/mpeg;base64,aGVsbG8=')
    const playButton = container.querySelector('[aria-label="播放音频"]')!
    await act(async () => playButton.dispatchEvent(new window.MouseEvent('click', { bubbles: true }) as unknown as Event))
    assert.equal(plays, 1)
    assert.ok(container.querySelector('[aria-label="暂停音频"]'))
    await cancel('audio')
    await send('audio')
    assert.equal(receipt('audio').length, 1)
    assert.equal(state.slides[0].elements.length, 1)

    await act(async () => state.selection.annotation!.setState({ tool: 'select' }))
    await send('video', 'video', 'data:video/mp4;base64,aGVsbG8=')
    await finish()
    const video = state.slides[0].elements[1]
    assert.equal(video.type, 'video')
    assert.deepEqual([video.x, video.y, video.width, video.height], [80, 120, 640, 360])
    assert.equal(receipt('video')[0].success, true)
    assert.equal(state.selection.enabled, false)
    const videoNode = container.querySelector('video')!
    assert.equal(videoNode.getAttribute('src'), 'data:video/mp4;base64,aGVsbG8=')
    assert.equal(videoNode.controls, true)
    await act(async () => videoNode.play())
    assert.equal(plays, 2)
    assert.equal(pages[0].elements.length, 0)
    await act(async () => state.selection.onChange([{ ...video, x: 150 }]))
    assert.equal(state.slides[0].elements[1].x, 150)
    index = 1
    await render()
    assert.equal(state.slides[1].elements.length, 0)
    index = 0
    await render()
    assert.equal(state.slides[0].elements[1].id, video.id)
    await act(async () => state.selection.onCommand('delete', [video.id]))
    assert.equal(state.slides[0].elements.length, 1)

    await send('cancelled')
    const cancelled = decoders.at(-1)!
    const lateLoad = cancelled.onloadedmetadata!
    const lateError = cancelled.onerror!
    await cancel('cancelled')
    failed('cancelled', /取消/)
    assert.equal(cancelled.onloadedmetadata, null)
    assert.equal(cancelled.onerror, null)
    assert.equal(cancelled.getAttribute('src'), null)
    await act(async () => { lateLoad(); lateError() })
    await cancel('cancelled')
    await cancel('unknown')
    assert.equal(receipt('cancelled').length, 1)
    assert.equal(receipt('unknown').length, 0)
    // 元数据已完成但 React 尚未提交时取消，不应留下元素或成功回执。
    await send('cancel-before-commit')
    const committing = decoders.at(-1)!
    await act(async () => { committing.onloadedmetadata(); emit({ type: 'cancel-media', requestId: 'cancel-before-commit' }) })
    failed('cancel-before-commit', /取消/)
    assert.equal(state.slides[0].elements.length, 1)
    assert.equal(Object.keys(state.resources).length, 2)

    await send('', 'audio')
    failed('', /requestId/)
    await send('kind', 'image')
    failed('kind', /类型/)
    await send('url', 'audio', 'https://example.com/a.mp3')
    failed('url', /data URL/)
    await send('mime', 'video', 'data:audio/mpeg;base64,aGVsbG8=')
    failed('mime', /data URL/)
    await send('broken')
    await act(async () => decoders.at(-1)!.onerror())
    failed('broken', /不支持/)
    await send('duration')
    Object.defineProperty(decoders.at(-1)!, 'duration', { get: () => NaN })
    await finish()
    failed('duration', /时长/)
    await send('size', 'video')
    Object.defineProperty(decoders.at(-1)!, 'videoWidth', { get: () => 0 })
    await finish()
    failed('size', /尺寸/)
    await send('timeout')
    const timeout = [...timers.values()][0]
    const timedOutLoad = decoders.at(-1)!.onloadedmetadata!
    await act(async () => timeout())
    failed('timeout', /超时/)
    await act(async () => timedOutLoad())
    assert.equal(receipt('timeout').length, 1)
    assert.equal(timers.size, 0)

    await send('navigated')
    const navigatedLoad = decoders.at(-1)!.onloadedmetadata!
    index = 1
    await render()
    index = 0
    await render()
    await act(async () => navigatedLoad())
    failed('navigated', /切换/)
    await send('exited')
    active = false
    await render()
    failed('exited', /退出播放/)
    await send('inactive')
    failed('inactive', /播放页面/)
    active = true
    await render()
    await send('closed')
    metadata = { name: 'new' } as CoursewareMetadata
    await render()
    failed('closed', /关闭或切换/)
    assert.deepEqual(state.resources, {})
    assert.equal(state.slides[0].elements.length, 0)

    await send('parallel-cancel')
    await send('parallel-keep', 'video')
    const parallelDecoder = decoders.at(-1)!
    await cancel('parallel-cancel')
    failed('parallel-cancel', /取消/)
    assert.equal(receipt('parallel-keep').length, 0)
    await finish(parallelDecoder)
    assert.equal(receipt('parallel-keep')[0].success, true)
    assert.equal(state.slides[0].elements.length, 1)
    assert.equal(Object.keys(state.resources).length, 1)

    function Home() {
      useEnbxHostMessages({ loadENBXUrlRef: { current: async () => true }, openManifest: () => undefined,
        viewModeRef: { current: 'welcome' }, setNavigationCommand: () => undefined,
        setToggleThumbnailsCommand: () => undefined, setClickToNextEnabled: () => undefined,
        setSwipeNavigationEnabled: () => undefined })
      return null
    }
    await send('unmounted')
    await act(async () => root.render(<Home />))
    failed('unmounted', /关闭或切换/)
    await send('home')
    failed('home', /播放页面/)
  } finally {
    await act(async () => root.unmount())
    assert.equal(listeners.size, 0)
    assert.equal(timers.size, 0)
    await window.happyDOM.abort()
  }
})
