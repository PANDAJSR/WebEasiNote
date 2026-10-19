import { hasClosedSegments } from '../enbx/path-utils'

/**
 * 希沃形状（Shape）描边 / 箭头语义。
 *
 * 本模块的取值全部来自官方 EasiNote5 5.2.4.10148 反编译结果（Cvte.Paint.Shell.dll）：
 *
 * - `Cvte.Paint.Framework.DashCollection`：虚线数组（WPF `DashStyle.Dashes` 语义，
 *   单位是「线宽的倍数」，不是像素）：
 *     Normal = []            → 实线
 *     Dash   = [2, 2]
 *     DotDash= [5, 3]
 *     LongDash = [10, 2, 2, 2]
 * - `ShapeBase.GetDashStyleTypeByLineType` + `ShapeBase.SetDashStyle(DashStyleType)`：
 *     LineType.None                                          → 闭合图形 StrokeThickness = 0（完全不描边），未闭合图形 = 实线
 *     Normal / StartArrow / EndArrow / DoubleArrow           → 实线
 *     Dash                                                   → Dash[2, 2]
 *     DotDash / StartDotArrow / EndDotArrow / DoubleDotArrow → DotDash[5, 3]
 *     LongDash                                               → LongDash[10, 2, 2, 2]
 * - `ShapeBase.SetSaveInfo`：`PenSetting.DashStyle.Dashes` 存在时直接覆盖上面的线型虚线。
 * - `ShapeBase.RefreshPen`：`DashCap` 固定 Flat；线端 = `GetPenLineCap()`；
 *   `LineJoin = PenSetting.LineJoin ?? Round`。
 * - `ShapeBase.GetPenLineCap`：`LineJoin` 为空或 Round → Round（`IsSmoothJoin`）；
 *   否则闭合图形 + Flat → Square；其余取 `PenSetting.LineCap`（缺省 Flat）。
 * - `ShapeBase.GetArrowPoints` / `ArrowWidth` / `ArrowHeight`：箭头的真实几何是
 *   「以描边色描边的两段开放折线（V 形）」，与 `<ArrowType>` 字符串、Width/Length 无关。
 */

export type StrokeLineCap = 'butt' | 'round' | 'square'
export type StrokeLineJoin = 'miter' | 'round' | 'bevel'

/**
 * 官方 `ShapesFactory.CreateShapeInstance` + 各形状类 IsClosed 初始化结果：
 * 只有下列形状类型是「开放图形」（`IsClosed = false`）。
 */
const OPEN_SHAPE_TYPES = new Set([
  'line',
  'linearrowend',
  'linearrowstartend',
  'dashline',
  'freeline',
  'brace',
  'bracket'
])

/**
 * 官方对这些类型返回 `new ShapeFromStream(shapeType)`（`IsClosed = HasClosedSegments`）。
 */
const PATH_BASED_SHAPE_TYPES = new Set([
  'freeshape',
  'love',
  'cloud',
  'bomb',
  'thunder',
  'unknown'
])

/**
 * 官方 `ShapeType` 枚举中其余类型对应的形状类都没有改写 `IsClosed`，
 * 沿用 `ShapeBase.IsClosed = true`（即闭合图形）。
 */
const KNOWN_CLOSED_SHAPE_TYPES = new Set([
  'rectangle',
  'roundrectangle',
  'rectanglemark',
  'circle',
  'fan',
  'sun',
  'moon',
  'triangle',
  'righttriangle',
  'rhomboid',
  'rhombus',
  'curverhombus',
  'polygon',
  'trapezoid',
  'arrowend',
  'arrowstartend',
  'arrowswallow',
  'curvearrow',
  'circlebubble',
  'rectanglebubble',
  'star',
  'flag',
  'bubble',
  'fire',
  'smilingface',
  'medal',
  'scroll',
  'banner',
  'rotationarrow'
])

