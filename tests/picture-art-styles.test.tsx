import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createHash } from 'node:crypto'
import { test } from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Resvg } from '@resvg/resvg-js'
import { Window } from 'happy-dom'
import { parsePictureElement } from '../src/enbx/pictures'
import { isKnownPictureFrameType, normalizePictureFrameType, PICTURE_FRAME_TYPES } from '../src/enbx/picture-frame-types'
import { collectUnknownParameters } from '../src/enbx/element-issues'
import { pictureArtFrame } from '../src/rendering/picture-art-frames'
import { pictureFrame, pictureGeometry, rotatedPictureBounds } from '../src/rendering/picture-geometry'
import { pictureStampTiles } from '../src/rendering/picture-stamp'
import { PictureRenderer } from '../src/components/PictureRenderer'
import { PictureGlow } from '../src/components/PictureGlow'
import type { PictureElement, SlideIssue } from '../src/types'

const dom = new Window()
Object.assign(globalThis, { React, DOMParser: dom.DOMParser })
const parse = (xml: string) => parsePictureElement(new dom.DOMParser().parseFromString(xml, 'text/xml').documentElement as unknown as Element)!
const base: PictureElement = { type: 'picture', id: 'art', x: 0, y: 0, width: 240, height: 180,
  sourceId: 'photo', pictureName: 'photo.png', alpha: 1, rotation: 0, imageRahmenWidthIndex: 1 }
const render = (element: PictureElement) => renderToStaticMarkup(<PictureRenderer element={element} scale={0.5} resourceMap={{}} />)
const artTypes = ['RectOverlapFrame', 'StampPhotoFrame', 'FlowerPhotoFrame', 'ArrowPhotoFrame',
  'CrossPhotoFrame', 'FrameInnerShadowAround', 'FrameShadowBottom']

test('统一相框枚举保留 -1/0、1..11 与 100..102 的不连续编号', () => {
  for (const [value, name] of [[-1, 'empty'], ...PICTURE_FRAME_TYPES.map((name, i) =>
    [i < 12 ? i : i + 88, name.toLowerCase()])] as [number, string][]) {
    assert.equal(normalizePictureFrameType(value), name)
    assert.equal(isKnownPictureFrameType(String(value)), true)
  }
  assert.equal(isKnownPictureFrameType('12'), false)
  assert.equal(isKnownPictureFrameType('FutureFrame'), false)
})

test('剩余七种艺术相框三档均渲染，数字枚举与命名类型一致且无未知诊断', () => {
  for (const type of artTypes) for (const index of [1, 2, 3]) {
    const xml = `<Picture><Width>240</Width><Height>180</Height><Style><PictureRahmenStyle>
      <RahmenStyle>${type}</RahmenStyle><ImageRahmenWidthIndex>${index}</ImageRahmenWidthIndex>
      </PictureRahmenStyle></Style></Picture>`
    const picture = parse(xml)
    assert.match(render(picture), new RegExp(`data-picture-frame="${type.toLowerCase()}"`))
    const numeric = PICTURE_FRAME_TYPES.indexOf(type as typeof PICTURE_FRAME_TYPES[number])
    const node = new dom.DOMParser().parseFromString(xml.replace(type, String(numeric)), 'text/xml').documentElement
    const issues: SlideIssue[] = []
    collectUnknownParameters(node as unknown as Element, 'Picture', 'slide', 'picture', issues)
    assert.deepEqual(issues, [])
    assert.equal(pictureFrame({ ...picture, pictureRahmenType: numeric }).type, type.toLowerCase())
  }
})

test('非对称底影与内影九宫格保留逐档源切片、显示边距及白边', () => {
  const bottom = [1, 2, 3].map(i => pictureArtFrame('frameshadowbottom', i)!)
  assert.deepEqual(bottom.map(s => s.slice), [[30, 61, 58, 61], [36, 61, 58, 61], [58, 80, 58, 80]])
  assert.deepEqual(bottom.map(s => s.margin), [22, 32, 42])
  assert.deepEqual(bottom.map(s => s.white), [4, 8, 8])
  assert.deepEqual([1, 2, 3].map(i => pictureArtFrame('frameinnershadowaround', i)!.slice[0]), [39, 49, 64])
  const html = render({ ...base, pictureRahmenType: 'FrameShadowBottom' })
  assert.match(html, /border-image-slice:30 61 58 61 fill/)
  assert.match(html, /border-width:30px 61px 58px 61px/)
  assert.ok(html.indexOf('data-picture-white-border') < html.indexOf('data-picture-nine-patch'))
})

