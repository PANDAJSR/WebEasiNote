export type SlidePanelAnchorSide = 'left' | 'right'

export type LayerSnapshot = {
  opacity: number
  transform: string
}

export interface TransitionState {
  id: number
  enteringIndex: number
  leavingIndex: number
  key: string
  durationMs: number
  isReverseBackTransition: boolean
  phase: 'prepare' | 'running'
}

export const thumbnailWidth = 96
export const thumbnailHeight = 56
export const slideInfoBarHeight = 40
export const FADE_TRANSITION_KEY = 'Fade'
export const SLIDE_TO_LEFT_TRANSITION_KEY = 'SlideToLeft'
export const SLIDE_TO_RIGHT_TRANSITION_KEY = 'SlideToRight'
export const SLIDE_TO_TOP_TRANSITION_KEY = 'SlideToTop'
export const SLIDE_TO_BOTTOM_TRANSITION_KEY = 'SlideToBottom'
export const CIRCLE_IN_TRANSITION_KEY = 'CircleIn'
export const LINE_REVEAL_TRANSITION_KEY = 'LineReveal'
export const DEFAULT_FADE_DURATION_MS = 300
export const MAX_FADE_DURATION_MS = 8000
export const DEFAULT_TRANSFORM = 'translate3d(0%, 0%, 0px)'
export const CIRCLE_IN_START_CLIP_PATH = 'circle(150% at 50% 50%)'
export const CIRCLE_IN_END_CLIP_PATH = 'circle(0% at 50% 50%)'
export const ENABLE_TRANSITION_DEBUG_LOG = false
export const ENABLE_ELEMENT_ANIMATION_DEBUG_LOG = true
export const DEFAULT_ELEMENT_ANIMATION_DURATION_MS = 300
export const FLICKER_KEYFRAME_ID = 'seewo-element-flicker-keyframes'
export const FLICKER_KEYFRAME_NAME = 'seewo-element-flicker'
export const WIPE_IN_KEYFRAME_PREFIX = 'seewo-element-wipe-in'
export const SLIDE_PANEL_ANIMATION_MS = 180

export function isAppearanceAnimation(type: string, category: string): boolean {
  const normalizedType = type.trim().toLowerCase()
  const normalizedCategory = category.trim().toLowerCase()
  return normalizedCategory === 'appearance' || normalizedType === 'fadein'
}

export function isDisappearanceAnimation(type: string, category: string): boolean {
  const normalizedType = type.trim().toLowerCase()
  const normalizedCategory = category.trim().toLowerCase()
  return normalizedCategory === 'disappearance' || normalizedType === 'fadeout'
}

export function isFadeAnimation(type: string): boolean {
  const normalizedType = type.trim().toLowerCase()
  return normalizedType === 'fadein' || normalizedType === 'fadeout'
}

export function isFlickerAnimation(type: string, category: string): boolean {
  const normalizedType = type.trim().toLowerCase()
  const normalizedCategory = category.trim().toLowerCase()
  return normalizedType === 'flicker' || normalizedCategory === 'emphasis'
}

export type WipeOrientation =
  | 'LeftToRight'
  | 'RightToLeft'
  | 'TopToBottom'
  | 'BottomToTop'
  | 'LeftTopToRightBottom'
  | 'RightTopToLeftBottom'
  | 'LeftBottomToRightTop'
  | 'RightBottomToLeftTop'

const wipeOrientations = new Set<WipeOrientation>([
  'LeftToRight',
  'RightToLeft',
  'TopToBottom',
  'BottomToTop',
  'LeftTopToRightBottom',
  'RightTopToLeftBottom',
  'LeftBottomToRightTop',
  'RightBottomToLeftTop'
])

export function isDiagonalWipeInAnimation(type: string): boolean {
  const normalizedType = type.trim().toLowerCase()
  return normalizedType === 'diagonalwipein'
}

export function normalizeWipeOrientation(rawValue?: string): WipeOrientation {
  if (!rawValue) return 'LeftToRight'
  const normalizedValue = rawValue.trim() as WipeOrientation
  return wipeOrientations.has(normalizedValue) ? normalizedValue : 'LeftToRight'
}

export function normalizeTransitionKey(transitionKey: string): string {
  return transitionKey.trim()
}

