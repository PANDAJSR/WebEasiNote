type Expression = (x: number) => number
const unary: Record<string, (value: number) => number> = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan,
  sqrt: Math.sqrt, abs: Math.abs, ln: Math.log, log: Math.log10, exp: Math.exp,
  sec: x => 1 / Math.cos(x), csc: x => 1 / Math.sin(x), cot: x => 1 / Math.tan(x)
}

/** 仅解释数学记号，不使用 eval 或动态 JavaScript；限制长度和嵌套。 */
export function compileMathExpression(source: string): Expression | null {
  if (source.length > 2048) return null
  const value = source.toLowerCase().replace(/^\s*y\s*=/, '').replace(/π/g, 'pi').replace(/×/g, '*').replace(/[−–]/g, '-')
  const tokens = value.match(/(?:\d*\.\d+|\d+\.?\d*)(?:e[+-]?\d+)?|[a-z]+|[+\-*/^(),]/g) || []
  if (tokens.join('') !== value.replace(/\s/g, '') || tokens.length > 512) return null
  let index = 0
  const parse = (minimum = 0, depth = 0): Expression => {
    if (depth > 64) throw new Error('嵌套过深')
    const token = tokens[index++]
    let left: Expression
    if (token === '+' || token === '-') {
      const operand = parse(3, depth + 1)
      left = x => token === '-' ? -operand(x) : operand(x)
    } else if (token === '(') {
      left = parse(0, depth + 1)
      if (tokens[index++] !== ')') throw new Error('缺少右括号')
    } else if (token === 'x') left = x => x
    else if (token === 'pi' || token === 'e') left = () => token === 'pi' ? Math.PI : Math.E
    else if (token && Object.prototype.hasOwnProperty.call(unary, token)) {
      if (tokens[index++] !== '(') throw new Error('缺少函数括号')
      const operand = parse(0, depth + 1)
      if (tokens[index++] !== ')') throw new Error('缺少右括号')
      left = x => unary[token](operand(x))
    } else if (token && Number.isFinite(Number(token))) left = () => Number(token)
    else throw new Error('不支持的表达式')
    while (index < tokens.length) {
      const operator = tokens[index]
      const implicit = operator === '(' || operator === 'x' || operator === 'pi' || operator === 'e' || Object.prototype.hasOwnProperty.call(unary, operator)
      const priority = operator === '^' ? 4 : operator === '*' || operator === '/' || implicit ? 2 : operator === '+' || operator === '-' ? 1 : 0
      if (!priority || priority < minimum) break
      if (!implicit) index++
      const right = parse(operator === '^' ? priority : priority + 1, depth + 1)
      const previous = left
      left = x => operator === '^' ? previous(x) ** right(x) : operator === '/' ? previous(x) / right(x)
        : operator === '+' ? previous(x) + right(x) : operator === '-' ? previous(x) - right(x) : previous(x) * right(x)
    }
    return left
  }
  try {
    const result = parse()
    return index === tokens.length ? result : null
  } catch { return null }
}

/** 在不连续点和裁剪区外断开路径，避免跨越渐近线。 */
export function functionPath(fn: Expression, width: number, height: number, origin: number[], pixelsPerUnit: number[]) {
  let path = ''
  let previous: number | undefined
  const samples = Math.min(2400, Math.max(400, Math.ceil(width * 2)))
  for (let i = 0; i <= samples; i++) {
    const px = i / samples * width
    const py = origin[1] - fn((px - origin[0]) / pixelsPerUnit[0]) * pixelsPerUnit[1]
    if (!Number.isFinite(py) || py < -height || py > height * 2) { previous = undefined; continue }
    path += `${previous === undefined || Math.abs(py - previous) > height / 2 ? 'M' : 'L'}${px.toFixed(2)},${py.toFixed(2)}`
    previous = py
  }
  return path
}
