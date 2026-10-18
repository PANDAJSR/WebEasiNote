/**
 * Web 端针对常见形状的近似 SVG 路径生成器。
 * 官方 ShapeSaveInfo 将 Geometry 声明为必需字段，Path 为可选字段；官方在载入
 * 已知 ShapeType 时由形状类生成几何，Path 主要作为序列化路径数据及未知形状的回退。
 * 这里的几何公式不是官方实现的逐项复刻，且不会覆盖所有官方 ShapeType。
 *
 * 直线类（Line/DashLine/FreeLine/LineArrowEnd/LineArrowStartEnd）例外：
 * 官方 `LineShape.SetGeometrySaveInfo` 用 Adjusts 的两个端点（ScaleX/ScaleY × Size）
 * 直接确定线段，因此这里按同样的方式还原，避免斜线被画成水平线。
 */

export interface AdjustPoint {
  x: number
  y: number
}

/**
 * 复刻官方 LineShape.SetGeometrySaveInfo：
 * 端点 = (adjust.ScaleX × width, adjust.ScaleY × height)，
 * 当两个端点的四个分量全为 0 时，第二个端点退化为 (1, 1)。
 */
function resolveLinePoints(
  width: number,
  height: number,
  adjustPairs?: AdjustPoint[]
): [AdjustPoint, AdjustPoint] {
  if (adjustPairs && adjustPairs.length >= 2) {
    let [a, b] = adjustPairs
    if (a.x === 0 && a.y === 0 && b.x === 0 && b.y === 0) {
      b = { x: 1, y: 1 }
    }
    return [
      { x: a.x * width, y: a.y * height },
      { x: b.x * width, y: b.y * height }
    ]
  }
  return [
    { x: 0, y: height / 2 },
    { x: width, y: height / 2 }
  ]
}