export function resolveEnteringStartTransform(transitionKey: string, isReverseBackTransition: boolean): string {
  const normalizedTransitionKey = normalizeTransitionKey(transitionKey)
  if (normalizedTransitionKey === SLIDE_TO_LEFT_TRANSITION_KEY) {
    return isReverseBackTransition ? 'translate3d(-100%, 0%, 0px)' : 'translate3d(100%, 0%, 0px)'
  }
  if (normalizedTransitionKey === SLIDE_TO_RIGHT_TRANSITION_KEY) {
    return isReverseBackTransition ? 'translate3d(100%, 0%, 0px)' : 'translate3d(-100%, 0%, 0px)'
  }
  if (normalizedTransitionKey === SLIDE_TO_TOP_TRANSITION_KEY) {
    return isReverseBackTransition ? 'translate3d(0%, -100%, 0px)' : 'translate3d(0%, 100%, 0px)'
  }
  if (normalizedTransitionKey === SLIDE_TO_BOTTOM_TRANSITION_KEY) {
    return isReverseBackTransition ? 'translate3d(0%, 100%, 0px)' : 'translate3d(0%, -100%, 0px)'
  }
  return DEFAULT_TRANSFORM
}

export function resolveLeavingTargetTransform(transitionKey: string, isReverseBackTransition: boolean): string {
  const normalizedTransitionKey = normalizeTransitionKey(transitionKey)
  if (normalizedTransitionKey === SLIDE_TO_LEFT_TRANSITION_KEY) {
    return isReverseBackTransition ? 'translate3d(100%, 0%, 0px)' : 'translate3d(-100%, 0%, 0px)'
  }
  if (normalizedTransitionKey === SLIDE_TO_RIGHT_TRANSITION_KEY) {
    return isReverseBackTransition ? 'translate3d(-100%, 0%, 0px)' : 'translate3d(100%, 0%, 0px)'
  }
  if (normalizedTransitionKey === SLIDE_TO_TOP_TRANSITION_KEY) {
    return isReverseBackTransition ? 'translate3d(0%, 100%, 0px)' : 'translate3d(0%, -100%, 0px)'
  }
  if (normalizedTransitionKey === SLIDE_TO_BOTTOM_TRANSITION_KEY) {
    return isReverseBackTransition ? 'translate3d(0%, -100%, 0px)' : 'translate3d(0%, 100%, 0px)'
  }
  return DEFAULT_TRANSFORM
}

export function isDirectionalSlideTransition(transitionKey: string): boolean {
  const normalizedTransitionKey = normalizeTransitionKey(transitionKey)
  return normalizedTransitionKey === SLIDE_TO_LEFT_TRANSITION_KEY
    || normalizedTransitionKey === SLIDE_TO_RIGHT_TRANSITION_KEY
    || normalizedTransitionKey === SLIDE_TO_TOP_TRANSITION_KEY
    || normalizedTransitionKey === SLIDE_TO_BOTTOM_TRANSITION_KEY
}

export function isCircleInTransition(transitionKey: string): boolean {
  return normalizeTransitionKey(transitionKey) === CIRCLE_IN_TRANSITION_KEY
}

export function isLineRevealTransition(transitionKey: string): boolean {
  return normalizeTransitionKey(transitionKey) === LINE_REVEAL_TRANSITION_KEY
}

function formatPercent(value: number): string {
  return `${Math.round(value * 1000) / 1000}%`
}

function buildPolygonClipPath(points: Array<{ x: number; y: number }>): string {
  if (points.length < 3) return 'polygon(0% 0%, 0% 0%, 0% 0%, 0% 0%, 0% 0%, 0% 0%)'

  const normalizedPoints = [...points]
  const lastPoint = normalizedPoints[normalizedPoints.length - 1]
  while (normalizedPoints.length < 6) {
    normalizedPoints.push(lastPoint)
  }

  const pointString = normalizedPoints
    .map(point => `${formatPercent(point.x)} ${formatPercent(point.y)}`)
    .join(', ')
  return `polygon(${pointString})`
}

export function buildLineRevealClipPath(progress: number, isReverseDirection: boolean): string {
  const clampedProgress = Math.max(0, Math.min(progress, 1))
  const threshold = isReverseDirection
    ? 200 * (1 - clampedProgress)
    : 200 * clampedProgress

  if (!isReverseDirection) {
    if (threshold <= 0) {
      return buildPolygonClipPath([
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 }
      ])
    }
    if (threshold < 100) {
      return buildPolygonClipPath([
        { x: threshold, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
        { x: 0, y: threshold }
      ])
    }
    if (threshold < 200) {
      return buildPolygonClipPath([
        { x: 100, y: threshold - 100 },
        { x: 100, y: 100 },
        { x: threshold - 100, y: 100 }
      ])
    }
    return buildPolygonClipPath([{ x: 100, y: 100 }, { x: 100, y: 100 }, { x: 100, y: 100 }])
  }

  if (threshold >= 200) {
    return buildPolygonClipPath([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 }
    ])
  }
  if (threshold > 100) {
    return buildPolygonClipPath([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: threshold - 100 },
      { x: threshold - 100, y: 100 },
      { x: 0, y: 100 }
    ])
  }
  if (threshold > 0) {
    return buildPolygonClipPath([
      { x: 0, y: 0 },
      { x: threshold, y: 0 },
      { x: 0, y: threshold }
    ])
  }
  return buildPolygonClipPath([{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }])
}
