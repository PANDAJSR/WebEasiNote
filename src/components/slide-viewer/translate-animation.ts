import type { WipeOrientation } from './constants'
import { TRANSLATE_IN_KEYFRAME_PREFIX } from './constants'

export const TRANSLATE_IN_OFFSET_X_VAR = '--seewo-translate-in-x'
export const TRANSLATE_IN_OFFSET_Y_VAR = '--seewo-translate-in-y'

export interface TranslateInOffset {
  x: number
  y: number
}

function parseTranslateInOffset(path?: string): TranslateInOffset | null {
  if (!path) return null
  const values = Array.from(path.matchAll(/-?\d+(?:\.\d+)?(?:E[+-]?\d+)?/gi), match => Number.parseFloat(match[0]))
  if (values.length < 4) return null
  const offset = { x: values[0] - values[values.length - 2], y: values[1] - values[values.length - 1] }
  return Math.abs(offset.x) + Math.abs(offset.y) > 0.001 ? offset : null
}

export function resolveTranslateInOffset(path: string | undefined, orientation: WipeOrientation): TranslateInOffset | null {
  const pathOffset = parseTranslateInOffset(path)
  if (pathOffset) return pathOffset
  if (orientation === 'LeftToRight') return { x: -2000, y: 0 }
  if (orientation === 'RightToLeft') return { x: 2000, y: 0 }
  if (orientation === 'TopToBottom') return { x: 0, y: -2000 }
  if (orientation === 'BottomToTop') return { x: 0, y: 2000 }
  if (orientation === 'LeftTopToRightBottom') return { x: -2000, y: -2000 }
  if (orientation === 'RightTopToLeftBottom') return { x: 2000, y: -2000 }
  if (orientation === 'LeftBottomToRightTop') return { x: -2000, y: 2000 }
  return { x: 2000, y: 2000 }
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
    return `
      @keyframes ${keyframeName} {
        0% { transform: translate3d(var(${TRANSLATE_IN_OFFSET_X_VAR}, 0px), var(${TRANSLATE_IN_OFFSET_Y_VAR}, 0px), 0); }
        100% { transform: translate3d(0, 0, 0); }
      }
    `
  }).join('\n')
}