export function generatePresetGeometryPath(
  geometryType: string,
  width: number,
  height: number,
  adjusts?: number[],
  adjustPairs?: AdjustPoint[]
): string {
  const w = Math.max(1, width)
  const h = Math.max(1, height)
  const normType = (geometryType || '').trim().toLowerCase()

  switch (normType) {
    case 'rectangle':
    case 'rect':
    case 'rectanglemark':
      return `M 0 0 H ${w} V ${h} H 0 Z`

    case 'roundrectangle':
    case 'roundrect': {
      const defaultRadius = Math.min(w, h) * 0.15
      const adj = adjusts && adjusts.length > 0 ? adjusts[0] : null
      const r = adj !== null ? Math.max(0, Math.min(Math.min(w, h) / 2, adj * Math.min(w, h))) : defaultRadius
      if (r <= 0) return `M 0 0 H ${w} V ${h} H 0 Z`
      return `M ${r} 0 H ${w - r} A ${r} ${r} 0 0 1 ${w} ${r} V ${h - r} A ${r} ${r} 0 0 1 ${w - r} ${h} H ${r} A ${r} ${r} 0 0 1 0 ${h - r} V ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`
    }

    case 'circle':
    case 'ellipse': {
      const rx = w / 2
      const ry = h / 2
      return `M ${rx} 0 A ${rx} ${ry} 0 1 0 ${rx} ${h} A ${rx} ${ry} 0 1 0 ${rx} 0 Z`
    }

    case 'triangle':
      return `M ${w / 2} 0 L ${w} ${h} L 0 ${h} Z`

    case 'righttriangle':
      return `M 0 0 L ${w} ${h} L 0 ${h} Z`

    case 'trapezoid': {
      const indent = w * 0.2
      return `M ${indent} 0 L ${w - indent} 0 L ${w} ${h} L 0 ${h} Z`
    }

    case 'rhomboid':
    case 'parallelogram': {
      const skew = w * 0.25
      return `M ${skew} 0 L ${w} 0 L ${w - skew} ${h} L 0 ${h} Z`
    }

    case 'rhombus':
    case 'diamond':
      return `M ${w / 2} 0 L ${w} ${h / 2} L ${w / 2} ${h} L 0 ${h / 2} Z`

    case 'curverhombus':
      return `M ${w / 2} 0 Q ${w * 0.65} ${h * 0.35} ${w} ${h / 2} Q ${w * 0.65} ${h * 0.65} ${w / 2} ${h} Q ${w * 0.35} ${h * 0.65} 0 ${h / 2} Q ${w * 0.35} ${h * 0.35} ${w / 2} 0 Z`

    case 'polygon':
    case 'pentagon': {
      // 正五边形
      const cx = w / 2
      const cy = h / 2
      const rx = w / 2
      const ry = h / 2
      const points: string[] = []
      for (let i = 0; i < 5; i++) {
        const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 5
        const px = cx + rx * Math.cos(angle)
        const py = cy + ry * Math.sin(angle)
        points.push(`${i === 0 ? 'M' : 'L'} ${px.toFixed(2)} ${py.toFixed(2)}`)
      }
      return `${points.join(' ')} Z`
    }

    case 'hexagon': {
      const cx = w / 2
      const cy = h / 2
      const rx = w / 2
      const ry = h / 2
      const points: string[] = []
      for (let i = 0; i < 6; i++) {
        const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 6
        const px = cx + rx * Math.cos(angle)
        const py = cy + ry * Math.sin(angle)
        points.push(`${i === 0 ? 'M' : 'L'} ${px.toFixed(2)} ${py.toFixed(2)}`)
      }
      return `${points.join(' ')} Z`
    }

    case 'octagon': {
      const corner = Math.min(w, h) * 0.2929
      return `M ${corner} 0 L ${w - corner} 0 L ${w} ${corner} L ${w} ${h - corner} L ${w - corner} ${h} L ${corner} ${h} L 0 ${h - corner} L 0 ${corner} Z`
    }

    case 'star':
    case 'star5': {
      // 五角星
      const cx = w / 2
      const cy = h / 2
      const rx = w / 2
      const ry = h / 2
      const irx = rx * 0.382
      const iry = ry * 0.382
      const points: string[] = []
      for (let i = 0; i < 10; i++) {
        const angle = -Math.PI / 2 + (i * Math.PI) / 5
        const r_x = i % 2 === 0 ? rx : irx
        const r_y = i % 2 === 0 ? ry : iry
        const px = cx + r_x * Math.cos(angle)
        const py = cy + r_y * Math.sin(angle)
        points.push(`${i === 0 ? 'M' : 'L'} ${px.toFixed(2)} ${py.toFixed(2)}`)
      }
      return `${points.join(' ')} Z`
    }

    case 'star4': {
      const cx = w / 2
      const cy = h / 2
      const rx = w / 2
      const ry = h / 2
      const irx = rx * 0.25
      const iry = ry * 0.25
      const points: string[] = []
      for (let i = 0; i < 8; i++) {
        const angle = -Math.PI / 2 + (i * Math.PI) / 4
        const r_x = i % 2 === 0 ? rx : irx
        const r_y = i % 2 === 0 ? ry : iry
        const px = cx + r_x * Math.cos(angle)
        const py = cy + r_y * Math.sin(angle)
        points.push(`${i === 0 ? 'M' : 'L'} ${px.toFixed(2)} ${py.toFixed(2)}`)
      }
      return `${points.join(' ')} Z`
    }

    case 'star6': {
      const cx = w / 2
      const cy = h / 2
      const rx = w / 2
      const ry = h / 2
      const irx = rx * 0.5
      const iry = ry * 0.5
      const points: string[] = []
      for (let i = 0; i < 12; i++) {
        const angle = -Math.PI / 2 + (i * Math.PI) / 6
        const r_x = i % 2 === 0 ? rx : irx
        const r_y = i % 2 === 0 ? ry : iry
        const px = cx + r_x * Math.cos(angle)
        const py = cy + r_y * Math.sin(angle)
        points.push(`${i === 0 ? 'M' : 'L'} ${px.toFixed(2)} ${py.toFixed(2)}`)
      }
      return `${points.join(' ')} Z`
    }

    case 'line':
    case 'dashline':
    case 'freeline': {
      const [p0, p1] = resolveLinePoints(w, h, adjustPairs)
      return `M ${p0.x.toFixed(2)} ${p0.y.toFixed(2)} L ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`
    }

    // 箭头由 ShapeRenderer 按官方 GetArrowPoints 几何单独绘制，此处只生成直线段
    case 'linearrowend':
    case 'linearrowstartend': {
      const [p0, p1] = resolveLinePoints(w, h, adjustPairs)
      return `M ${p0.x.toFixed(2)} ${p0.y.toFixed(2)} L ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`
    }

    case 'arrowend':
    case 'blockarrow': {
      const headW = Math.min(w * 0.35, 45)
      const stemH = h * 0.4
      const stemTop = (h - stemH) / 2
      const stemBottom = stemTop + stemH
      return `M 0 ${stemTop} H ${w - headW} V 0 L ${w} ${h / 2} L ${w - headW} ${h} V ${stemBottom} H 0 Z`
    }

    case 'arrowstartend': {
      const headW = Math.min(w * 0.25, 40)
      const stemH = h * 0.4
      const stemTop = (h - stemH) / 2
      const stemBottom = stemTop + stemH
      return `M ${headW} 0 L 0 ${h / 2} L ${headW} ${h} V ${stemBottom} H ${w - headW} V ${h} L ${w} ${h / 2} L ${w - headW} 0 V ${stemTop} H ${headW} Z`
    }

    case 'arrowswallow': {
      const headW = Math.min(w * 0.35, 45)
      const stemH = h * 0.4
      const stemTop = (h - stemH) / 2
      const stemBottom = stemTop + stemH
      const swallow = headW * 0.5
      return `M 0 ${stemTop} L ${swallow} ${h / 2} L 0 ${stemBottom} H ${w - headW} V ${h} L ${w} ${h / 2} L ${w - headW} 0 V ${stemTop} Z`
    }

    case 'curvearrow': {
      return `M 0 ${h} Q 0 0 ${w * 0.7} 0 V ${-h * 0.15} L ${w} ${h * 0.15} L ${w * 0.7} ${h * 0.3} V ${h * 0.15} Q ${w * 0.15} ${h * 0.15} ${w * 0.15} ${h} Z`
    }

    case 'circlebubble': {
      const rx = w / 2
      const ry = h * 0.42
      return `M ${rx} 0 A ${rx} ${ry} 0 0 1 ${w} ${ry} A ${rx} ${ry} 0 0 1 ${w * 0.65} ${h * 0.82} L ${w * 0.5} ${h} L ${w * 0.42} ${h * 0.82} A ${rx} ${ry} 0 0 1 0 ${ry} A ${rx} ${ry} 0 0 1 ${rx} 0 Z`
    }

    case 'rectanglebubble': {
      const r = Math.min(w, h) * 0.1
      const bodyH = h * 0.8
      return `M ${r} 0 H ${w - r} A ${r} ${r} 0 0 1 ${w} ${r} V ${bodyH - r} A ${r} ${r} 0 0 1 ${w - r} ${bodyH} H ${w * 0.45} L ${w * 0.3} ${h} L ${w * 0.3} ${bodyH} H ${r} A ${r} ${r} 0 0 1 0 ${bodyH - r} V ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`
    }

    case 'love':
    case 'heart':
      return `M ${w * 0.5} ${h * 0.28} C ${w * 0.5} ${h * 0.15} ${w * 0.35} 0 ${w * 0.2} 0 C ${w * 0.08} 0 0 ${h * 0.15} 0 ${h * 0.35} C 0 ${h * 0.6} ${w * 0.3} ${h * 0.8} ${w * 0.5} ${h} C ${w * 0.7} ${h * 0.8} ${w} ${h * 0.6} ${w} ${h * 0.35} C ${w} ${h * 0.15} ${w * 0.92} 0 ${w * 0.8} 0 C ${w * 0.65} 0 ${w * 0.5} ${h * 0.15} ${w * 0.5} ${h * 0.28} Z`

    case 'moon': {
      const rx = w / 2
      const ry = h / 2
      return `M ${w * 0.55} 0 A ${rx} ${ry} 0 1 0 ${w * 0.55} ${h} A ${rx * 0.85} ${ry * 0.85} 0 0 1 ${w * 0.55} 0 Z`
    }

    case 'sun': {
      const cx = w / 2
      const cy = h / 2
      const rOuter = Math.min(w, h) / 2
      const rInner = rOuter * 0.65
      const points: string[] = []
      for (let i = 0; i < 16; i++) {
        const angle = (i * Math.PI) / 8
        const r = i % 2 === 0 ? rOuter : rInner
        const px = cx + r * Math.cos(angle)
        const py = cy + r * Math.sin(angle)
        points.push(`${i === 0 ? 'M' : 'L'} ${px.toFixed(2)} ${py.toFixed(2)}`)
      }
      return `${points.join(' ')} Z`
    }

    case 'cloud': {
      return `M ${(w * 0.2).toFixed(1)} ${(h * 0.8).toFixed(1)} A ${(w * 0.18).toFixed(1)} ${(h * 0.25).toFixed(1)} 0 0 1 ${(w * 0.15).toFixed(1)} ${(h * 0.45).toFixed(1)} A ${(w * 0.22).toFixed(1)} ${(h * 0.32).toFixed(1)} 0 0 1 ${(w * 0.42).toFixed(1)} ${(h * 0.22).toFixed(1)} A ${(w * 0.28).toFixed(1)} ${(h * 0.38).toFixed(1)} 0 0 1 ${(w * 0.78).toFixed(1)} ${(h * 0.32).toFixed(1)} A ${(w * 0.18).toFixed(1)} ${(h * 0.25).toFixed(1)} 0 0 1 ${(w * 0.92).toFixed(1)} ${(h * 0.65).toFixed(1)} A ${(w * 0.15).toFixed(1)} ${(h * 0.22).toFixed(1)} 0 0 1 ${(w * 0.8).toFixed(1)} ${(h * 0.85).toFixed(1)} H ${(w * 0.22).toFixed(1)} Z`
    }

    case 'thunder':
    case 'lightning': {
      return `M ${(w * 0.55).toFixed(1)} 0 L ${(w * 0.15).toFixed(1)} ${(h * 0.55).toFixed(1)} H ${(w * 0.48).toFixed(1)} L ${(w * 0.32).toFixed(1)} ${h} L ${(w * 0.85).toFixed(1)} ${(h * 0.42).toFixed(1)} H ${(w * 0.52).toFixed(1)} Z`
    }

    case 'bomb':
    case 'explosion': {
      const cx = w / 2
      const cy = h / 2
      const rOuter = Math.min(w, h) / 2
      const rInner = rOuter * 0.5
      const points: string[] = []
      for (let i = 0; i < 20; i++) {
        const angle = (i * Math.PI) / 10
        const r = i % 2 === 0 ? rOuter : rInner
        const px = cx + r * Math.cos(angle)
        const py = cy + r * Math.sin(angle)
        points.push(`${i === 0 ? 'M' : 'L'} ${px.toFixed(2)} ${py.toFixed(2)}`)
      }
      return `${points.join(' ')} Z`
    }

    case 'flag': {
      return `M 0 0 H ${w} L ${w * 0.8} ${h / 2} L ${w} ${h} H 0 Z`
    }

    case 'brace':
    case 'leftbrace':
    case 'custom_pptx_leftbrace': {
      // 大括号 (左大括号，尖端朝左，开口向右包围右侧文字)
      const halfH = h / 2
      const tipW = Math.min(w * 0.5, 20)
      return `M ${w} 0 Q ${w - tipW} 0 ${w - tipW} ${halfH * 0.5} Q ${w - tipW} ${halfH} 0 ${halfH} Q ${w - tipW} ${halfH} ${w - tipW} ${halfH * 1.5} Q ${w - tipW} ${h} ${w} ${h}`
    }

    case 'rightbrace':
    case 'custom_pptx_rightbrace': {
      // 右大括号，尖端朝右，开口向左
      const halfH = h / 2
      const tipW = Math.min(w * 0.5, 20)
      return `M 0 0 Q ${tipW} 0 ${tipW} ${halfH * 0.5} Q ${tipW} ${halfH} ${w} ${halfH} Q ${tipW} ${halfH} ${tipW} ${halfH * 1.5} Q ${tipW} ${h} 0 ${h}`
    }

    case 'bracket': {
      // 中括号
      const tipW = Math.min(w * 0.5, 15)
      return `M ${w} 0 H ${w - tipW} V ${h} H ${w}`
    }

    case 'fan': {
      const rx = w
      const ry = h
      return `M 0 ${h} L 0 0 A ${rx} ${ry} 0 0 1 ${w} ${h} Z`
    }

    default:
      // 未知形状 fallback 为标准矩形
      return `M 0 0 H ${w} V ${h} H 0 Z`
  }
}
