import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  buildPresetAnimationKeyframesCss,
  resolvePresetInitialMotion,
  resolvePresetAnimationFamily,
  resolvePresetPlayback
} from '../src/components/slide-viewer/animation-presets'
import { isAppearanceAnimation, isFlickerAnimation } from '../src/components/slide-viewer/constants'
import type { ElementAnimation } from '../src/types'
import { resolveTranslateInOffset } from '../src/components/slide-viewer/translate-animation'

function animation(type: string, category = 'Appearance', effect?: string): ElementAnimation {
  return {
    id: type,
    type,
    category,
    effect,
    trigger: 'Click',
    triggerSource: '',
    number: 1,
    start: 0,
    end: 1,
    durationMs: 500,
    delayMs: 0,
    targetId: 'element-1',
    sourceElementId: 'element-1'
  }
}

test('entrance and exit preset aliases resolve to matching generated keyframes', () => {
  const css = buildPresetAnimationKeyframesCss()
  const cases: Array<[string, string, string]> = [
    ['Fly', 'Appearance', 'entrance'],
    ['Spiral', 'Disappearance', 'exit'],
    ['Blinds', 'Appearance', 'entrance'],
    ['WipeRight', 'Appearance', 'entrance'],
    ['Bounce', 'Appearance', 'entrance']
  ]
  for (const [type, category, family] of cases) {
    const value = animation(type, category)
    const playback = resolvePresetPlayback(value)
    assert.equal(resolvePresetAnimationFamily(value), family)
    assert.ok(playback)
    assert.match(css, new RegExp(`@keyframes ${playback.name}\\s`))
  }
})

test('emphasis names stay distinct and unknown emphasis is not treated as flicker', () => {
  const pulse = animation('Pulse', 'Emphasis')
  const flicker = animation('Flicker', 'Emphasis')
  const unknown = animation('UnknownEmphasis', 'Emphasis')
  const css = buildPresetAnimationKeyframesCss()
  assert.equal(resolvePresetAnimationFamily(pulse), 'emphasis')
  assert.equal(resolvePresetAnimationFamily(flicker), 'emphasis')
  assert.equal(resolvePresetAnimationFamily(unknown), null)
  assert.equal(isFlickerAnimation('Pulse', 'Emphasis'), false)
  assert.equal(isFlickerAnimation('Flicker', 'Emphasis'), true)
  assert.equal(isAppearanceAnimation('Thin', 'Emphasis'), false)
  assert.match(css, /@keyframes seewo-preset-emphasis-pulse-default/)
})

test('the out effect selects exit keyframes for shared preset names', () => {
  const value = animation('Fly', 'Appearance', 'Out')
  const playback = resolvePresetPlayback(value)
  assert.equal(resolvePresetAnimationFamily(value), 'exit')
  assert.ok(playback)
  assert.match(buildPresetAnimationKeyframesCss(), new RegExp(`@keyframes ${playback.name}\\s`))
})

test('all reverse-engineered converter preset names have a playback keyframe', () => {
  const entranceExit = [
    'Fly', 'Blinds', 'Dissolve', 'Fade', 'RandomLine', 'Spiral', 'Wipe', 'Whirl',
    'Bounce', 'Drop', 'Flow', 'Cycle', 'Scale', 'BoxIn', 'BoxOut', 'CheckerBoardAcross',
    'CheckerBoardDown', 'Circle', 'Diamond', 'PlusIn', 'PlusOut', 'BarnInVertical',
    'BarnInHorizontal', 'BarnOutVertical', 'BarnOutHorizontal', 'RandomBarsHorizontal',
    'RandomBarsVertical', 'StripsDownLeft', 'StripsUpLeft', 'StripsDownRight',
    'StripsUpRight', 'Wedge', 'Wheel1', 'Wheel2', 'Wheel3', 'Wheel4', 'Wheel8',
    'WipeRight', 'WipeLeft', 'WipeDown', 'WipeUp', 'SlideFromTop', 'SlideFromBottom',
    'SlideFromLeft', 'SlideFromRight'
  ]
  const emphasis = [
    'FillColor', 'FontColor', 'Scale', 'LineColor', 'SpinningTop', 'Transparency',
    'BoldFlicker', 'BoldDisplay', 'StrokeColor', 'Underline', 'ObjectColor',
    'ComplementaryColor', 'ComplementaryColor2', 'Deepen', 'UnSaturation', 'Pulse',
    'ColorPulse', 'ColorExtension', 'Thin', 'TeeterBoard', 'Wave', 'Flicker', 'Flash',
    'Heartbeat', 'Bounce', 'Flip'
  ]
  const css = buildPresetAnimationKeyframesCss()
  for (const type of entranceExit) {
    const value = animation(type, 'Appearance')
    const playback = resolvePresetPlayback(value)
    assert.ok(playback, `${type} should resolve`)
    assert.match(css, new RegExp(`@keyframes ${playback.name}\\s`), `${type} should have a keyframe`)
  }
  for (const type of emphasis) {
    const playback = resolvePresetPlayback(animation(type, 'Emphasis'))
    assert.ok(playback, `${type} should resolve`)
    assert.match(css, new RegExp(`@keyframes ${playback.name}\\s`), `${type} should have a keyframe`)
  }
})

test('orientation and custom line paths set the expected starting motion', () => {
  assert.deepEqual(resolveTranslateInOffset('M1280,0L1280,0 0,0', 'LeftToRight'), { x: 1280, y: 0 })
  assert.deepEqual(resolveTranslateInOffset(undefined, 'RightToLeft'), { x: 2000, y: 0 })
  assert.equal(resolvePresetInitialMotion({ ...animation('Fly'), orientation: 'RightToLeft' }).transform, 'translate3d(100%, 0, 0)')
  assert.equal(resolvePresetInitialMotion(animation('Fade')).transform, 'none')
})
