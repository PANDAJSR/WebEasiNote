import assert from 'node:assert/strict'
import { test } from 'node:test'
import React, { act, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Window } from 'happy-dom'
import { audioRange, parseAudioElement, parseMediaTime } from '../src/enbx/audios'
import { parseSlideElements } from '../src/enbx/slide-elements-parser'
import { useAudioPlayback } from '../src/components/audio-player/useAudioPlayback'
import { SlideViewerLayer } from '../src/components/slide-viewer/SlideViewerLayer'
import { AudioControls } from '../src/components/audio-player/AudioControls'
import type { AudioElement, SlideData } from '../src/types'

const dom = new Window()
Object.assign(globalThis, { window: dom, document: dom.document, React,
  XMLSerializer: dom.XMLSerializer, IS_REACT_ACT_ENVIRONMENT: true })
const xml = (text: string) => new dom.DOMParser().parseFromString(text, 'text/xml').documentElement as unknown as Element
// 根据官方 TimeSpan/AudioSaveInfo 契约构造；不是实际课件取证。
const fixture = `<Audio><Id>audio</Id><Source>id://music</Source><MediaName>课堂音频</MediaName>
  <X>20</X><Y>30</Y><Width>64</Width><Height>64</Height>
  <ClipStart>20000000</ClipStart><ClipEnd>50000000</ClipEnd><Volume>0.7</Volume>
  <PlayPoints><Item>30000000</Item><Item>45000000</Item></PlayPoints>
  <ElementBehavior><IsAutoPlay>True</IsAutoPlay><IsCrossSlidePlay>True</IsCrossSlidePlay>
    <StopPlayPageNumber>3</StopPlayPageNumber></ElementBehavior></Audio>`
const element = parseAudioElement(xml(fixture))

test('音频 ticks、绝对裁剪终点、打点及组偏移解析', () => {
  assert.equal(parseMediaTime('25000000'), 2.5)
  assert.equal(parseMediaTime('bad'), null)
  assert.equal(parseMediaTime('-1'), null)
  assert.equal(parseMediaTime(''), null)
  assert.equal(element.sourceId, 'music')
  assert.equal(element.clipStart, 2)
  assert.equal(element.clipEnd, 5)
  assert.deepEqual(element.playPoints, [3, 4.5])
  assert.equal(element.stopPlayPageNumber, 3)
  const parsed = parseSlideElements(xml(`<Elements>${fixture}</Elements>`), { slideId: 's', offsetX: 10 })
  assert.equal(parsed.elements[0].type, 'audio')
  assert.equal(parsed.elements[0].x, 30)
  assert.ok(parsed.elements[0].rawXml?.includes('<Audio>'))
  assert.deepEqual(parsed.issues, [])
  const missing = parseAudioElement(xml('<Audio><Meta><Volume>1</Volume></Meta></Audio>'))
  assert.equal(missing.volume, 0.5)
  assert.equal(missing.clipEnd, null)
  assert.equal(missing.sourceId, '')
  assert.deepEqual(audioRange(element, 4), { start: 2, end: 4 })
})

function installMediaMock() {
  const states = new WeakMap<object, { paused: boolean; time: number; volume: number }>()
  const state = (node: object) => {
    if (!states.has(node)) states.set(node, { paused: true, time: 0, volume: 1 })
    return states.get(node)!
  }
  let rejection = false
  let plays = 0
  const proto = dom.HTMLMediaElement.prototype
  Object.defineProperties(proto, {
    duration: { configurable: true, get() { return 10 } },
    paused: { configurable: true, get() { return state(this).paused } },
    currentTime: { configurable: true, get() { return state(this).time }, set(value) { state(this).time = value } },
    volume: { configurable: true, get() { return state(this).volume }, set(value) { state(this).volume = value } }
  })
  proto.play = async function () {
    plays++
    if (rejection) throw Object.assign(new Error('blocked'), { name: 'NotAllowedError' })
    state(this).paused = false
    this.dispatchEvent(new dom.Event('play'))
  }
  proto.pause = function () {
    state(this).paused = true
    this.dispatchEvent(new dom.Event('pause'))
  }
  return { get plays() { return plays }, block(value: boolean) { rejection = value } }
}

