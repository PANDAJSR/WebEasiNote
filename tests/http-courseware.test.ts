import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Window } from 'happy-dom'
import JSZip from 'jszip'
import { HttpCourseware } from '../src/courseware/http-courseware'
import { NavigationIntent } from '../src/viewer/navigation-intent'
import { CloudPreloader } from '../src/courseware/cloud-preloader'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}

test('首屏后持续预取所有正文与静态资源，慢后台不阻塞前台，关闭取消后续任务', async () => {
  const dom = new Window()
  Object.assign(globalThis, { DOMParser: dom.DOMParser, XMLSerializer: dom.XMLSerializer, Node: dom.Node })
  const originalFetch = globalThis.fetch
  const requested: string[] = []
  const slow = deferred<Response>()
  const backgroundStarted = deferred<void>()
  const entries = ['Board.xml', ...Array.from({ length: 4 }, (_, i) => `Slides/Slide_${i}.xml`),
    'Resources/a.png', 'Resources/font.woff2', 'Resources/movie.mp4']
  globalThis.fetch = async input => {
    const url = new URL(String(input))
    requested.push(url.pathname + url.search)
    if (url.pathname.endsWith('manifest.json')) return Response.json({ protocolVersion: 1, sessionId: 's', name: '预取',
      files: entries.map(path => ({ path })) })
    if (url.pathname.endsWith('Board.xml')) return new Response('<Board><Slides><Item>s0</Item><Item>s1</Item><Item>s2</Item><Item>s3</Item></Slides></Board>')
    const match = url.pathname.match(/Slide_(\d+)\.xml$/)
    if (match) {
      if (match[1] === '1' && url.search) { backgroundStarted.resolve(); return slow.promise }
      return new Response(`<Slide><Id>s${match[1]}</Id><Elements/></Slide>`)
    }
    return new Response(new Uint8Array([1, 2, 3]))
  }
  const source = new HttpCourseware()
  const worker = new CloudPreloader(source)
  try {
    await source.open('https://example.test/courseware/s/manifest.json')
    await source.ensureSlide(0)
    assert.equal(requested.some(path => path.includes('Resources/')), false)
    const work = worker.run()
    await backgroundStarted.promise
    assert.equal((await source.ensureSlide(3)).id, 's3')
    const promoted = source.ensureSlide(1)
    slow.resolve(new Response('<Slide><Id>s1</Id><Elements/></Slide>'))
    await promoted
    await work
    assert.equal(source.loaded.size, 4)
    assert.equal(requested.some(path => path.endsWith('Resources/a.png?prefetch=1')), true)
    assert.equal(requested.some(path => path.endsWith('Resources/font.woff2?prefetch=1')), true)
    assert.equal(requested.some(path => path.includes('movie.mp4')), false)
    assert.equal(requested.some(path => path.endsWith('Slide_1.xml')), true, '前台提升相同路径优先级')
    const before = requested.length
    const cancelled = new CloudPreloader(source)
    const canceledWork = cancelled.run()
    cancelled.stop()
    await canceledWork
    assert.equal(requested.length, before)
  } finally { worker.stop(); source.dispose(); globalThis.fetch = originalFetch }
})

test('首屏只读取目录、引用与首张 XML，资源稳定 URL 不下载；后台页延迟不阻塞', async () => {
  const dom = new Window()
  Object.assign(globalThis, { DOMParser: dom.DOMParser, XMLSerializer: dom.XMLSerializer, Node: dom.Node })
  const originalFetch = globalThis.fetch
  const requested: string[] = []
  const second = deferred<Response>()
  const entries = ['Board.xml', 'Reference.xml', 'Slides/Slide_0.xml', 'Slides/Slide_1.xml', 'Resources/a.png']
  globalThis.fetch = async input => {
    const path = new URL(String(input)).pathname
    requested.push(path)
    if (path.endsWith('manifest.json')) return Response.json({ protocolVersion: 1, sessionId: 's', name: '测试',
      files: entries.map(path => ({ path, size: 0, hash: '' })) })
    if (path.endsWith('Board.xml')) return new Response('<Board><Slides><Item>a</Item><Item>b</Item></Slides></Board>')
    if (path.endsWith('Reference.xml')) return new Response('<Reference><Relationship><Id>r</Id><Target>Resources/a.png</Target></Relationship></Reference>')
    if (path.endsWith('Slide_0.xml')) return new Response('<Slide><Id>a</Id><Elements/></Slide>')
    if (path.endsWith('Slide_1.xml')) return second.promise
    throw new Error('不应预先下载资源')
  }
  const source = new HttpCourseware()
  try {
    await source.open('https://example.test/courseware/s/manifest.json')
    const first = await source.ensureSlide(0)
    assert.equal(first.id, 'a')
    assert.equal(source.metadata.slideCount, 2)
    assert.equal(requested.length, 4)
    assert.equal(source.resources.r, 'https://example.test/courseware/s/files/Resources/a.png')
    assert.equal(source.projectSlides()[1].loadState, 'unrequested')
    const next = source.ensureSlide(1)
    assert.equal(source.ensureSlide(1), next)
    assert.equal(source.loaded.get(0), first)
    second.resolve(new Response('<Slide><Id>b</Id><Elements/></Slide>'))
    assert.equal((await next).id, 'b')
    assert.equal(source.projectSlides()[0], first)
    assert.equal(requested.filter(path => path.endsWith('Slide_1.xml')).length, 1)
  } finally { source.dispose(); globalThis.fetch = originalFetch }
})

