import type { ElementAnimation } from '../../types'
import { SCALE_IN_KEYFRAME_PREFIX } from './constants'

export const SCALE_IN_START_X_VAR = '--seewo-scale-in-start-x'
export const SCALE_IN_START_Y_VAR = '--seewo-scale-in-start-y'
export const SCALE_IN_END_X_VAR = '--seewo-scale-in-end-x'
export const SCALE_IN_END_Y_VAR = '--seewo-scale-in-end-y'

interface ScalePair {
  x: number
  y: number
}

interface ScaleInRange {
  start: ScalePair
  end: ScalePair
}

const DEFAULT_SCALE_START: ScalePair = { x: 0, y: 0 }
const DEFAULT_SCALE_END: ScalePair = { x: 1, y: 1 }

function resolveValidScalePair(value: ElementAnimation['startSize'] | ElementAnimation['endSize']): ScalePair | null {
  if (!value) return null
  if (!Number.isFinite(value.x) || !Number.isFinite(value.y)) return null
  return value
}

export function resolveScaleInRange(animation: ElementAnimation): ScaleInRange {
  return {
    start: resolveValidScalePair(animation.startSize) || DEFAULT_SCALE_START,
    end: resolveValidScalePair(animation.endSize) || DEFAULT_SCALE_END
  }
}

export function buildScaleInKeyframeName(): string {
  return SCALE_IN_KEYFRAME_PREFIX
}

export function buildScaleInKeyframesCss(): string {
  const keyframeName = buildScaleInKeyframeName()
  return `
    @keyframes ${keyframeName} {
      0% {
        transform: scale(var(${SCALE_IN_START_X_VAR}, 0), var(${SCALE_IN_START_Y_VAR}, 0));
      }
      100% {
        transform: scale(var(${SCALE_IN_END_X_VAR}, 1), var(${SCALE_IN_END_Y_VAR}, 1));
      }
    }
  `
}