/**
 * 复刻官方 `ShapeElement.SetSaveInfo` 的 IsClosed 判定：
 * - 已知预设类型 → 由形状类决定（`ShapeBase.IsClosed` 默认 true）；
 * - `FreeShape` / `Love|Cloud|Bomb|Thunder` / `UnKnown`（含 `Enum.TryParse` 失败的
 *   `Custom_PPTX_*`）→ 走 `ShapeFromStream`，按路径是否闭合判定。
 */
export function resolveShapeIsClosed(geometryType: string | undefined, path: string): boolean {
  const key = (geometryType || '').trim().toLowerCase()
  if (OPEN_SHAPE_TYPES.has(key)) return false
  if (PATH_BASED_SHAPE_TYPES.has(key)) return hasClosedSegments(path)
  if (KNOWN_CLOSED_SHAPE_TYPES.has(key)) return true
  // 未识别的类型名（官方 Enum.TryParse 失败 → UnKnown → ShapeFromStream）
  return hasClosedSegments(path)
}

/** 官方 DashCollection（单位：线宽倍数） */
export const DASH_COLLECTION = {
  normal: [] as number[],
  dash: [2, 2] as number[],
  dotDash: [5, 3] as number[],
  longDash: [10, 2, 2, 2] as number[]
}

/** 官方 LineType → DashCollection（见 GetDashStyleTypeByLineType / SetDashStyle） */
const LINE_TYPE_DASHES: Record<string, number[]> = {
  normal: DASH_COLLECTION.normal,
  startarrow: DASH_COLLECTION.normal,
  endarrow: DASH_COLLECTION.normal,
  doublearrow: DASH_COLLECTION.normal,
  dash: DASH_COLLECTION.dash,
  dotdash: DASH_COLLECTION.dotDash,
  startdotarrow: DASH_COLLECTION.dotDash,
  enddotarrow: DASH_COLLECTION.dotDash,
  doubledotarrow: DASH_COLLECTION.dotDash,
  longdash: DASH_COLLECTION.longDash
}

export interface PenSettingInfo {
  /** PenSetting/DashStyle/Dashes，单位同样是线宽倍数 */
  dashes?: number[]
  lineCap?: string
  lineJoin?: string
  isArrowDash?: boolean
}

export interface ShapeStrokeStyle {
  /** 描边线宽（幻灯片单位，未乘缩放）；0 表示完全不描边 */
  width: number
  /** 虚线段长（线宽倍数）；空数组代表实线 */
  dashes: number[]
  lineCap: StrokeLineCap
  lineJoin: StrokeLineJoin
}

function normalizeKey(value?: string | null): string {
  return (value || '').trim().toLowerCase()
}

function toStrokeLineCap(value?: string | null): StrokeLineCap {
  switch (normalizeKey(value)) {
    case 'round':
      return 'round'
    case 'square':
      return 'square'
    default:
      return 'butt'
  }
}

function toStrokeLineJoin(value?: string | null): StrokeLineJoin {
  switch (normalizeKey(value)) {
    case 'round':
      return 'round'
    case 'bevel':
      return 'bevel'
    default:
      return 'miter'
  }
}

/**
 * 判断希沃路径是否包含闭合子图形。
 *
 * 对应官方 `FreeShapeRenderer.HasClosedSegments`，排除单一直线段的退化闭合；
 * 官方 `ShapeBase` 默认 `IsClosed = true`，`FreeShape`/`ShapeFromStream` 会用路径结果覆盖。
 */
export function hasClosedSegment(path: string): boolean {
  return hasClosedSegments(path)
}

/**
 * 复刻官方 `ShapeBase.SetSaveInfo` 的描边推导结果。
 */
