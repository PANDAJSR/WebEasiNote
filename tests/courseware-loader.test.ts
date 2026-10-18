import assert from 'node:assert/strict'
import { test } from 'node:test'
import JSZip from 'jszip'
import { Window } from 'happy-dom'
import { readCoursewareFile } from '../src/courseware-loader'

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
