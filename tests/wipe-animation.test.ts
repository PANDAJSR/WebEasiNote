import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildBlindInKeyframesCss } from '../src/components/slide-viewer/wipe-animation'

test('百叶窗遮罩条带按容器等距定位，不因百分比自由空间而偏移', () => {
  const css = buildBlindInKeyframesCss()
  const positionLists = Array.from(css.matchAll(/(?:-webkit-)?mask-position: ([^;]+);/g), match => match[1])
  const verticalPositions = positionLists[0].split(', ').map(position => Number.parseFloat(position))
  const horizontalPositions = positionLists[1].split(', ').map(position => Number.parseFloat(position))
  const freeSpacePercent = 100 - 8.4
  const toContainerOffset = (positionPercent: number) => Math.round(positionPercent * freeSpacePercent / 100 * 1000) / 1000

  assert.deepEqual(verticalPositions.map(toContainerOffset), [0, 10, 20, 30, 40, 50, 60, 70, 80, 90])
  assert.deepEqual(horizontalPositions.map(toContainerOffset), [0, 10, 20, 30, 40, 50, 60, 70, 80, 90])
})