export function resolveShapeStroke(input: {
  thickness: number
  lineType?: string | null
  closed: boolean
  geometryType?: string
  pen?: PenSettingInfo
}): ShapeStrokeStyle {
  const pen = input.pen || {}
  const rawThickness = Number.isFinite(input.thickness) ? input.thickness : 0
  let width = rawThickness >= 0 && rawThickness <= 100 ? rawThickness : 0

  const lineType = normalizeKey(input.lineType) || 'none'
  if (lineType === 'none' && input.closed) {
    // 官方：LineType.None + 闭合图形 → StrokeThickness = 0
    width = 0
  }

  const initiallyHasArrow = ['linearrowend', 'linearrowstartend'].includes(normalizeKey(input.geometryType))
  const defaultDashes = initiallyHasArrow
    && ['dotdash', 'startdotarrow', 'enddotarrow', 'doubledotarrow'].includes(lineType)
    ? DASH_COLLECTION.dash
    : LINE_TYPE_DASHES[lineType] || []
  const dashes = pen.dashes !== undefined
    ? pen.dashes.slice()
    : defaultDashes.slice()

  const lineJoin = pen.lineJoin ? toStrokeLineJoin(pen.lineJoin) : 'round'
  let lineCap: StrokeLineCap
  if (!pen.lineJoin || normalizeKey(pen.lineJoin) === 'round') {
    // 官方 IsSmoothJoin：LineJoin 为空或 Round 时线端强制 Round
    lineCap = 'round'
  } else if (input.closed && normalizeKey(pen.lineCap) === 'flat') {
    lineCap = 'square'
  } else {
    lineCap = toStrokeLineCap(pen.lineCap || 'flat')
  }

  return { width, dashes, lineCap, lineJoin }
}

/**
 * 虚线数组 → SVG stroke-dasharray。
 *
 * 官方虚线单位是线宽倍数，Web 端渲染时使用 `vector-effect="non-scaling-stroke"`
 * （描边几何在设备坐标系计算），因此这里直接把「倍数 × 线宽 × 缩放」换算成像素。
 */
export function dashArrayToCss(
  dashes: number[],
  width: number,
  scale: number
): string | undefined {
  if (!dashes || dashes.length === 0) return undefined
  const strokePx = Math.max(0, width) * scale
  if (strokePx <= 0) return undefined
  return dashes.map(d => Math.max(0, d) * strokePx).join(' ')
}

export interface Point2D {
  x: number
  y: number
}

/** 官方 ArrowWidth = 10 * max(t, 2) / 2 = 5 * max(t, 2) */
export function arrowWidth(thickness: number): number {
  return 5 * Math.max(thickness > 2 ? thickness : 2, 1e-6)
}

/** 官方 ArrowHeight = 5 * max(t, 2) / 2 = 2.5 * max(t, 2) */
export function arrowHeight(thickness: number): number {
  return 2.5 * Math.max(thickness > 2 ? thickness : 2, 1e-6)
}

/**
 * 复刻官方 `ShapeBase.GetArrowPoints`：返回一条 V 形开放折线（无填充，仅描边）。
 *
 * @param tip      箭头尖端（官方 last）
 * @param neighbor 与尖端相邻的另一个端点（官方 first），用于确定朝向
 * @param thickness 描边线宽
 */
export function buildArrowHeadPath(
  tip: Point2D,
  neighbor: Point2D,
  thickness: number
): string {
  const aw = arrowWidth(thickness)
  const ah = arrowHeight(thickness)
  const angle = Math.atan2(neighbor.y - tip.y, neighbor.x - tip.x)
  const sin = Math.sin(angle)
  const cos = Math.cos(angle)
  const round = (value: number) => Number(value.toFixed(4))
  const pt1 = {
    x: round(tip.x + (aw * cos - ah * sin)),
    y: round(tip.y + (aw * sin + ah * cos))
  }
  const pt2 = {
    x: round(tip.x + (aw * cos + ah * sin)),
    y: round(tip.y - (ah * cos - aw * sin))
  }
  return `M ${pt1.x} ${pt1.y} L ${round(tip.x)} ${round(tip.y)} L ${pt2.x} ${pt2.y}`
}
