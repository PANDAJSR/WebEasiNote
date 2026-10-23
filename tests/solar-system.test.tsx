import assert from 'node:assert/strict'
import { test } from 'node:test'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { Window } from 'happy-dom'
import { createCanvas } from '@napi-rs/canvas'
import { paintGlobe, sampleGlobeTexture } from '../src/components/subject-cards/globe-projection'
import { solarCamera, solarMapMatrix } from '../src/components/subject-cards/solar-camera'
import { SolarSystemRenderer } from '../src/components/subject-cards/SolarSystemRenderer'
import { parseSolarSystem } from '../src/enbx/science-scenes'

const dom = new Window()
Object.assign(globalThis, { window: dom, document: dom.document, React,
  Image: dom.Image, IS_REACT_ACT_ENVIRONMENT: true })
const parse = (body: string) => parseSolarSystem(new dom.DOMParser().parseFromString(`<SolarSystem><Width>800</Width><Height>400</Height><PlanetSystemType>Earth</PlanetSystemType>${body}</SolarSystem>`, 'text/xml').documentElement as unknown as Element)

test('地球完整视口保留相机偏移，近距离放大可裁切球面，宽高比不挤压球体', () => {
  const texture = { width: 2, height: 1, data: new Uint8ClampedArray([100, 120, 140, 255, 100, 120, 140, 255]) } as ImageData
  const canvas = createCanvas(200, 100)
  const draw = (camera: number[], look: number[]) => {
    paintGlobe(canvas as unknown as HTMLCanvasElement, texture, camera, [0, 0, 1], look, true)
    return canvas.getContext('2d').getImageData(0, 0, 200, 100).data
  }
  const centered = draw([0, -9, 0], [0, 9, 0])
  const alpha = (data: Uint8ClampedArray, x: number, y: number) => data[(y * 200 + x) * 4 + 3]
  assert.equal(alpha(centered, 100, 50), 255)
  assert.equal(alpha(centered, 100, 20), 0)
  const horizontal = [...Array(200).keys()].filter(x => alpha(centered, x, 50)).length
  const vertical = [...Array(100).keys()].filter(y => alpha(centered, 100, y)).length
  assert.ok(Math.abs(horizontal - vertical) <= 2)
  const offset = draw([0, -9, 0], [2, 9, 0])
  assert.equal(alpha(offset, 100, 50), 0)
  assert.ok(offset.some((n, i) => i % 4 === 3 && n > 0))
  const close = draw([0, -1.2, 0], [0, 1.2, 0])
  assert.equal(alpha(close, 0, 50), 255)
})

test('纹理双线性采样在经度接缝连续，纬度边缘不跨极点', () => {
  const texture = { width: 2, height: 1, data: new Uint8ClampedArray([0, 0, 0, 255, 200, 100, 50, 255]) } as ImageData
  assert.deepEqual(sampleGlobeTexture(texture, 0, .5), [100, 50, 25, 255])
  assert.deepEqual(sampleGlobeTexture(texture, 1, .5), [100, 50, 25, 255])
  assert.deepEqual(sampleGlobeTexture(texture, .25, 0), [0, 0, 0, 255])
})

test('旋转与缩放保留保存的观察方向及相机倾斜，不发生视角跳变', () => {
  const position = [1, -9, 2]
  const look = [1, 8, -1]
  const up = [.1, .2, 1]
  const original = solarCamera(position, look, up, [0, 0], 1)
  assert.deepEqual(original, { camera: position, look, up })
  const zoomed = solarCamera(position, look, up, [0, 0], 2)
  assert.deepEqual(zoomed.camera, position.map(n => n / 2))
  assert.deepEqual(zoomed.look, look)
  const rotated = solarCamera(position, look, up, [.4, .2], 1)
  assert.ok(Math.abs(Math.hypot(...rotated.camera) - Math.hypot(...position)) < 1e-10)
  assert.ok(rotated.up.every(Number.isFinite))
  const matrix = solarMapMatrix([2, .1, .2, 2, 30, 40], 1.5, [10, -5])
  const expected = [3, .15, .3, 3, 55, 55]
  expected.forEach((n, i) => assert.ok(Math.abs(matrix[i] - n) < 1e-10))
})

test('二维地球恢复矩阵、使用独立平面纹理、支持缩放复位及更换课件', async () => {
  const element = parse(`<PlanetView>TwoD</PlanetView><Texture2DMatrix>2,0,0,2,30,40</Texture2DMatrix>
    <Textures><SolarSystemTexture><Key>Satellite</Key><Brush><ImageBrush><Source>id://sphere</Source></ImageBrush></Brush></SolarSystemTexture>
    <SolarSystemTexture><Key>Temperature</Key><Brush><ImageBrush><Source>id://temp</Source></ImageBrush></Brush></SolarSystemTexture></Textures>
    <Maps><SolarSystemResource><Key>Satellite</Key><Uri>id://flat</Uri></SolarSystemResource></Maps>`)
  const container = document.createElement('div')
  const root = createRoot(container)
  const render = (value = element, active = true) => act(async () => root.render(<SolarSystemRenderer element={value} scale={1} active={active} resourceMap={{ sphere: 'blob:sphere', flat: 'blob:flat', temp: 'blob:temp' }} />))
  const click = (label: string) => act(async () => (container.querySelector(`[aria-label="${label}"]`) as unknown as HTMLButtonElement).click())
  try {
    await render()
    const image = () => container.querySelector('img') as HTMLImageElement
    assert.equal(image().getAttribute('src'), 'blob:flat')
    assert.equal(image().style.transform, 'matrix(2,0,0,2,30,40)')
    const surface = container.querySelector('[aria-label="拖动平移地图"]') as unknown as HTMLElement
    surface.setPointerCapture = () => {}
    await act(async () => {
      surface.dispatchEvent(new dom.PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: 10, clientY: 20 }) as unknown as Event)
      surface.dispatchEvent(new dom.PointerEvent('pointermove', { bubbles: true, clientX: 30, clientY: 50 }) as unknown as Event)
    })
    assert.equal(image().style.transform, 'matrix(2,0,0,2,50,70)')
    await act(async () => surface.dispatchEvent(new dom.PointerEvent('pointercancel', { bubbles: true }) as unknown as Event))
    await click('复位地球仪')
    await click('放大地球')
    assert.equal(image().style.transform, 'matrix(2.4,0,0,2.4,36,48)')
    await click('选择地球地图')
    const temperature = [...container.querySelectorAll('button')].find(node => node.textContent === '气温')!
    await act(async () => temperature.click())
    assert.equal(image().getAttribute('src'), 'blob:temp')
    await click('复位地球仪')
    assert.equal(image().style.transform, 'matrix(2,0,0,2,30,40)')
    await render(parse('<PlanetView>TwoD</PlanetView>'))
    assert.equal(image().style.transform, 'matrix(1,0,0,1,0,0)')
    await render(element, false)
    assert.ok((container.querySelector('[aria-label="放大地球"]') as unknown as HTMLButtonElement).disabled)
    const disabledSurface = container.querySelector('[aria-label="拖动平移地图"]')!
    await act(async () => disabledSurface.dispatchEvent(new dom.WheelEvent('wheel', { bubbles: true, deltaY: -100 }) as unknown as Event))
    assert.equal(image().style.transform, 'matrix(2,0,0,2,30,40)')
  } finally { await act(async () => root.unmount()) }
})
