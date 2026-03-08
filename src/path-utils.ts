interface PathBounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

interface ParseContext {
  globalBounds: PathBounds | null
  subpathBounds: PathBounds[]
}

const TOKEN_REGEX = /[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+)(?:e[-+]?\d+)?/g

/**
 * 估算 SVG Path 的边界框
 * 说明：为性能与稳健性考虑，仅根据命令参数做近似边界估算
 */
export function estimatePathBounds(path: string): PathBounds | null {
  const parsed = parsePath(path)
  return parsed?.globalBounds || null
}

/**
 * 推断填充规则：
 * - 检测到内嵌闭合轮廓时，优先使用 evenodd 以保持“挖空”视觉一致
 * - 其余情况保持 nonzero（浏览器默认）
 */
export function inferFillRule(path: string): 'nonzero' | 'evenodd' | undefined {
  const parsed = parsePath(path)
  if (!parsed) return undefined
  const { subpathBounds } = parsed
  if (subpathBounds.length < 2) return undefined

  for (let i = 0; i < subpathBounds.length; i += 1) {
    for (let j = 0; j < subpathBounds.length; j += 1) {
      if (i === j) continue
      const outer = subpathBounds[i]
      const inner = subpathBounds[j]
      if (isBoundsNested(inner, outer)) {
        return 'evenodd'
      }
    }
  }

  return undefined
}

