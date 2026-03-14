import type { WipeOrientation } from './constants'
import { TRANSLATE_FADE_IN_KEYFRAME_PREFIX } from './constants'

const DEFAULT_TRANSLATE_FADE_DISTANCE_PX = 150
export const TRANSLATE_FADE_IN_OFFSET_X_VAR = '--seewo-translate-fade-in-x'
export const TRANSLATE_FADE_IN_OFFSET_Y_VAR = '--seewo-translate-fade-in-y'

interface TranslateOffset {
  x: number
  y: number
}

function resolveFallbackTranslateOffset(orientation: WipeOrientation): TranslateOffset {
  if (orientation === 'LeftToRight') return { x: -DEFAULT_TRANSLATE_FADE_DISTANCE_PX, y: 0 }
  if (orientation === 'RightToLeft') return { x: DEFAULT_TRANSLATE_FADE_DISTANCE_PX, y: 0 }
  if (orientation === 'TopToBottom') return { x: 0, y: -DEFAULT_TRANSLATE_FADE_DISTANCE_PX }
  if (orientation === 'BottomToTop') return { x: 0, y: DEFAULT_TRANSLATE_FADE_DISTANCE_PX }
  if (orientation === 'LeftTopToRightBottom') {
    return { x: -DEFAULT_TRANSLATE_FADE_DISTANCE_PX, y: -DEFAULT_TRANSLATE_FADE_DISTANCE_PX }
  }
  if (orientation === 'RightTopToLeftBottom') {
    return { x: DEFAULT_TRANSLATE_FADE_DISTANCE_PX, y: -DEFAULT_TRANSLATE_FADE_DISTANCE_PX }
  }
  if (orientation === 'LeftBottomToRightTop') {
    return { x: -DEFAULT_TRANSLATE_FADE_DISTANCE_PX, y: DEFAULT_TRANSLATE_FADE_DISTANCE_PX }
  }
  return { x: DEFAULT_TRANSLATE_FADE_DISTANCE_PX, y: DEFAULT_TRANSLATE_FADE_DISTANCE_PX }
}

function parseTranslateOffsetFromPath(path?: string): TranslateOffset | null {
  if (!path) return null
  const values = Array.from(path.matchAll(/-?\d+(?:\.\d+)?(?:E[+-]?\d+)?/gi))
    .map(match => parseFloat(match[0]))
    .filter(value => Number.isFinite(value))
  if (values.length < 4) return null

  const x0 = values[0]
  const y0 = values[1]
  const x1 = values[values.length - 2]
  const y1 = values[values.length - 1]
  const deltaX = x0 - x1
  const deltaY = y0 - y1

  if (Math.abs(deltaX) < 0.001 && Math.abs(deltaY) < 0.001) return null
  return { x: deltaX, y: deltaY }
}

export function resolveTranslateFadeInOffset(path: string | undefined, orientation: WipeOrientation): TranslateOffset {
  return parseTranslateOffsetFromPath(path) || resolveFallbackTranslateOffset(orientation)
}

export function buildTranslateFadeInKeyframeName(): string {
  return TRANSLATE_FADE_IN_KEYFRAME_PREFIX
}

export function buildTranslateFadeInKeyframesCss(): string {
  const keyframeName = buildTranslateFadeInKeyframeName()
  return `
    @keyframes ${keyframeName} {
      0% {
        opacity: 0;
        transform: translate3d(var(${TRANSLATE_FADE_IN_OFFSET_X_VAR}, 0px), var(${TRANSLATE_FADE_IN_OFFSET_Y_VAR}, 0px), 0);
      }
      100% {
        opacity: 1;
        transform: translate3d(0, 0, 0);
      }
    }
  `
}
