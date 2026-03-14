import type { BlindDirection, WipeOrientation } from './constants'
import { BLIND_IN_KEYFRAME_PREFIX, WIPE_IN_KEYFRAME_PREFIX } from './constants'

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

export function buildBlindInKeyframeName(direction: BlindDirection): string {
  return `${BLIND_IN_KEYFRAME_PREFIX}-${direction}`
}

export function buildBlindInKeyframesCss(): string {
  const horizontalKeyframeName = buildBlindInKeyframeName('Horizontal')
  const verticalKeyframeName = buildBlindInKeyframeName('Vertical')
  return `
    @property --seewo-blind-open-ratio {
      syntax: '<percentage>';
      inherits: false;
      initial-value: 0%;
    }
    @keyframes ${verticalKeyframeName} {
      0% {
        --seewo-blind-open-ratio: 0%;
        -webkit-mask-image: repeating-linear-gradient(
          to right,
          #000 0%,
          #000 var(--seewo-blind-open-ratio),
          transparent var(--seewo-blind-open-ratio),
          transparent 100%
        );
        mask-image: repeating-linear-gradient(
          to right,
          #000 0%,
          #000 var(--seewo-blind-open-ratio),
          transparent var(--seewo-blind-open-ratio),
          transparent 100%
        );
        -webkit-mask-repeat: repeat;
        mask-repeat: repeat;
        -webkit-mask-size: 10% 100%;
        mask-size: 10% 100%;
      }
      99% {
        --seewo-blind-open-ratio: 84%;
        -webkit-mask-image: repeating-linear-gradient(
          to right,
          #000 0%,
          #000 var(--seewo-blind-open-ratio),
          transparent var(--seewo-blind-open-ratio),
          transparent 100%
        );
        mask-image: repeating-linear-gradient(
          to right,
          #000 0%,
          #000 var(--seewo-blind-open-ratio),
          transparent var(--seewo-blind-open-ratio),
          transparent 100%
        );
        -webkit-mask-repeat: repeat;
        mask-repeat: repeat;
        -webkit-mask-size: 10% 100%;
        mask-size: 10% 100%;
      }
      100% {
        -webkit-mask-image: linear-gradient(to right, #000 0%, #000 100%);
        mask-image: linear-gradient(to right, #000 0%, #000 100%);
        -webkit-mask-repeat: no-repeat;
        mask-repeat: no-repeat;
        -webkit-mask-size: 100% 100%;
        mask-size: 100% 100%;
      }
    }
    @keyframes ${horizontalKeyframeName} {
      0% {
        --seewo-blind-open-ratio: 0%;
        -webkit-mask-image: repeating-linear-gradient(
          to bottom,
          #000 0%,
          #000 var(--seewo-blind-open-ratio),
          transparent var(--seewo-blind-open-ratio),
          transparent 100%
        );
        mask-image: repeating-linear-gradient(
          to bottom,
          #000 0%,
          #000 var(--seewo-blind-open-ratio),
          transparent var(--seewo-blind-open-ratio),
          transparent 100%
        );
        -webkit-mask-repeat: repeat;
        mask-repeat: repeat;
        -webkit-mask-size: 100% 10%;
        mask-size: 100% 10%;
      }
      99% {
        --seewo-blind-open-ratio: 84%;
        -webkit-mask-image: repeating-linear-gradient(
          to bottom,
          #000 0%,
          #000 var(--seewo-blind-open-ratio),
          transparent var(--seewo-blind-open-ratio),
          transparent 100%
        );
        mask-image: repeating-linear-gradient(
          to bottom,
          #000 0%,
          #000 var(--seewo-blind-open-ratio),
          transparent var(--seewo-blind-open-ratio),
          transparent 100%
        );
        -webkit-mask-repeat: repeat;
        mask-repeat: repeat;
        -webkit-mask-size: 100% 10%;
        mask-size: 100% 10%;
      }
      100% {
        -webkit-mask-image: linear-gradient(to bottom, #000 0%, #000 100%);
        mask-image: linear-gradient(to bottom, #000 0%, #000 100%);
        -webkit-mask-repeat: no-repeat;
        mask-repeat: no-repeat;
        -webkit-mask-size: 100% 100%;
        mask-size: 100% 100%;
      }
    }
  `
}
