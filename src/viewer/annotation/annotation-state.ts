import type { AnnotationState, AnnotationTool } from '../../types/annotation'

export const defaultAnnotationState = (): AnnotationState => ({
  tool: 'play', brush: { color: '#e53935', width: 4, opacity: 1, pressure: false },
  eraser: { width: 54, shape: 'rectangle' }, frozen: false
})

const tools: AnnotationTool[] = ['play', 'select', 'pen', 'eraser', 'stroke-eraser']
const finite = (value: unknown, min: number, max: number, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback

/** 宿主输入先校验，禁止 NaN 或无界尺寸进入几何计算。宽度单位为 CSS 像素。 */
export function patchAnnotationState(state: AnnotationState, patch: Record<string, unknown>): AnnotationState {
  const brush = patch.brush && typeof patch.brush === 'object' ? patch.brush as Record<string, unknown> : {}
  const eraser = patch.eraser && typeof patch.eraser === 'object' ? patch.eraser as Record<string, unknown> : {}
  return {
    tool: tools.includes(patch.tool as AnnotationTool) ? patch.tool as AnnotationTool : state.tool,
    frozen: typeof patch.frozen === 'boolean' ? patch.frozen : state.frozen,
    brush: {
      color: typeof brush.color === 'string' && /^#[\da-f]{6}(?:[\da-f]{2})?$/i.test(brush.color) ? brush.color : state.brush.color,
      width: finite(brush.width, 0.25, 256, state.brush.width),
      opacity: finite(brush.opacity, 0.01, 1, state.brush.opacity),
      pressure: typeof brush.pressure === 'boolean' ? brush.pressure : state.brush.pressure,
      kind: brush.kind === 'pen' || brush.kind === 'highlighter' || brush.kind === 'laser' ? brush.kind : state.brush.kind,
      height: brush.height === undefined && brush.width !== undefined
        ? finite(brush.width, 0.25, 256, state.brush.width) * (state.brush.height ?? state.brush.width) / state.brush.width
        : finite(brush.height, 0.25, 256, state.brush.height ?? state.brush.width),
      tip: brush.tip === 'ellipse' || brush.tip === 'rectangle' ? brush.tip : state.brush.tip,
      inkStyle: [0, 1, 2, 3].includes(brush.inkStyle as number) ? brush.inkStyle as 0 | 1 | 2 | 3 : state.brush.inkStyle,
      velocityMix: finite(brush.velocityMix, 0, 1, state.brush.velocityMix ?? 0.45),
      minDistanceScale: finite(brush.minDistanceScale, 0, 2, state.brush.minDistanceScale ?? 0.5),
      highlighterOverlap: typeof brush.highlighterOverlap === 'boolean' ? brush.highlighterOverlap : state.brush.highlighterOverlap,
      fadeEnabled: typeof brush.fadeEnabled === 'boolean' ? brush.fadeEnabled : state.brush.fadeEnabled,
      fadeDelay: finite(brush.fadeDelay, 0, 60000, state.brush.fadeDelay ?? 3000),
      fadeSpeed: finite(brush.fadeSpeed, 0.01, 100, state.brush.fadeSpeed ?? 1),
      smoothing: typeof brush.smoothing === 'boolean' ? brush.smoothing : state.brush.smoothing,
      smoothingQuality: [0, 1, 2].includes(brush.smoothingQuality as number)
        ? brush.smoothingQuality as 0 | 1 | 2 : state.brush.smoothingQuality
    },
    eraser: { width: finite(eraser.width, 4, 512, state.eraser.width),
      shape: eraser.shape === 'circle' || eraser.shape === 'rectangle' ? eraser.shape : state.eraser.shape }
  }
}
