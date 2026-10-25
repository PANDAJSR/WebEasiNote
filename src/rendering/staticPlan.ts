import type { SlideData, SlideElement } from '../types'
import type { ShapeElement } from '../enbx/shapes'
import { getShapeGeometry } from './shapeGeometry'

export interface StaticDrawing {
  x: number
  y: number
  width: number
  height: number
  rotation: number
  flipX: boolean
  flipY: boolean
  fill: string
  geometry: ReturnType<typeof getShapeGeometry>
  paths: { path: string; fillRule: CanvasFillRule }[]
}

export interface StaticRun {
  kind: 'static'
  id: string
  drawings: StaticDrawing[]
  elements: SlideElement[]
}

export type RenderItem = SlideElement | StaticRun
const plans = new WeakMap<SlideData, RenderItem[]>()
const sharedPlans = new WeakMap<SlideElement, { slide: SlideData; plan: RenderItem[] }>()

function toDrawing(element: SlideElement, blocked: Set<string>): StaticDrawing | null {
  if (element.type !== 'shape' || !element.staticCacheSafe) return null
  if ([element.id, element.groupId, ...(element.groupAncestorIds || [])].some(id => id && blocked.has(id))) return null
  const shape = element as ShapeElement
  if (shape.inlineText?.length || shape.shadow || shape.reflection
    || shape.shapePaths?.some(path => path.fill !== undefined)
    || (shape.backgroundBrush && shape.backgroundBrush.type !== 'color')
    || shape.borderWidth || shape.strokeDashes?.length || shape.arrowStart || shape.arrowEnd
    || (shape.opacity ?? 1) !== 1 || !shape.path) return null
  if (![shape.x, shape.y, shape.width, shape.height, shape.rotation || 0].every(Number.isFinite)) return null
  const geometry = getShapeGeometry(shape)
  const fill = shape.backgroundColor
  // 透明填充可保留空绘制；只接受可移植的纯色。
  if (!/^(#[\da-f]{3,8}|rgba?\([\d.,%\s]+\)|transparent|none)$/i.test(fill)) return null
  return {
    x: shape.x, y: shape.y, width: geometry.renderWidth, height: geometry.renderHeight,
    rotation: shape.rotation || 0, flipX: !!shape.flipHorizontal, flipY: !!shape.flipVertical,
    fill, geometry,
    paths: shape.shapePaths?.length
      ? shape.shapePaths.filter(path => path.isFilled).map(path => ({
        path: path.path, fillRule: path.fillRule || geometry.resolvedFillRule
      }))
      : geometry.isFilled ? [{ path: shape.path, fillRule: geometry.resolvedFillRule }] : []
  }
}

/** 连续静态段保持原始 Z 顺序，动画目标、源及祖先均构成边界。 */
export function getStaticPlan(slide: SlideData): RenderItem[] {
  const cached = plans.get(slide)
  if (cached) return cached
  // 展示层可能仅复制页面和数组，元素及动画未变时复用已预热的计划。
  const shared = slide.elements[0] && sharedPlans.get(slide.elements[0])
  if (shared && shared.slide.animations === slide.animations
    && shared.slide.elements.length === slide.elements.length
    && shared.slide.elements.every((element, index) => element === slide.elements[index])) {
    plans.set(slide, shared.plan)
    return shared.plan
  }
  const blocked = new Set(slide.animations.flatMap(animation => [
    animation.targetId, animation.sourceElementId, animation.triggerSource
  ]))
  const result: RenderItem[] = []
  let run: StaticRun | null = null
  const flush = () => {
    if (!run) return
    // 小段维持矢量，避免为简单页面分配整页位图。
    if (run.elements.length < 32) result.push(...run.elements)
    else result.push(run)
    run = null
  }
  for (const element of slide.elements) {
    const drawing = toDrawing(element, blocked)
    if (!drawing) {
      flush()
      result.push(element)
      continue
    }
    run ||= { kind: 'static', id: `static-${element.id}`, drawings: [], elements: [] }
    run.drawings.push(drawing)
    run.elements.push(element)
  }
  flush()
  plans.set(slide, result)
  if (slide.elements[0]) sharedPlans.set(slide.elements[0], { slide, plan: result })
  return result
}

export function isStaticRun(item: RenderItem): item is StaticRun {
  return 'kind' in item && item.kind === 'static'
}
