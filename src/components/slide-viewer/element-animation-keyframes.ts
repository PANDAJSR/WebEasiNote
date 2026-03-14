import {
  FLICKER_KEYFRAME_ID,
  FLICKER_KEYFRAME_NAME
} from './constants'
import { buildScaleInKeyframesCss } from './scale-animation'
import { buildTranslateFadeInKeyframesCss } from './translate-fade-animation'
import { buildTranslateInKeyframesCss } from './translate-animation'
import { buildBlindInKeyframesCss, buildWipeInKeyframesCss } from './wipe-animation'

export const FADE_IN_KEYFRAME_NAME = 'seewo-element-fade-in'
export const FADE_OUT_KEYFRAME_NAME = 'seewo-element-fade-out'

export function ensureElementAnimationKeyframes(): void {
  if (typeof document === 'undefined') return
  if (document.getElementById(FLICKER_KEYFRAME_ID)) return

  const styleElement = document.createElement('style')
  styleElement.id = FLICKER_KEYFRAME_ID
  styleElement.textContent = `
    @keyframes ${FLICKER_KEYFRAME_NAME} {
      0% { opacity: 1; }
      15% { opacity: 0.2; }
      30% { opacity: 1; }
      45% { opacity: 0.2; }
      60% { opacity: 1; }
      75% { opacity: 0.2; }
      100% { opacity: 1; }
    }
    @keyframes ${FADE_IN_KEYFRAME_NAME} {
      0% { opacity: 0; }
      100% { opacity: 1; }
    }
    @keyframes ${FADE_OUT_KEYFRAME_NAME} {
      0% { opacity: 1; }
      100% { opacity: 0; }
    }
    ${buildWipeInKeyframesCss()}
    ${buildBlindInKeyframesCss()}
    ${buildTranslateFadeInKeyframesCss()}
    ${buildTranslateInKeyframesCss()}
    ${buildScaleInKeyframesCss()}
  `
  document.head.appendChild(styleElement)
}
