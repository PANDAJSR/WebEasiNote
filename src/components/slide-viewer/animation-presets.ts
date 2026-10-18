import type { ElementAnimation } from '../../types'
import { isRandomizedLinesInAnimation } from './randomized-lines-animation'

export type PresetAnimationFamily = 'entrance' | 'exit' | 'emphasis'

const entranceExitTypes = new Set([
  'fly', 'blinds', 'dissolve', 'fade', 'randomline', 'spiral', 'wipe', 'whirl',
  'bounce', 'drop', 'flow', 'cycle', 'scale', 'box', 'checkerboard', 'circle',
  'diamond', 'plus', 'barn', 'randombars', 'strips', 'wedge', 'wheel'
])

const emphasisTypes = new Set([
  'fillcolor', 'fontcolor', 'linecolor', 'spinningtop', 'transparency', 'boldflicker',
  'bolddisplay', 'strokecolor', 'underline', 'objectcolor', 'complementarycolor',
  'complementarycolor2', 'deepen', 'unsaturation', 'pulse', 'colorpulse',
  'colorextension', 'thin', 'teeterboard', 'wave', 'flicker', 'flash', 'heartbeat',
  'flip', 'emphasisbounce', 'emphasisscale'
])

const filterTypes = new Set([
  'blindshorizontal', 'blindsvertical', 'boxin', 'boxout', 'checkerboardacross',
  'checkerboarddown', 'slidefromtop', 'slidefrombottom', 'slidefromleft', 'slidefromright',
  'plusin', 'plusout', 'barninvertical', 'barninhorizontal',
  'barnoutvertical', 'barnouthorizontal', 'randombarshorizontal', 'randombarsvertical',
  'stripsdownleft', 'stripsupleft', 'stripsdownright', 'stripsupright', 'wheel1',
  'wheel2', 'wheel3', 'wheel4', 'wheel8', 'wiperight', 'wipeleft', 'wipedown', 'wipeup'
])

function normalize(value?: string): string {
  return (value || '').trim().replace(/[^a-z0-9]/gi, '').toLowerCase()
}

function baseType(type: string): string {
  const normalized = normalize(type)
  return normalized.endsWith('in') ? normalized.slice(0, -2)
    : normalized.endsWith('out') ? normalized.slice(0, -3)
      : normalized
}

export function resolvePresetAnimationFamily(animation: Pick<ElementAnimation, 'type' | 'category' | 'effect'>): PresetAnimationFamily | null {
  const type = normalize(animation.type)
  const category = normalize(animation.category)
  const base = baseType(animation.type)
  if (isRandomizedLinesInAnimation(animation.type)) return 'entrance'
  if (category === 'emphasis' && (emphasisTypes.has(type) || emphasisTypes.has(base) || type === 'scale' || type === 'bounce')) return 'emphasis'
  if (emphasisTypes.has(type) || emphasisTypes.has(base)) return 'emphasis'
  if (entranceExitTypes.has(type) || entranceExitTypes.has(base) || filterTypes.has(type)) {
    if (category === 'disappearance' || type.endsWith('out') || normalize(animation.effect) === 'out') return 'exit'
    return 'entrance'
  }
  if (type === 'fadein' || type === 'fadeout' || type === 'blindin' || type === 'diagonalwipein'
    || type === 'translatein' || type === 'translatefadein' || type === 'scalein' || type === 'flicker') {
    if (category === 'disappearance' || type.endsWith('out')) return 'exit'
    if (type === 'flicker') return 'emphasis'
    return 'entrance'
  }
  return null
}

export function isPresetEntrance(animation: Pick<ElementAnimation, 'type' | 'category' | 'effect'>): boolean {
  return resolvePresetAnimationFamily(animation) === 'entrance'
}

export function isPresetExit(animation: Pick<ElementAnimation, 'type' | 'category' | 'effect'>): boolean {
  return resolvePresetAnimationFamily(animation) === 'exit'
}

export function isPresetEmphasis(animation: Pick<ElementAnimation, 'type' | 'category' | 'effect'>): boolean {
  return resolvePresetAnimationFamily(animation) === 'emphasis'
}

function slug(type: string): string {
  return normalize(type).replace(/[^a-z0-9]/g, '') || 'unknown'
}

export function buildPresetAnimationKeyframeName(animation: Pick<ElementAnimation, 'type' | 'category' | 'effect'>): string {
  const family = resolvePresetAnimationFamily(animation) || 'entrance'
  return `seewo-preset-${family}-${slug(animation.type)}-default`
}