test('花朵、箭头、交叉框使用原始资源而非任意粉色双线，索引零不画框', () => {
  for (const [type, margins, slices] of [
    ['FlowerPhotoFrame', [26, 36, 40], [61, 61, 61]],
    ['ArrowPhotoFrame', [26, 36, 40], [89, 89, 89]],
    ['CrossPhotoFrame', [42, 50, 65], [51, 61, 74]]
  ] as const) {
    assert.deepEqual([1, 2, 3].map(i => pictureArtFrame(type.toLowerCase(), i)!.margin), margins)
    assert.deepEqual([1, 2, 3].map(i => pictureArtFrame(type.toLowerCase(), i)!.slice[0]), slices)
    assert.doesNotMatch(render({ ...base, pictureRahmenType: type, imageRahmenWidthIndex: 0 }), /data-picture-frame/)
  }
})

test('重叠相框叠画原图及裁剪后副本，副本只额外旋转 -6 度，不改变主图尺寸', () => {
  const picture = { ...base, pictureRahmenType: 'RectOverlapFrame', rotation: 30,
    pictureSize: { width: 480, height: 360 }, displayRegion: { x: 20, y: 30, width: 120, height: 90 } }
  const html = render(picture)
  assert.equal((html.match(/data-picture-image=/g) || []).length, 2)
  assert.equal((html.match(/data-picture-nine-patch=/g) || []).length, 2)
  assert.match(html, /rotate\(-6deg\)/)
  assert.match(html, /rotate\(30deg\)/)
  const geometry = pictureGeometry(picture)
  assert.equal(geometry.rigidPoints.length, 8)
  assert.ok(geometry.visualBounds.width > 296 && geometry.visualBounds.height > 236)
  assert.ok(rotatedPictureBounds(picture, 10).width > 260)
})

test('平铺邮票保留 24 像素周期、斜切拼接及不足整片的末段，不产生与尺寸成正比的 DOM', () => {
  for (const side of ['top', 'bottom', 'left', 'right'] as const) {
    const tiles = pictureStampTiles(side, 301, 229)
    assert.equal(tiles.length, 4)
    assert.equal(tiles[1].repeat, true)
    const dimension = side === 'top' || side === 'bottom' ? 'width' : 'height'
    const axis = dimension === 'width' ? 'x' : 'y'
    assert.equal(tiles[3][dimension], 13)
    assert.equal(tiles[1][dimension] % 24, 0)
    assert.equal(tiles[2][axis], tiles[1][axis] + tiles[1][dimension])
    assert.equal(tiles[3][axis], tiles[2][axis] + 24)
    assert.equal(tiles[3][axis] + tiles[3][dimension], (dimension === 'width' ? 301 : 229) + 24)
    assert.equal(pictureStampTiles(side, 95, 500).length, 0)
    assert.equal(pictureStampTiles(side, 100000, 100000).length, 4)
  }
  const html = render({ ...base, pictureRahmenType: 'StampPhotoFrame' })
  assert.equal((html.match(/<pattern /g) || []).length, 4)
  assert.match(html, /patternUnits="userSpaceOnUse" width="24" height="24"/)
  assert.match(html, /stampphotoframe0610top.png/)
})

test('艺术框阴影剔除 PNG 自带柔影，倒影保留装饰而不以装饰软边作锚点', () => {
  const flower = pictureGeometry({ ...base, pictureRahmenType: 'FlowerPhotoFrame' })
  assert.equal(flower.outset, 17)
  assert.equal(flower.visualBounds.x, -26)
  assert.equal(flower.shadowBounds.x, -10.4)
  const cross = pictureGeometry({ ...base, pictureRahmenType: 'CrossPhotoFrame', imageRahmenWidthIndex: 2 })
  assert.deepEqual(cross.shadowBounds, { x: -18, y: -20, width: 276, height: 218 })
  const html = render({ ...base, pictureRahmenType: 'FlowerPhotoFrame', reflection: {
    offsetY: 4, opacity: 0.35, startPoint: [0, 0], endPoint: [0, 1],
    stops: [{ offset: 0, opacity: 0 }, { offset: 1, opacity: 1 }], maskOpacity: 1 } })
  assert.match(html, /translate\(0 398\) scale\(1 -1\)/)
  assert.match(html, /<foreignObject x="-30" y="-30" width="300" height="240"/)
})

