import type { WipeOrientation } from './constants'
import { WIPE_IN_KEYFRAME_PREFIX } from './constants'

function resolveWipeStartClipPath(orientation: WipeOrientation): string {
  if (orientation === 'LeftToRight') return 'inset(0 100% 0 0)'
  if (orientation === 'RightToLeft') return 'inset(0 0 0 100%)'
  if (orientation === 'TopToBottom') return 'inset(0 0 100% 0)'
  if (orientation === 'BottomToTop') return 'inset(100% 0 0 0)'
  if (orientation === 'LeftTopToRightBottom') return 'polygon(0% 0%, 0% 0%, 0% 0%, 0% 0%)'
  if (orientation === 'RightTopToLeftBottom') return 'polygon(100% 0%, 100% 0%, 100% 0%, 100% 0%)'
  if (orientation === 'LeftBottomToRightTop') return 'polygon(0% 100%, 0% 100%, 0% 100%, 0% 100%)'
  return 'polygon(100% 100%, 100% 100%, 100% 100%, 100% 100%)'
}

function resolveWipeEndClipPath(orientation: WipeOrientation): string {
  if (
    orientation === 'LeftToRight'
    || orientation === 'RightToLeft'
    || orientation === 'TopToBottom'
    || orientation === 'BottomToTop'
  ) {
    return 'inset(0 0 0 0)'
  }
  return 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)'
}

export function buildWipeInKeyframeName(orientation: WipeOrientation): string {
  return `${WIPE_IN_KEYFRAME_PREFIX}-${orientation}`
}

export function buildWipeInKeyframesCss(): string {
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
    const keyframeName = buildWipeInKeyframeName(orientation)
    const startClipPath = resolveWipeStartClipPath(orientation)
    const endClipPath = resolveWipeEndClipPath(orientation)
    return `
      @keyframes ${keyframeName} {
        0% { clip-path: ${startClipPath}; }
        100% { clip-path: ${endClipPath}; }
      }
    `
  }).join('\n')
}