function baseKeyframes(name: string, transform: string, clip: string, filter: string): string {
  return `
    @keyframes ${name}-in {
      0% { opacity: 0; transform: var(--seewo-preset-initial-transform, ${transform}); clip-path: var(--seewo-preset-initial-clip, ${clip}); filter: var(--seewo-preset-initial-filter, ${filter}); }
      70% { opacity: 1; }
      100% { opacity: 1; transform: none; clip-path: inset(0 0 0 0); filter: none; }
    }
    @keyframes ${name}-out {
      0% { opacity: 1; transform: none; clip-path: inset(0 0 0 0); filter: none; }
      100% { opacity: 0; transform: var(--seewo-preset-initial-transform, ${transform}); clip-path: var(--seewo-preset-initial-clip, ${clip}); filter: var(--seewo-preset-initial-filter, ${filter}); }
    }
  `
}

function buildEffectKeyframes(name: string, effect: string, emphasis: boolean): string {
  const pulse = `
    @keyframes ${name} {
      0%, 100% { transform: none; filter: none; opacity: 1; }
      25% { transform: scale(1.12); filter: brightness(1.25); opacity: .55; }
      50% { transform: scale(.96); filter: none; opacity: 1; }
      75% { transform: scale(1.08); filter: brightness(1.15); opacity: .7; }
    }
  `
  if (emphasis) {
    if (['pulse', 'heartbeat', 'colorpulse', 'emphasisscale', 'scale', 'bounce'].includes(effect)) return pulse
    if (['flicker', 'boldflicker', 'flash'].includes(effect)) return `
      @keyframes ${name} { 0%, 100% { opacity: 1; } 20%, 60% { opacity: .15; } 40%, 80% { opacity: .8; } }
    `
    if (['spinningtop', 'flip', 'teeterboard', 'wave'].includes(effect)) return `
      @keyframes ${name} { 0%, 100% { transform: none; } 25% { transform: rotateY(80deg) rotate(-7deg); } 50% { transform: rotateY(180deg) rotate(7deg); } 75% { transform: rotateY(280deg) rotate(-4deg); } }
    `
    const filter = effect === 'unsaturation' ? 'saturate(0)' : effect === 'deepen' ? 'brightness(.55)' :
      effect.includes('color') || effect === 'objectcolor' || effect === 'strokecolor' ? 'hue-rotate(160deg) saturate(2)' :
      effect === 'transparency' ? 'opacity(.25)' : 'brightness(1.8) saturate(1.6)'
    return `@keyframes ${name} { 0%, 100% { filter: none; } 50% { filter: ${filter}; } }`
  }

  const orientation = effect
  let transform = 'translate3d(-100%, 0, 0)'
  let clip = 'inset(0 100% 0 0)'
  let filter = 'none'
  if (orientation.includes('right') || orientation.includes('left')) {
    transform = orientation.includes('right') ? 'translate3d(100%, 0, 0)' : 'translate3d(-100%, 0, 0)'
    clip = orientation.includes('right') ? 'inset(0 0 0 100%)' : 'inset(0 100% 0 0)'
  } else if (orientation.includes('top') || orientation.includes('bottom')) {
    transform = orientation.includes('top') ? 'translate3d(0, -100%, 0)' : 'translate3d(0, 100%, 0)'
    clip = orientation.includes('top') ? 'inset(100% 0 0 0)' : 'inset(0 0 100% 0)'
  }
  if (orientation.includes('box')) clip = 'inset(50% 50% 50% 50%)'
  if (orientation.includes('circle') || orientation.includes('wheel')) clip = 'circle(0% at 50% 50%)'
  if (orientation.includes('diamond')) clip = 'polygon(50% 50%, 50% 50%, 50% 50%, 50% 50%)'
  if (orientation.includes('plus')) clip = 'polygon(45% 0,55% 0,55% 45%,100% 45%,100% 55%,55% 55%,55% 100%,45% 100%,45% 55%,0 55%,0 45%,45% 45%)'
  if (orientation.includes('dissolve') || orientation.includes('randomline') || orientation.includes('checker') || orientation.includes('randombar')) filter = 'blur(5px)'
  if (orientation.includes('spiral') || orientation.includes('whirl')) transform = 'rotate(-180deg) scale(.1)'
  if (orientation.includes('bounce') || orientation.includes('drop')) transform = 'translate3d(0, -100%, 0) scale(.8)'
  if (orientation.includes('scale')) transform = 'scale(.01)'
  if (orientation.includes('blinds')) clip = 'inset(45% 0 45% 0)'
  return baseKeyframes(name, transform, clip, filter)
}

