import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import JSZip from 'jszip'
import { Window } from 'happy-dom'
import { createCanvas, loadImage, Path2D } from '@napi-rs/canvas'
import { Resvg } from '@resvg/resvg-js'
import { parseSlideXML } from '../src/enbx/parser'
import { getStaticPlan, isStaticRun } from '../src/rendering/staticPlan'
import { fingerprintRun } from '../src/rendering/rasterCache'

// 本地诊断：不提交课件内容，报告只记录计数、耗时和指纹。
const filePath = process.argv[2]
const output = process.argv[3]
if (!filePath || !output) throw new Error('用法：pnpm analyze:performance <课件路径> <报告目录>')
const dom = new Window()
Object.assign(globalThis, { DOMParser: dom.DOMParser, XMLSerializer: dom.XMLSerializer, Path2D })
let result: any
class Canvas {
  canvas: ReturnType<typeof createCanvas>
  constructor(width: number, height: number) { this.canvas = createCanvas(width, height) }
  getContext() { return this.canvas.getContext('2d') }
  transferToImageBitmap() { return this.canvas }
}
Object.assign(globalThis, { OffscreenCanvas: Canvas, postMessage: (value: any) => { result = value } })
await import('../src/rendering/raster.worker')
await mkdir(output, { recursive: true })
const started = performance.now()
const zip = await JSZip.loadAsync(await readFile(filePath))
const pages = Object.keys(zip.files).filter(name => /^Slides\/Slide_\d+\.xml$/.test(name))
  .sort((a, b) => Number(a.match(/_(\d+)/)![1]) - Number(b.match(/_(\d+)/)![1]))
const report: any[] = process.argv.includes('--resume')
  ? JSON.parse(await readFile(path.join(output, 'report.json'), 'utf8')).pages : []
for (const [index, file] of pages.entries()) {
  if (report.some(row => row.page === index + 1)) continue
  const parseStart = performance.now()
  const page = parseSlideXML(await zip.file(file)!.async('text'))
  const parseMs = performance.now() - parseStart
  const planStart = performance.now()
  const plan = getStaticPlan(page)
  const runs = plan.filter(isStaticRun)
  const planMs = performance.now() - planStart
  const fingerprints = await Promise.all(runs.map(fingerprintRun))
  const cachedLeaves = runs.reduce((sum, run) => sum + run.elements.length, 0)
  let pixelComparison: any
  if (index === 17 && runs.length) {
    const run = runs[0]
    const renderStart = performance.now()
    const onMessage = (globalThis as any).onmessage
    onMessage({ data: { id: 1, width: page.width, height: page.height, ratio: 1, drawings: run.drawings } })
    if (result.error) throw new Error(result.error)
    const rasterMs = performance.now() - renderStart
    const svgParts = run.drawings.map(drawing => {
      const { geometry: g, width: w, height: h } = drawing
      const content = drawing.paths.map(p => `<path d="${p.path}" fill="${drawing.fill}" fill-rule="${p.fillRule}"/>`).join('')
      return `<g transform="translate(${drawing.x + w / 2} ${drawing.y + h / 2}) rotate(${drawing.rotation}) scale(${drawing.flipX ? -1 : 1} ${drawing.flipY ? -1 : 1}) translate(${-w / 2} ${-h / 2})"><svg width="${w}" height="${h}" overflow="hidden"><g transform="translate(${g.pathTranslateX} ${g.pathTranslateY}) scale(${g.pathScaleX} ${g.pathScaleY})">${content}</g></svg></g>`
    })
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${page.width}" height="${page.height}">${svgParts.join('')}</svg>`
    const expected = new Resvg(svg).render()
    const actual = result.bitmap.getContext('2d').getImageData(0, 0, page.width, page.height).data
    // resvg 的原始 pixels 为预乘 alpha；统一经过 PNG 解码得到直通 RGBA。
    const referenceCanvas = createCanvas(page.width, page.height)
    const referenceContext = referenceCanvas.getContext('2d')
    referenceContext.drawImage(await loadImage(expected.asPng()), 0, 0)
    const pixels = referenceContext.getImageData(0, 0, page.width, page.height).data
    let difference = 0
    let changed = 0
    let compositeDifference = 0
    for (let i = 0; i < pixels.length; i++) {
      const delta = Math.abs(actual[i] - pixels[i])
      difference += delta
      if (delta > 16) changed++
      if (i % 4 !== 3) {
        const alpha = i - i % 4 + 3
        compositeDifference += Math.abs(actual[i] * actual[alpha] / 255 + 255 - actual[alpha]
          - (pixels[i] * pixels[alpha] / 255 + 255 - pixels[alpha]))
      }
    }
    pixelComparison = { rasterMs, meanChannelDifference: difference / pixels.length, channelsOver16: changed / pixels.length,
      meanCompositeDifference: compositeDifference / (pixels.length * 3 / 4) }
    await writeFile(path.join(output, 'page18-static-canvas.png'), result.bitmap.toBuffer('image/png'))
    await writeFile(path.join(output, 'page18-static-svg.png'), expected.asPng())
    // 透明边缘的 RGB 本身没有显示意义，按白底合成后的通道差判定。
  }
  const row = { page: index + 1, elements: page.elements.length, cachedLeaves, staticRuns: runs.length,
    warmRenderItems: plan.length, thumbnail: !!zip.file(file.replace('Slides/', 'SlideThumbnails/').replace('.xml', '.png')),
    parseMs, planMs, fingerprints, pixelComparison }
  report.push(row)
  await writeFile(path.join(output, 'report.json'), JSON.stringify({ lastRunMs: performance.now() - started, resumed: process.argv.includes('--resume'), pages: report }, null, 2))
  if (pixelComparison?.meanCompositeDifference >= 1) throw new Error('第 18 页静态段像素差超限')
  console.log(JSON.stringify(row))
}
await writeFile(path.join(output, 'report.json'), JSON.stringify({ lastRunMs: performance.now() - started, resumed: process.argv.includes('--resume'), pages: report }, null, 2))
