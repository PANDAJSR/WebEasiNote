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

function buildBlindMaskLayerImageList(layerCount: number): string {
  return Array.from({ length: layerCount }, () => 'linear-gradient(#000 0 0)').join(', ')
}

function buildBlindMaskLayerRepeatList(layerCount: number): string {
  return Array.from({ length: layerCount }, () => 'no-repeat').join(', ')
}

function buildBlindMaskPositionList(layerCount: number, direction: BlindDirection): string {
  return Array.from({ length: layerCount }, (_, index) => {
    const offsetPercent = (100 / layerCount) * index
    return direction === 'Vertical'
      ? `${offsetPercent}% 0%`
      : `0% ${offsetPercent}%`
  }).join(', ')
}

function buildBlindMaskSizeList(layerCount: number, direction: BlindDirection, opened: boolean): string {
  const openedSize = direction === 'Vertical' ? '8.4% 100%' : '100% 8.4%'
  const closedSize = direction === 'Vertical' ? '0% 100%' : '100% 0%'
  const size = opened ? openedSize : closedSize
  return Array.from({ length: layerCount }, () => size).join(', ')
}

export function buildBlindInKeyframesCss(): string {
  const blindLayerCount = 10
  const horizontalKeyframeName = buildBlindInKeyframeName('Horizontal')
  const verticalKeyframeName = buildBlindInKeyframeName('Vertical')
  const maskImageList = buildBlindMaskLayerImageList(blindLayerCount)
  const maskRepeatList = buildBlindMaskLayerRepeatList(blindLayerCount)
  const verticalMaskPositionList = buildBlindMaskPositionList(blindLayerCount, 'Vertical')
  const horizontalMaskPositionList = buildBlindMaskPositionList(blindLayerCount, 'Horizontal')
  const verticalClosedMaskSizeList = buildBlindMaskSizeList(blindLayerCount, 'Vertical', false)
  const horizontalClosedMaskSizeList = buildBlindMaskSizeList(blindLayerCount, 'Horizontal', false)
  const verticalOpenedMaskSizeList = buildBlindMaskSizeList(blindLayerCount, 'Vertical', true)
  const horizontalOpenedMaskSizeList = buildBlindMaskSizeList(blindLayerCount, 'Horizontal', true)
  return `
    @keyframes ${verticalKeyframeName} {
      0% {
        -webkit-mask-image: ${maskImageList};
        mask-image: ${maskImageList};
        -webkit-mask-repeat: ${maskRepeatList};
        mask-repeat: ${maskRepeatList};
        -webkit-mask-position: ${verticalMaskPositionList};
        mask-position: ${verticalMaskPositionList};
        -webkit-mask-size: ${verticalClosedMaskSizeList};
        mask-size: ${verticalClosedMaskSizeList};
      }
      99% {
        -webkit-mask-image: ${maskImageList};
        mask-image: ${maskImageList};
        -webkit-mask-repeat: ${maskRepeatList};
        mask-repeat: ${maskRepeatList};
        -webkit-mask-position: ${verticalMaskPositionList};
        mask-position: ${verticalMaskPositionList};
        -webkit-mask-size: ${verticalOpenedMaskSizeList};
        mask-size: ${verticalOpenedMaskSizeList};
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
        -webkit-mask-image: ${maskImageList};
        mask-image: ${maskImageList};
        -webkit-mask-repeat: ${maskRepeatList};
        mask-repeat: ${maskRepeatList};
        -webkit-mask-position: ${horizontalMaskPositionList};
        mask-position: ${horizontalMaskPositionList};
        -webkit-mask-size: ${horizontalClosedMaskSizeList};
        mask-size: ${horizontalClosedMaskSizeList};
      }
      99% {
        -webkit-mask-image: ${maskImageList};
        mask-image: ${maskImageList};
        -webkit-mask-repeat: ${maskRepeatList};
        mask-repeat: ${maskRepeatList};
        -webkit-mask-position: ${horizontalMaskPositionList};
        mask-position: ${horizontalMaskPositionList};
        -webkit-mask-size: ${horizontalOpenedMaskSizeList};
        mask-size: ${horizontalOpenedMaskSizeList};
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
