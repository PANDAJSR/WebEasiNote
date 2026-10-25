interface Point { x: number; y: number }

function parseSegments(path: string): Point[][] | null {
  const tokens = path.match(/[a-zA-Z]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) || []
  let i = 0
  let command = ''
  let point: Point = { x: 0, y: 0 }
  const segments: Point[][] = []
  while (i < tokens.length) {
    if (/^[a-z]$/i.test(tokens[i])) command = tokens[i++]
    const upper = command.toUpperCase()
    const count = upper === 'M' || upper === 'L' ? 2 : upper === 'Q' ? 4 : upper === 'C' ? 6 : 0
    if (!count || i + count > tokens.length) return null
    const values = tokens.slice(i, i + count).map(Number)
    if (!values.every(Number.isFinite)) return null
    i += count
    const points = [point]
    for (let j = 0; j < count; j += 2) points.push({
      x: values[j] + (command === upper ? 0 : point.x),
      y: values[j + 1] + (command === upper ? 0 : point.y)
    })
    if (upper !== 'M') segments.push(points)
    point = points[points.length - 1]
    if (upper === 'M') command = command === 'M' ? 'L' : 'l'
  }
  return segments
}

function evaluate(points: Point[], t: number): Point {
  const u = 1 - t
  const weights = points.length === 4 ? [u ** 3, 3 * u * u * t, 3 * u * t * t, t ** 3]
    : points.length === 3 ? [u * u, 2 * u * t, t * t] : [u, t]
  return {
    x: points.reduce((v, p, n) => v + p.x * weights[n], 0),
    y: points.reduce((v, p, n) => v + p.y * weights[n], 0)
  }
}

/** 官方 FreeLine 箭头取首段 t=0.05、末段 t=0.95 的曲线点确定朝向。 */
export function bezierArrowReferences(path: string) {
  const segments = parseSegments(path)
  if (!segments?.length) return undefined
  return { start: evaluate(segments[0], 0.05), end: evaluate(segments[segments.length - 1], 0.95) }
}

/** FreeLine 使用曲线实际极值，控制点包围盒会压扁弯曲程度。 */
export function bezierPathBounds(path: string) {
  const segments = parseSegments(path)
  if (!segments?.length) return null
  const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  const include = (p: Point) => {
    bounds.minX = Math.min(bounds.minX, p.x)
    bounds.minY = Math.min(bounds.minY, p.y)
    bounds.maxX = Math.max(bounds.maxX, p.x)
    bounds.maxY = Math.max(bounds.maxY, p.y)
  }
  for (const points of segments) {
    include(points[0])
    include(points[points.length - 1])
    if (points.length > 2) {
      const cubic = points.length === 4
      for (const axis of ['x', 'y'] as const) {
        const [p0, p1, p2, p3] = points.map(p => p[axis])
        const a = cubic ? -p0 + 3 * p1 - 3 * p2 + p3 : 0
        const b = cubic ? 2 * (p0 - 2 * p1 + p2) : p0 - 2 * p1 + p2
        const c = p1 - p0
        const discriminant = b * b - 4 * a * c
        const roots = Math.abs(a) < 1e-12 ? (Math.abs(b) < 1e-12 ? [] : [-c / b])
          : discriminant < 0 ? [] : [(-b + Math.sqrt(discriminant)) / (2 * a), (-b - Math.sqrt(discriminant)) / (2 * a)]
        for (const t of roots) if (t > 0 && t < 1) include(evaluate(points, t))
      }
    }
  }
  return Number.isFinite(bounds.minX) ? bounds : null
}
