import assert from 'node:assert/strict'
import fs from 'node:fs'
import { test } from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Window } from 'happy-dom'
import { Resvg } from '@resvg/resvg-js'
import { parsePictureElement } from '../src/enbx/pictures'
import { parsePictureEffects } from '../src/enbx/picture-effects'
import { PictureRenderer } from '../src/components/PictureRenderer'
import { PictureEffects } from '../src/components/PictureEffects'
import { PictureFrame } from '../src/components/PictureFrame'
import { pictureFrame, pictureGeometry, perspectivePictureMatrix } from '../src/rendering/picture-geometry'
import { collectUnknownParameters } from '../src/enbx/element-issues'
import type { SlideIssue } from '../src/types'
import type { PictureElement } from '../src/types'

const dom = new Window()
Object.assign(globalThis, { DOMParser: dom.DOMParser, React })
const parse = (xml: string) => parsePictureElement(new dom.DOMParser().parseFromString(xml, 'text/xml').documentElement as unknown as Element)!
function pictures(slide: number) {
  const xml = fs.readFileSync(new URL(`./fixtures/media-pictures-${slide}.xml`, import.meta.url), 'utf8')
  return [...new dom.DOMParser().parseFromString(xml, 'text/xml').querySelectorAll('Picture')]
    .map(node => parsePictureElement(node as unknown as Element)!)
}
const frames = pictures(3)
const shadows = pictures(5)
const reflections = pictures(7)
const render = (element: PictureElement, scale = 1) => renderToStaticMarkup(
  <PictureRenderer element={element} scale={scale} resourceMap={{ [element.sourceId]: 'https://example.invalid/image.png' }} />)

test('真实相框页完整读取现代嵌套字段，Empty 预设不清除手动相框', () => {
  assert.equal(frames.length, 7)
  assert.deepEqual(frames.map(p => p.pictureRahmenType), ['DotDashFrame', 'NormalFrame', 'LongDashFrame',
    'RectFrame', 'RoundRectFrame', 'EllipseFrame', 'NormalFrame'])
  assert.equal(frames[6].rahmenThickness, 27)
  assert.equal(frames[6].rahmenColor, '#FF0099')
  assert.equal(frames[4].imageRahmenWidthIndex, 1)
})

test('线框按官方虚线数组、颜色、保存线宽 + 1 描边，不占图片内侧尺寸', () => {
  assert.deepEqual(pictureFrame(frames[0]).dashes, [5, 3])
  assert.deepEqual(pictureFrame(frames[2]).dashes, [10, 2, 2, 2])
  const markup = render(frames[6])
  assert.ok(markup.includes('stroke="#FF0099"'))
  assert.ok(markup.includes('stroke-width="28"'))
  assert.equal(pictureGeometry(frames[6]).outset, 27)
  assert.ok(!markup.includes('border-box'))
  assert.ok(render(frames[0]).includes('stroke-dasharray="10 6"'))
})

test('圆角与椭圆相框同时裁剪图片和描边；普通图片无多余相框', () => {
  for (const index of [4, 5]) {
    const markup = render(frames[index])
    assert.ok(markup.includes('clip-path:url(#picture-clip-'))
    assert.ok(markup.includes('stroke="#ffffff"'))
    assert.ok(markup.includes('stroke-width="11"'))
  }
  const plain = { ...frames[1], pictureRahmenType: undefined }
  assert.ok(!render(plain).includes('data-picture-frame'))
  assert.equal(pictureGeometry(frames[5]).shape, 'ellipseframe')
})

test('弧边相框只圆左上/右下，旋转不会改变原图裁剪坐标', () => {
  const picture = pictures(1)[1]
  assert.equal(picture.pictureRahmenType, 'CurveRhombusFrame')
  const geometry = pictureGeometry(picture)
  assert.equal((geometry.clip.match(/A/g) || []).length, 2)
  const markup = render(picture)
  assert.ok(markup.includes(`rotate(${picture.rotation}deg)`))
  assert.ok(markup.includes(`width:${picture.pictureSize!.width * picture.width / picture.displayRegion!.width}px`))
})

test('矩形艺术相框使用官方九宫格而非实线加任意 box-shadow', () => {
  const markup = render(frames[3])
  assert.ok(markup.includes('border-image-slice:29 29 29 29 fill'))
  assert.ok(markup.includes('picture-frame.png'))
  assert.ok(markup.includes('inset:-28px'))
})

test('真实投影、透视矩阵、偏移、颜色、模糊完整解析', () => {
  assert.equal(shadows[1].shadow?.angle, 135)
  assert.equal(shadows[2].shadow?.angle, 225)
  assert.equal(shadows[2].shadow?.offset, 100)
  assert.deepEqual(shadows[3].perspectiveShadow?.matrix, [1, 0, 0.3, 0.3, 0, 0])
  assert.deepEqual(shadows[4].perspectiveShadow?.matrix, [1, 0, 0, -0.08, 0, 0])
  assert.equal(shadows[4].perspectiveShadow?.blurRadius, 35)
  assert.equal(shadows[4].perspectiveShadow?.offsetY, 8)
})

