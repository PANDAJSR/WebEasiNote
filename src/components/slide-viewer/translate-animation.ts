import type { WipeOrientation } from './constants'
import { TRANSLATE_IN_KEYFRAME_PREFIX } from './constants'

function resolveTranslateInStartTransform(orientation: WipeOrientation): string {
  if (orientation === 'LeftToRight') return 'translate3d(-200vw, 0, 0)'
  if (orientation === 'RightToLeft') return 'translate3d(200vw, 0, 0)'
  if (orientation === 'TopToBottom') return 'translate3d(0, -200vh, 0)'
  if (orientation === 'BottomToTop') return 'translate3d(0, 200vh, 0)'
  if (orientation === 'LeftTopToRightBottom') return 'translate3d(-200vw, -200vh, 0)'
  if (orientation === 'RightTopToLeftBottom') return 'translate3d(200vw, -200vh, 0)'
  if (orientation === 'LeftBottomToRightTop') return 'translate3d(-200vw, 200vh, 0)'
  return 'translate3d(200vw, 200vh, 0)'
}

export function buildTranslateInKeyframeName(orientation: WipeOrientation): string {
  return `${TRANSLATE_IN_KEYFRAME_PREFIX}-${orientation}`
}

export function buildTranslateInKeyframesCss(): string {
  const orientations: WipeOrientation[] = [
    'LeftToRight',
    'RightToLeft',
    'TopToBottom',
    'BottomToTop',
    'LeftTopToRightBottom',
    'RightTopToLeftBottom',
    'LeftBottomToRightTop',
    'RightBottomToLeftTop'
  ]
  return orientations.map(orientation => {
    const keyframeName = buildTranslateInKeyframeName(orientation)
    const startTransform = resolveTranslateInStartTransform(orientation)
    return `
      @keyframes ${keyframeName} {
        0% { transform: ${startTransform}; }
        100% { transform: translate3d(0, 0, 0); }
      }
    `
  }).join('\n')
}