test('正文 ID 不符不提交；失败后同一页允许重试，完整导出包含所有文件', async () => {
  const dom = new Window()
  Object.assign(globalThis, { DOMParser: dom.DOMParser, XMLSerializer: dom.XMLSerializer, Node: dom.Node })
  const originalFetch = globalThis.fetch
  let fail = true
  globalThis.fetch = async input => {
    const path = new URL(String(input)).pathname
    if (path.endsWith('manifest.json')) return Response.json({ protocolVersion: 1, sessionId: 's', name: '测试',
      files: ['Board.xml', 'Slides/Slide_0.xml', 'Resources/a.png'].map(path => ({ path })) })
    if (path.endsWith('Board.xml')) return new Response('<Board><Slides><Item>a</Item></Slides></Board>')
    if (path.endsWith('Slide_0.xml')) return new Response(`<Slide><Id>${fail ? 'bad' : 'a'}</Id><Elements/></Slide>`)
    return new Response(new Uint8Array([1, 2, 3]))
  }
  const source = new HttpCourseware()
  try {
    await source.open('https://example.test/courseware/s/manifest.json')
    await assert.rejects(source.ensureSlide(0), /页 ID/)
    assert.equal(source.loaded.size, 0)
    fail = false
    await source.ensureSlide(0)
    const file = await source.completeFile()
    const zip = await JSZip.loadAsync(await file.arrayBuffer())
    assert.deepEqual(await zip.file('Resources/a.png')!.async('uint8array'), new Uint8Array([1, 2, 3]))
    assert.equal(zip.file('Board.xml') != null, true)
  } finally { source.dispose(); globalThis.fetch = originalFetch }
})

test('可见预览串行加载、取消排队请求并复用缓存，不改变导航状态；缓存有界', async () => {
  const dom = new Window()
  Object.assign(globalThis, { DOMParser: dom.DOMParser, XMLSerializer: dom.XMLSerializer, Node: dom.Node })
  const originalFetch = globalThis.fetch
  const requested: number[] = []
  const first = deferred<Response>()
  const count = 26
  globalThis.fetch = async input => {
    const path = new URL(String(input)).pathname
    if (path.endsWith('manifest.json')) return Response.json({ protocolVersion: 1, sessionId: 's', name: '预览',
      files: ['Board.xml', ...Array.from({ length: count }, (_, i) => `Slides/Slide_${i}.xml`)].map(path => ({ path })) })
    if (path.endsWith('Board.xml')) return new Response(`<Board><Slides>${Array.from({ length: count }, (_, i) => `<Item>s${i}</Item>`).join('')}</Slides></Board>`)
    const index = Number(path.match(/Slide_(\d+)\.xml$/)![1])
    requested.push(index)
    if (requested.length === 1) return first.promise
    return new Response(`<Slide><Id>s${index}</Id><Elements/></Slide>`)
  }
  const source = new HttpCourseware()
  try {
    await source.open('https://example.test/courseware/s/manifest.json')
    const controller = new AbortController()
    const preview = source.previewSlide(0, controller.signal)
    const canceled = new AbortController()
    const queued = source.previewSlide(1, canceled.signal)
    const rejection = assert.rejects(queued, { name: 'AbortError' })
    canceled.abort()
    await new Promise(resolve => setImmediate(resolve))
    assert.deepEqual(requested, [0])
    first.resolve(new Response('<Slide><Id>s0</Id><Elements/></Slide>'))
    const slide = await preview
    await rejection
    assert.equal(await source.previewSlide(0, controller.signal), slide)
    assert.deepEqual(requested, [0])
    assert.equal(source.loaded.size, 0)
    assert.equal(source.projectSlides()[0].loadState, 'unrequested')
    for (let index = 1; index < count; index++) await source.previewSlide(index, controller.signal)
    await source.previewSlide(0, controller.signal)
    assert.equal(requested.filter(index => index === 0).length, 2)
  } finally { source.dispose(); globalThis.fetch = originalFetch }
})

test('连续导航只提交最后目标；超时或取消后迟到正文不得提交', async () => {
  const intent = new NavigationIntent()
  const old = deferred<void>()
  const commits: string[] = []
  const first = intent.run(() => old.promise, async () => { commits.push('old') })
  const rejected = assert.rejects(first, /替代/)
  await intent.run(async () => undefined, async () => { commits.push('new') })
  await rejected
  old.resolve()
  await Promise.resolve()
  assert.deepEqual(commits, ['new'])
  const slow = deferred<void>()
  await assert.rejects(intent.run(() => slow.promise, async () => { commits.push('timeout') }, 10), /超时/)
  slow.resolve()
  await Promise.resolve()
  assert.deepEqual(commits, ['new'])
  const cancel = intent.run(() => new Promise(() => undefined), async () => { commits.push('cancel') })
  intent.cancel()
  await assert.rejects(cancel, /取消/)
})