test('135 度投影向右下，225 度向左下，不使用 WPF DropShadowEffect 的另一套角度', () => {
  const right = renderToStaticMarkup(<PictureEffects element={shadows[1]} content={null} />)
  const left = renderToStaticMarkup(<PictureEffects element={shadows[2]} content={null} />)
  const transform = (svg: string) => svg.match(/transform="translate\(([^)]+)\)/)![1].split(' ').map(Number)
  assert.ok(transform(right).every(value => value > 0))
  assert.ok(transform(left)[0] < -70 && transform(left)[1] > 70)
})

test('透视阴影底部锚定与负缩放翻转，不是相对图片原点的直接 matrix', () => {
  const up = perspectivePictureMatrix(shadows[3])!
  const down = perspectivePictureMatrix(shadows[4])!
  assert.ok(Math.abs(up[4] + 90) < 1e-9)
  assert.ok(Math.abs(up[5] - 210) < 1e-9)
  assert.equal(down[5], 332)
  const rotated = { ...shadows[4], rotation: 90 }
  assert.ok(perspectivePictureMatrix(rotated)!.every(Number.isFinite))
})

test('阴影根据几何轮廓填充：透明图片内部也投影，模糊在矩阵之后', () => {
  const element = { ...shadows[4], width: 100, height: 100, alpha: 1,
    perspectiveShadow: { ...shadows[4].perspectiveShadow!, blurRadius: 0, opacity: 1 } }
  const svg = renderToStaticMarkup(<PictureEffects element={element} content={null} />)
  const image = new Resvg(svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ')
    .replace('height="100"', 'height="140"')).render()
  const at = (x: number, y: number) => [...image.pixels.subarray((y * image.width + x) * 4, (y * image.width + x) * 4 + 4)]
  assert.deepEqual(at(50, 111), [0, 0, 0, 255])
  assert.deepEqual(at(50, 105), [0, 0, 0, 0])
})

test('六种真实倒影保留 0/4 间距、三种渐变长度，蒙版随倒影翻转', () => {
  assert.equal(reflections.length, 6)
  assert.deepEqual(reflections.map(p => p.reflection?.offsetY), [0, 0, 0, 4, 4, 4])
  assert.deepEqual(reflections.map(p => p.reflection?.stops[0].offset), [0.8, 0.5, 0.3, 0.8, 0.5, 0.3])
  const svg = render(reflections[3])
  assert.ok(svg.includes('translate(0 304) scale(1 -1)'))
  assert.ok(svg.includes('offset="0.8" stop-color="#ffffff" stop-opacity="0"'))
  assert.ok(svg.includes('opacity="0.35"'))
})

test('组合样式：透明度、椭圆相框、透视阴影共存，不从过时 ReflectionTypeName 合成倒影', () => {
  const picture = pictures(9)[0]
  assert.equal(picture.alpha, 0.62)
  assert.equal(picture.pictureRahmenType, 'EllipseFrame')
  assert.ok(picture.perspectiveShadow)
  assert.equal(picture.reflection, undefined)
  const svg = render(picture, 0.5)
  assert.ok(svg.includes('scale(0.5)'))
  const opacities = [...svg.matchAll(/opacity="([\d.]+)"/g)].map(match => Number(match[1]))
  assert.ok(opacities.some(value => Math.abs(value - 0.2232) < 1e-9))
  assert.ok(!svg.includes('data-picture-reflection'))
})

test('无效数据有界回退，零线宽不擅自补默认粗边，旧平铺字段继续兼容', () => {
  const picture = parse(`<Picture><Style><PicturePresetStyle>Empty</PicturePresetStyle><PictureRahmenStyle>
    <RahmenStyle>NormalFrame</RahmenStyle><LineRahmenThickness>NaN</LineRahmenThickness>
    </PictureRahmenStyle><Effects><PerspectiveShadow><ShadowMatrix>1,0,no,1,0,0</ShadowMatrix></PerspectiveShadow>
    <Reflection><Opacity>10</Opacity></Reflection></Effects></Style></Picture>`)
  assert.equal(picture.rahmenThickness, 0)
  assert.equal(picture.perspectiveShadow, undefined)
  assert.equal(picture.reflection?.opacity, 1)
  assert.equal(renderToStaticMarkup(<PictureFrame element={picture} />), '')
  const legacy = parse('<Picture><RahmenType>NormalFrame</RahmenType><RahmenThickness>3</RahmenThickness></Picture>')
  assert.equal(legacy.pictureRahmenType, 'NormalFrame')
  assert.equal(legacy.rahmenThickness, 3)
  const doc = new dom.DOMParser().parseFromString('<Picture><Group><Style><Effects><Reflection/></Effects></Style></Group></Picture>', 'text/xml')
  assert.deepEqual(parsePictureEffects(doc.documentElement as unknown as Element), {})
})

test('支持的现代样式不再误报，未知相框和特效继续报告', () => {
  const parseIssues = (xml: string) => {
    const node = new dom.DOMParser().parseFromString(xml, 'text/xml').documentElement
    const issues: SlideIssue[] = []
    collectUnknownParameters(node as unknown as Element, 'Picture', 'slide', 'picture', issues)
    return issues
  }
  assert.equal(parseIssues('<Picture><Style><PictureRahmenStyle><RahmenStyle>EllipseFrame</RahmenStyle></PictureRahmenStyle><Effects><Reflection/></Effects></Style><ElementEffects/></Picture>').length, 0)
  const issues = parseIssues('<Picture><Style><PictureRahmenStyle><RahmenStyle>FutureFrame</RahmenStyle></PictureRahmenStyle><Effects><FutureEffect/></Effects></Style></Picture>')
  assert.deepEqual(issues.map(issue => issue.name), ['Style/PictureRahmenStyle/RahmenStyle', 'Style/Effects/FutureEffect'])
})
