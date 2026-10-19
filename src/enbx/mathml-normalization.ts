const MATHML_NS = 'http://www.w3.org/1998/Math/MathML'

// 官方 OperatorSymbols 使用旧 Symbol 字体的私用区编码。
const symbolCharacters: Record<string, string> = {
  '22': '∀', '24': '∃', '2f': '/', '3a': ':', '3d': '=',
  '40': '≅', '44': 'Δ', '57': 'Ω', '5c': '∴', '5e': '⊥',
  '61': 'α', '62': 'β', '63': 'χ', '64': 'δ', '65': 'ε', '67': 'γ',
  '68': 'η', '69': 'ι', '6a': 'φ', '6b': 'κ', '6c': 'λ', '6d': 'μ',
  '6e': 'ν', '6f': 'ο', '70': 'π', '71': 'θ', '72': 'ρ', '73': 'σ',
  '74': 'τ', '75': 'υ', '77': 'ω', '78': 'ξ', '79': 'ψ', '7a': 'ζ', '7c': '|',
  'a5': '∞', 'ab': '↔', 'ac': '←', 'ad': '↑', 'ae': '→',
  'b0': '°', 'b1': '±', 'b4': '×', 'b5': '∝', 'b8': '÷', 'b9': '≠',
  'ba': '≡', 'bb': '≈', 'bc': '…', 'ca': '⊇', 'cb': '⊄', 'cc': '⊂',
  'cd': '⊆', 'ce': '∈', 'cf': '∉', 'd5': '∏', 'd7': '⋅', 'd8': '¬',
  'd9': '∧', 'da': '∨', 'db': '⇔', 'de': '⇒', 'e5': '∑', 'ef': '|', 'f2': '∫'
}

function normalizeSymbols(text: string): string {
  return text.replace(/[\uf000-\uf0ff]/g, char =>
    symbolCharacters[(char.charCodeAt(0) - 0xf000).toString(16)] || char)
}

function createMathNode(node: Element, name: string): Element {
  return node.ownerDocument.createElementNS(MATHML_NS, name)
}

function fenceOperator(node: Element, text: string): Element {
  const operator = createMathNode(node, 'mo')
  operator.textContent = text
  operator.setAttribute('fence', 'true')
  operator.setAttribute('stretchy', 'true')
  return operator
}

/** 将希沃的 MathML 扩展与浏览器不支持的旧节点转换为 MathML Core。 */
export function normalizeMathML(root: Element) {
  function visit(node: Element) {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === 3) child.textContent = normalizeSymbols(child.textContent || '')
      else if (child.nodeType === 1) visit(child as Element)
    }

    if (node.localName === 'matom') {
      node.parentNode?.replaceChild(node.ownerDocument.createTextNode(node.textContent || ''), node)
    } else if (node.localName === 'mfenced') {
      const row = createMathNode(node, 'mrow')
      const open = node.getAttribute('open') ?? '('
      // 希沃分段函数只保存 open="{"，缺少 close 表示没有右括号。
      const close = node.getAttribute('close') ?? (open === '{' ? '' : ')')
      const separators = Array.from((node.getAttribute('separators') ?? ',').replace(/\s/g, ''))
      for (const attribute of Array.from(node.attributes)) {
        if (!['open', 'close', 'separators'].includes(attribute.name)) row.setAttribute(attribute.name, attribute.value)
      }
      if (open) row.appendChild(fenceOperator(node, open))
      Array.from(node.children).forEach((child, index) => {
        if (index > 0 && separators.length) {
          const separator = createMathNode(node, 'mo')
          separator.textContent = separators[Math.min(index - 1, separators.length - 1)]
          row.appendChild(separator)
        }
        row.appendChild(child)
      })
      if (close) row.appendChild(fenceOperator(node, close))
      node.parentNode?.replaceChild(row, node)
    } else if (node.localName === 'mroot' && node.children.length === 2 && !node.children[1].textContent?.trim()) {
      const sqrt = createMathNode(node, 'msqrt')
      for (const attribute of Array.from(node.attributes)) sqrt.setAttribute(attribute.name, attribute.value)
      sqrt.appendChild(node.children[0])
      node.parentNode?.replaceChild(sqrt, node)
    } else if (node.localName === 'mover') {
      const over = node.children[1]
      if (over?.textContent?.trim() === '\u0305') {
        over.textContent = '¯'
        node.setAttribute('accent', 'true')
        const operator = over.localName === 'mo' ? over : createMathNode(node, 'mo')
        operator.textContent = '¯'
        operator.setAttribute('stretchy', 'true')
        if (operator !== over) node.replaceChild(operator, over)
      }
    }
  }
  visit(root)
}
