import assert from 'node:assert/strict'
import { test } from 'node:test'
import JSZip from 'jszip'
import { Window } from 'happy-dom'
import { readCoursewareFile } from '../src/courseware/courseware-loader'
import { readCoursewareFolder } from '../src/courseware/courseware-loader'
import { resolvePronounceUrl } from '../src/components/subject-cards/PronounceButton'

test('同一 ZIP 供资源、元数据和页面共用，保留原始 XML 并加载内嵌缩略图', async () => {
  const dom = new Window()
  Object.assign(globalThis, { DOMParser: dom.DOMParser, XMLSerializer: dom.XMLSerializer,
    FileReader: dom.FileReader, Blob: dom.Blob, Node: dom.Node })
  const zip = new JSZip()
  zip.file('Board.xml', '<Board><Slides><Item>s</Item></Slides></Board>')
  const xml = '<Slide><Id>s</Id><Width>1280</Width><Height>720</Height><Elements><Shape><Id>x</Id><Width>20</Width><Height>20</Height><Path>M0 0 L1 0 L1 1Z</Path></Shape></Elements></Slide>'
  zip.file('Slides/Slide_0.xml', xml)
  zip.file('SlideThumbnails/Slide_0.png', new Uint8Array([137, 80, 78, 71]))
  const bytes = await zip.generateAsync({ type: 'uint8array' })
  const file = new dom.File([bytes], 'test.enbx')
  const load = JSZip.loadAsync
  let loads = 0
  JSZip.loadAsync = (...args) => { loads++; return load.apply(JSZip, args) }
  try {
    const { meta, slideData } = await readCoursewareFile(file as unknown as File)
    assert.equal(loads, 1)
    assert.equal(meta.slideCount, 1)
    assert.equal(slideData[0].rawXml, xml)
    assert.ok(slideData[0].thumbnail?.startsWith('data:image/png;base64,'))
    assert.equal(slideData[0].elements[0].id, 'x')
  } finally {
    JSZip.loadAsync = load
  }
})

test('ZIP 和文件夹补读学科发音逻辑路径，不读取路径之外的资源', async () => {
  const dom = new Window()
  Object.assign(globalThis, { DOMParser: dom.DOMParser, XMLSerializer: dom.XMLSerializer,
    FileReader: dom.FileReader, Blob: dom.Blob, Node: dom.Node })
  const files: Record<string, string | Uint8Array> = {
    'Board.xml': '<Board><Slides><Item>s</Item></Slides></Board>',
    'Slides/Slide_0.xml': `<Slide><Id>s</Id><Elements>
      <EnglishWordCard><Word>test</Word><PronounceSource>Resources/test.mp3</PronounceSource>
        <Synonym><SynonymsInfo><Word>bad</Word><PronounceSource>../outside.mp3</PronounceSource></SynonymsInfo></Synonym>
      </EnglishWordCard></Elements></Slide>`,
    'Resources/test.mp3': new Uint8Array([1, 2, 3]),
    'Resources/unused.mp3': new Uint8Array([4, 5, 6])
  }
  const created: string[] = []
  const create = URL.createObjectURL
  URL.createObjectURL = () => { const url = `blob:subject-${created.length}`; created.push(url); return url }
  const visited: string[] = []
  const requested: string[] = []
  const directory = (prefix = ''): FileSystemDirectoryHandle => ({
    kind: 'directory', name: prefix,
    async getDirectoryHandle(name: string) {
      const path = prefix + name + '/'
      if (!Object.keys(files).some(file => file.startsWith(path))) throw new Error('missing')
      return directory(path)
    },
    async getFileHandle(name: string) {
      const path = prefix + name
      requested.push(path)
      if (!(path in files)) throw new Error('missing')
      return { kind: 'file', name, async getFile() { visited.push(path); return new dom.File([files[path]], name) } }
    },
    async *values() {
      const names = new Set(Object.keys(files).filter(path => path.startsWith(prefix)).map(path => path.slice(prefix.length).split('/')[0]))
      for (const name of names) {
        const nested = Object.keys(files).some(path => path.startsWith(prefix + name + '/'))
        yield nested ? directory(prefix + name + '/') : await directory(prefix).getFileHandle(name)
      }
    },
    async *entries() {
      for await (const entry of directory(prefix).values()) yield [entry.name, entry]
    }
  } as unknown as FileSystemDirectoryHandle)
  try {
    const zip = new JSZip()
    Object.entries(files).forEach(([path, content]) => zip.file(path, content))
    const file = new dom.File([await zip.generateAsync({ type: 'uint8array' })], 'subjects.enbx')
    const zipped = await readCoursewareFile(file as unknown as File)
    assert.ok(resolvePronounceUrl('Resources/test.mp3', zipped.resources)?.startsWith('blob:subject-'))
    assert.equal(zipped.resources['Resources/unused.mp3'], undefined)
    const folder = await readCoursewareFolder(directory())
    assert.ok(resolvePronounceUrl('Resources/test.mp3', folder.resources)?.startsWith('blob:subject-'))
    assert.equal(requested.includes('../outside.mp3'), false)
    assert.equal(visited.includes('Resources/unused.mp3'), false)
    assert.equal(created.length, 2)
  } finally { URL.createObjectURL = create }
})
