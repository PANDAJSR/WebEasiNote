import assert from 'node:assert/strict'
import { test } from 'node:test'
import { matchingDropTarget } from '../src/viewer/activities/matching-drop'

const rect = (left: number, top: number, width: number, height: number) => ({ left, top, width, height,
  right: left + width, bottom: top + height })
test('填空按素材重叠吸附，指针在空位外也可落入；相邻目标选择重叠更多的空位', () => {
  const targets = [{ id: 'one', rect: rect(100, 50, 80, 40) }, { id: 'two', rect: rect(190, 50, 80, 40) }]
  assert.equal(matchingDropTarget(targets, rect(90, 45, 80, 40), { x: 92, y: 47 }), 'one')
  assert.equal(matchingDropTarget(targets, rect(170, 50, 80, 40), { x: 175, y: 55 }), 'two')
  assert.equal(matchingDropTarget(targets, rect(300, 200, 80, 40), { x: 305, y: 205 }), null)
  assert.equal(matchingDropTarget(targets, rect(25, 50, 80, 40), { x: 30, y: 55 }), null)
})