test('Glow 保存契约读取 Color/Opacity/BlurRadius，与阴影、倒影独立共存且不误报', () => {
  const xml = `<Picture><Alpha>0.6</Alpha><Style><Effects><Glow><Color>#80FF3300</Color>
    <Opacity>0.7</Opacity><BlurRadius>12</BlurRadius></Glow><DropShadow/><Reflection/></Effects></Style></Picture>`
  const picture = parse(xml)
  assert.deepEqual(picture.glow, { color: 'rgba(255, 51, 0, 0.50)', opacity: 0.7, blurRadius: 12 })
  assert.ok(picture.shadow && picture.reflection)
  const issues: SlideIssue[] = []
  collectUnknownParameters(new dom.DOMParser().parseFromString(xml, 'text/xml').documentElement as unknown as Element,
    'Picture', 'slide', 'picture', issues)
  assert.deepEqual(issues, [])
  const invalid = parse('<Picture><Style><Effects><Glow><Opacity>5</Opacity><BlurRadius>-2</BlurRadius></Glow></Effects></Style></Picture>')
  assert.equal(invalid.glow?.opacity, 1)
  assert.equal(invalid.glow?.blurRadius, 0)
})

test('发光使用 SourceAlpha 并合回原图，官方半径双倍及 255 上限；透明孔不变成几何填充', () => {
  const element = { ...base, glow: { color: '#FF0000', opacity: 0.5, blurRadius: 4 } }
  const html = renderToStaticMarkup(<PictureGlow element={element}><span /></PictureGlow>)
  assert.match(html, /in="SourceAlpha" stdDeviation="4"/)
  assert.match(html, /flood-color="#FF0000" flood-opacity="0.5"/)
  assert.match(html, /<feMergeNode in="SourceGraphic"/)
  assert.match(render({ ...element, glow: { ...element.glow, blurRadius: 1000 } }), /stdDeviation="127.5"/)
  const small = render({ ...element, width: 8, height: 6, glow: { ...element.glow, blurRadius: 40 } })
  assert.match(small, /filterUnits="userSpaceOnUse" x="-120" y="-120" width="248" height="246"/)
  const id = html.match(/<filter id="([^"]+)"/)![1]
  const defs = html.match(/<defs>[\s\S]*?<\/defs>/)![0]
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">${defs}
    <path d="M20,20h60v60h-60Z M30,30v40h40v-40Z" fill="#0000ff" fill-rule="nonzero" filter="url(#${id})"/></svg>`
  const image = new Resvg(svg).render()
  const at = (x: number, y: number) => [...image.pixels.subarray((y * image.width + x) * 4, (y * image.width + x) * 4 + 4)]
  assert.deepEqual(at(50, 50), [0, 0, 0, 0])
  // Resvg 的 pixels 返回预乘 alpha RGBA：纯红发光应当 R=A，而不是 R=255。
  assert.ok(at(18, 50)[3] > 0)
  assert.equal(at(18, 50)[0], at(18, 50)[3])
  assert.deepEqual(at(18, 50).slice(1, 3), [0, 0])
  assert.equal(at(21, 50)[2], 255)
})

test('发光倒影扩展捕获范围但不移动实框反射轴，零透明度不生成滤镜', () => {
  const element = { ...base, glow: { color: '#ff3300', opacity: 0.8, blurRadius: 12 }, reflection: {
    offsetY: 4, opacity: 0.35, startPoint: [0, 0] as [number, number], endPoint: [0, 1] as [number, number],
    stops: [{ offset: 0, opacity: 0 }, { offset: 1, opacity: 1 }], maskOpacity: 1 } }
  const html = render(element)
  assert.match(html, /translate\(0 364\) scale\(1 -1\)/)
  assert.match(html, /<foreignObject x="-40" y="-40" width="320" height="260"/)
  assert.doesNotMatch(render({ ...element, reflection: undefined, glow: { ...element.glow, opacity: 0 } }), /data-picture-glow/)
})

test('新嵌入的 19 张相框资源与导出清单逐字节匹配，九宫格源切片不越界', () => {
  const manifest = JSON.parse(fs.readFileSync(new URL('../src/rendering/assets/picture-frames/manifest.json', import.meta.url), 'utf8'))
  assert.equal(manifest.files.length, 19)
  for (const file of manifest.files) {
    const bytes = fs.readFileSync(new URL(`../src/rendering/assets/picture-frames/${file.name}`, import.meta.url))
    assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256)
    assert.deepEqual([bytes.readUInt32BE(16), bytes.readUInt32BE(20)], [file.width, file.height])
  }
  for (const type of artTypes.filter(type => type !== 'StampPhotoFrame')) for (const index of [1, 2, 3]) {
    const spec = pictureArtFrame(type.toLowerCase(), index)!
    const bytes = fs.readFileSync(new URL(spec.url))
    assert.ok(spec.slice[1] + spec.slice[3] < bytes.readUInt32BE(16))
    assert.ok(spec.slice[0] + spec.slice[2] < bytes.readUInt32BE(20))
  }
})