function parsePath(path: string): ParseContext | null {
  if (!path || !path.trim()) return null

  const tokens = path.match(TOKEN_REGEX)
  if (!tokens || tokens.length === 0) return null

  let index = 0
  let command = ''
  let cx = 0
  let cy = 0
  let sx = 0
  let sy = 0
  let currentSubpath: PathBounds | null = null

  const context: ParseContext = {
    globalBounds: null,
    subpathBounds: [],
  }

  const isCommandToken = (value: string): boolean => /^[a-zA-Z]$/.test(value)
  const hasNextNumber = (): boolean => index < tokens.length && !isCommandToken(tokens[index])
  const readNumber = (): number | null => {
    if (!hasNextNumber()) return null
    const value = Number(tokens[index])
    index += 1
    return Number.isFinite(value) ? value : null
  }

  const includePoint = (x: number, y: number) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return
    context.globalBounds = includeInBounds(context.globalBounds, x, y)
    currentSubpath = includeInBounds(currentSubpath, x, y)
  }

  const closeSubpath = () => {
    if (currentSubpath) {
      context.subpathBounds.push(currentSubpath)
    }
    currentSubpath = null
  }

  while (index < tokens.length) {
    if (isCommandToken(tokens[index])) {
      command = tokens[index]
      index += 1
      if (command === 'M' || command === 'm') {
        closeSubpath()
      }
    }
    if (!command) break

    switch (command) {
      case 'M':
      case 'L':
      case 'T': {
        while (hasNextNumber()) {
          const x = readNumber()
          const y = readNumber()
          if (x === null || y === null) break
          cx = x
          cy = y
          includePoint(cx, cy)
          if (command === 'M') {
            sx = cx
            sy = cy
            command = 'L'
          }
        }
        break
      }
      case 'm':
      case 'l':
      case 't': {
        while (hasNextNumber()) {
          const dx = readNumber()
          const dy = readNumber()
          if (dx === null || dy === null) break
          cx += dx
          cy += dy
          includePoint(cx, cy)
          if (command === 'm') {
            sx = cx
            sy = cy
            command = 'l'
          }
        }
        break
      }
      case 'H': {
        while (hasNextNumber()) {
          const x = readNumber()
          if (x === null) break
          cx = x
          includePoint(cx, cy)
        }
        break
      }
      case 'h': {
        while (hasNextNumber()) {
          const dx = readNumber()
          if (dx === null) break
          cx += dx
          includePoint(cx, cy)
        }
        break
      }
      case 'V': {
        while (hasNextNumber()) {
          const y = readNumber()
          if (y === null) break
          cy = y
          includePoint(cx, cy)
        }
        break
      }
      case 'v': {
        while (hasNextNumber()) {
          const dy = readNumber()
          if (dy === null) break
          cy += dy
          includePoint(cx, cy)
        }
        break
      }
      case 'C': {
        while (hasNextNumber()) {
          const x1 = readNumber()
          const y1 = readNumber()
          const x2 = readNumber()
          const y2 = readNumber()
          const x = readNumber()
          const y = readNumber()
          if ([x1, y1, x2, y2, x, y].some(v => v === null)) break
          includePoint(x1 as number, y1 as number)
          includePoint(x2 as number, y2 as number)
          cx = x as number
          cy = y as number
          includePoint(cx, cy)
        }
        break
      }
      case 'c': {
        while (hasNextNumber()) {
          const dx1 = readNumber()
          const dy1 = readNumber()
          const dx2 = readNumber()
          const dy2 = readNumber()
          const dx = readNumber()
          const dy = readNumber()
          if ([dx1, dy1, dx2, dy2, dx, dy].some(v => v === null)) break
          includePoint(cx + (dx1 as number), cy + (dy1 as number))
          includePoint(cx + (dx2 as number), cy + (dy2 as number))
          cx += dx as number
          cy += dy as number
          includePoint(cx, cy)
        }
        break
      }
      case 'S':
      case 'Q': {
        while (hasNextNumber()) {
          const x1 = readNumber()
          const y1 = readNumber()
          const x = readNumber()
          const y = readNumber()
          if ([x1, y1, x, y].some(v => v === null)) break
          includePoint(x1 as number, y1 as number)
          cx = x as number
          cy = y as number
          includePoint(cx, cy)
        }
        break
      }
      case 's':
      case 'q': {
        while (hasNextNumber()) {
          const dx1 = readNumber()
          const dy1 = readNumber()
          const dx = readNumber()
          const dy = readNumber()
          if ([dx1, dy1, dx, dy].some(v => v === null)) break
          includePoint(cx + (dx1 as number), cy + (dy1 as number))
          cx += dx as number
          cy += dy as number
          includePoint(cx, cy)
        }
        break
      }
      case 'A': {
        while (hasNextNumber()) {
          const rx = readNumber()
          const ry = readNumber()
          const rotate = readNumber()
          const largeArcFlag = readNumber()
          const sweepFlag = readNumber()
          const x = readNumber()
          const y = readNumber()
          if ([rx, ry, rotate, largeArcFlag, sweepFlag, x, y].some(v => v === null)) break
          cx = x as number
          cy = y as number
          includePoint(cx, cy)
        }
        break
      }
      case 'a': {
        while (hasNextNumber()) {
          const rx = readNumber()
          const ry = readNumber()
          const rotate = readNumber()
          const largeArcFlag = readNumber()
          const sweepFlag = readNumber()
          const dx = readNumber()
          const dy = readNumber()
          if ([rx, ry, rotate, largeArcFlag, sweepFlag, dx, dy].some(v => v === null)) break
          cx += dx as number
          cy += dy as number
          includePoint(cx, cy)
        }
        break
      }
      case 'Z':
      case 'z': {
        cx = sx
        cy = sy
        includePoint(cx, cy)
        closeSubpath()
        break
      }
      default: {
        while (hasNextNumber()) {
          index += 1
        }
      }
    }
  }

  closeSubpath()

  if (!context.globalBounds) return null
  return context
}

function includeInBounds(bounds: PathBounds | null, x: number, y: number): PathBounds {
  if (!bounds) {
    return { minX: x, minY: y, maxX: x, maxY: y }
  }

  if (x < bounds.minX) bounds.minX = x
  if (x > bounds.maxX) bounds.maxX = x
  if (y < bounds.minY) bounds.minY = y
  if (y > bounds.maxY) bounds.maxY = y
  return bounds
}

function isBoundsNested(inner: PathBounds, outer: PathBounds): boolean {
  const epsilon = 1e-6
  const innerWidth = inner.maxX - inner.minX
  const innerHeight = inner.maxY - inner.minY
  const outerWidth = outer.maxX - outer.minX
  const outerHeight = outer.maxY - outer.minY
  if (innerWidth <= 0 || innerHeight <= 0 || outerWidth <= 0 || outerHeight <= 0) return false

  const inside =
    inner.minX >= outer.minX - epsilon
    && inner.maxX <= outer.maxX + epsilon
    && inner.minY >= outer.minY - epsilon
    && inner.maxY <= outer.maxY + epsilon
  if (!inside) return false

  const areaRatio = (innerWidth * innerHeight) / (outerWidth * outerHeight)
  return areaRatio < 0.92
}