test('裁剪循环、拖动边界、播放拒绝恢复、编辑/动画及卸载清理', async () => {
  const mock = installMediaMock()
  const container = document.createElement('div')
  const root = createRoot(container)
  let player!: ReturnType<typeof useAudioPlayback>
  function Probe({ audio, active, keep }: { audio: AudioElement; active: boolean; keep: boolean }) {
    player = useAudioPlayback({ element: audio, url: 'blob:music', active, keepPlaying: keep, autoPlay: audio.isAutoPlay })
    return <audio ref={player.ref} />
  }
  const render = async (audio: AudioElement, active = true, keep = true) => act(async () => {
    root.render(<StrictMode><Probe audio={audio} active={active} keep={keep} /></StrictMode>)
  })
  try {
    mock.block(true)
    await render(element)
    assert.match(player.error, /点击播放/)
    const audio = container.querySelector('audio')!
    await act(async () => audio.dispatchEvent(new dom.Event('loadedmetadata') as unknown as Event))
    assert.equal(audio.currentTime, 2)
    mock.block(false)
    await act(async () => player.play())
    assert.equal(player.playing, true)
    await act(async () => player.seek(100))
    assert.equal(audio.currentTime, 5)
    await act(async () => audio.dispatchEvent(new dom.Event('timeupdate') as unknown as Event))
    assert.equal(audio.paused, true)
    assert.equal(audio.currentTime, 2)
    const loop = { ...element, isLoopPlay: true }
    await render(loop)
    await act(async () => player.play())
    await act(async () => {
      audio.currentTime = 5
      audio.dispatchEvent(new dom.Event('timeupdate') as unknown as Event)
    })
    assert.equal(audio.currentTime, 2)
    assert.equal(audio.paused, false)
    const count = mock.plays
    await render(loop, false, false)
    assert.equal(audio.paused, true)
    assert.equal(mock.plays, count)
    await act(async () => root.unmount())
    assert.equal(audio.paused, true)
  } finally {
    await act(async () => root.unmount())
  }
})

test('跨页保留同一个音频实例，停止页卸载，未访问页面不发声', async () => {
  installMediaMock()
  const pages: SlideData[] = [0, 1, 2].map(index => ({ id: `s${index}`, width: 1280, height: 720,
    backgroundColor: '#fff', animationOrders: [], animations: [], issues: [],
    elements: index === 0 ? [element] : [] }))
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  const render = async (current: number) => act(async () => root.render(<>
    {pages.map((page, index) => <SlideViewerLayer key={page.id} slideItem={page} index={index}
      currentIndex={current} slideScale={1} resourceMap={{ music: 'blob:music' }}
      transitionState={null} lineRevealProgress={0} setLayerRef={() => {}} isEditMode={false} />)}
  </>))
  try {
    await render(1)
    assert.equal(container.querySelector('audio'), null)
    await render(0)
    const audio = container.querySelector('audio')!
    assert.ok(audio)
    await render(1)
    assert.equal(container.querySelector('audio'), audio)
    assert.equal(audio.paused, false)
    await render(2)
    assert.equal(container.querySelector('audio'), null)
    assert.equal(audio.paused, true)
    assert.equal(document.getElementById('audio-playback-overlays'), null)
  } finally {
    await act(async () => root.unmount())
    container.remove()
  }
})

test('官方胶囊条：播放和展开独立，折叠环形进度，音量浮层及打点跳转', async () => {
  installMediaMock()
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  function Probe() {
    const [expanded, setExpanded] = React.useState(false)
    const player = useAudioPlayback({ element, url: 'blob:music', active: true, keepPlaying: true, autoPlay: false })
    return <><audio ref={player.ref} /><AudioControls element={element} player={player}
      expanded={expanded} onExpand={setExpanded} isEditMode={false} missing={false} /></>
  }
  const click = async (selector: string) => act(async () => {
    const button = container.querySelector(selector) as unknown as HTMLButtonElement
    assert.ok(button, selector)
    button.click()
  })
  try {
    await act(async () => root.render(<Probe />))
    const audio = container.querySelector('audio')!
    await act(async () => audio.dispatchEvent(new dom.Event('loadedmetadata') as unknown as Event))
    assert.ok(container.querySelector('circle[r="23"]'))
    assert.equal(container.querySelector('[role="slider"]'), null)
    await click('[aria-label="播放音频"]')
    assert.equal(audio.paused, false)
    assert.equal(container.querySelector('[role="slider"]'), null)
    await click('[aria-label="展开音频控制条"]')
    assert.equal(audio.paused, false)
    assert.ok(container.querySelector('[aria-label="音频进度"]'))
    assert.equal(container.querySelector('circle[r="23"]'), null)
    await click('[aria-label="音频音量"]')
    assert.ok(container.querySelector('[aria-label="调整音量"]'))
    await click('button[title="0:01"]')
    assert.equal(audio.currentTime, 2.9)
    await click('[aria-label="折叠音频控制条"]')
    assert.equal(container.querySelector('[aria-label="调整音量"]'), null)
    assert.ok(container.querySelector('circle[r="23"]'))
  } finally {
    await act(async () => root.unmount())
    container.remove()
  }
})