export function buildPresetAnimationKeyframesCss(): string {
  const allTypes = [...entranceExitTypes, ...filterTypes, ...emphasisTypes]
  const keyframes = new Set<string>()
  allTypes.forEach(type => {
    for (const family of ['entrance', 'exit', 'emphasis'] as const) {
      const name = `seewo-preset-${family}-${slug(type)}-default`
      keyframes.add(buildEffectKeyframes(name, type, family === 'emphasis'))
    }
  })
  return Array.from(keyframes).join('\n')
}

export function resolvePresetPlayback(animation: ElementAnimation): { name: string; family: PresetAnimationFamily } | null {
  const family = resolvePresetAnimationFamily(animation)
  if (!family) return null
  const baseName = buildPresetAnimationKeyframeName(animation)
  return { family, name: `${baseName}${family === 'entrance' || family === 'exit' ? `-${family === 'entrance' ? 'in' : 'out'}` : ''}` }
}

export interface PresetInitialMotion {
  transform: string
  clip: string
  filter: string
}

export function resolvePresetInitialMotion(animation: ElementAnimation): PresetInitialMotion {
  const type = normalize(animation.type)
  const orientation = normalize(animation.orientation)
  const direction = normalize(animation.direction)
  const magnitude = normalize(animation.magnitude)
  const scale = magnitude === 'weak' ? 0.55 : magnitude === 'strong' ? 1.5 : 1
  const motionDirection = orientation || type
  let transform = 'translate3d(-100%, 0, 0)'
  let clip = 'inset(0 100% 0 0)'
  let filter = 'none'

  if (motionDirection.includes('right')) {
    transform = `translate3d(${100 * scale}%, 0, 0)`
    clip = 'inset(0 0 0 100%)'
  } else if (motionDirection.includes('top')) {
    transform = `translate3d(0, ${-100 * scale}%, 0)`
    clip = 'inset(100% 0 0 0)'
  } else if (motionDirection.includes('bottom')) {
    transform = `translate3d(0, ${100 * scale}%, 0)`
    clip = 'inset(0 0 100% 0)'
  } else if (motionDirection.includes('left')) {
    transform = `translate3d(${-100 * scale}%, 0, 0)`
    clip = 'inset(0 100% 0 0)'
  }

  if (type.includes('fade')) {
    transform = 'none'
    clip = 'inset(0 0 0 0)'
  }
  if (type.includes('blind')) {
    clip = direction === 'horizontal' || motionDirection.includes('horizontal') || type.includes('horizontal')
      ? 'inset(45% 0 45% 0)'
      : 'inset(0 45% 0 45%)'
  } else if (type.includes('box')) clip = 'inset(50% 50% 50% 50%)'
  else if (type.includes('barn')) {
    clip = type.includes('vertical') ? 'inset(0 50% 0 50%)' : 'inset(50% 0 50% 0)'
  }
  else if (type.includes('circle') || type.includes('wheel')) clip = 'circle(0% at 50% 50%)'
  else if (type.includes('diamond')) clip = 'polygon(50% 50%, 50% 50%, 50% 50%, 50% 50%)'
  else if (type.includes('plus')) clip = 'polygon(45% 0,55% 0,55% 45%,100% 45%,100% 55%,55% 55%,55% 100%,45% 100%,45% 55%,0 55%,0 45%,45% 45%)'
  else if (type.includes('spiral') || type.includes('whirl')) transform = `rotate(-${180 * scale}deg) scale(.1)`
  else if (type.includes('cycle')) transform = 'rotateY(90deg) scale(.4)'
  else if (type.includes('bounce') || type.includes('drop')) transform = `translate3d(0, ${-100 * scale}%, 0) scale(.8)`
  else if (type.includes('flow')) transform = `translate3d(0, ${100 * scale}%, 0)`
  else if (type.includes('scale')) transform = `scale(${magnitude === 'weak' ? 0.7 : magnitude === 'strong' ? 0.01 : 0.35})`
  else if (type.includes('strips')) {
    transform = type.includes('up') ? 'translate3d(0, 30%, 0)' : 'translate3d(0, -30%, 0)'
    clip = 'inset(0 50% 0 50%)'
  } else if (type.includes('wedge')) clip = 'polygon(50% 50%, 50% 0%, 50% 0%, 50% 0%)'
  else if (type.includes('dissolve')) {
    transform = 'none'
    clip = 'inset(0 0 0 0)'
    filter = 'blur(5px)'
  } else if (type.includes('randomline') || type.includes('checker') || type.includes('randombar')) filter = 'blur(5px)'

  return { transform, clip, filter }
}
