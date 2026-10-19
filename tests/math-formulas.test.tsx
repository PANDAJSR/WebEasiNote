import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Window } from 'happy-dom'
import { parseMathFormulaElement } from '../src/enbx/math-formulas'

const dom = new Window()
Object.assign(globalThis, { DOMParser: dom.DOMParser, XMLSerializer: dom.XMLSerializer })

function parseFormula(body: string) {
  const node = new dom.DOMParser().parseFromString('<MathFormula><Id>formula</Id><Width>488.567</Width><Height>96.312</Height><MathML/></MathFormula>', 'text/xml').documentElement
  node.querySelector('MathML')!.textContent = `<?xml version="1.0" encoding="utf-8"?><math xmlns="http://www.w3.org/1998/Math/MathML">${body}</math>`
  const formula = parseMathFormulaElement(node as unknown as Element)!
  assert.ok(formula.mathML)
  return { formula, math: new dom.DOMParser().parseFromString(formula.mathML, 'text/xml') }
}

test('全称量词课件的 Symbol 私用区编码转换为可显示的 Unicode', () => {
  const { formula } = parseFormula('<mrow><mo>\uf022</mo><mi><matom>x</matom></mi><mo>\uf0ce</mo><mi><matom>R</matom></mi><mo>,</mo><msup><mi>x</mi><mn>2</mn></msup><mo>+</mo><mn>1</mn><mo>≥</mo><mn>1</mn></mrow>')
  assert.equal(formula.fallbackText, '∀x∈R,x2+1≥1')
  assert.doesNotMatch(formula.mathML, /[\uf000-\uf0ff]|matom/)
  const { formula: operators } = parseFormula('<mrow><mo>\uf0b4\uf0d7\uf024\uf0b9\uf03d</mo><mtext>≥≤中文\uf8ff</mtext></mrow>')
  assert.equal(operators.fallbackText, '×⋅∃≠=≥≤中文\uf8ff')
})

test('空指数根式转换为平方根，保留有指数的根式', () => {
  const { math } = parseFormula('<mrow><mroot><mi>ab</mi><mrow><matom/></mrow></mroot><mroot><mi>a</mi><mn>3</mn></mroot></mrow>')
  assert.equal(math.querySelectorAll('msqrt').length, 1)
  assert.equal(math.querySelector('msqrt')?.textContent, 'ab')
  assert.equal(math.querySelectorAll('mroot').length, 1)
  assert.equal(math.querySelector('mroot')?.children[1].textContent, '3')
})

test('恢复嵌套括号、绝对值、单边分段大括号与均值横线', () => {
  const { math, formula } = parseFormula('<mrow><mfenced open="|" close="|"><mi>a</mi></mfenced><mo>=</mo><mfenced open="{"><mtable><mtr><mtd><mi>a</mi><mfenced open="(" close=")"><mrow><mi>a</mi><mo>≥</mo><mn>0</mn></mrow></mfenced></mtd></mtr></mtable></mfenced><mover><mi>x</mi><mrow><mo>̅</mo></mrow></mover></mrow>')
  assert.equal(math.querySelectorAll('mfenced').length, 0)
  assert.deepEqual(Array.from(math.querySelectorAll('mo[fence]'), node => node.textContent), ['|', '|', '{', '(', ')'])
  assert.ok(Array.from(math.querySelectorAll('mo[fence]')).every(node => node.getAttribute('stretchy') === 'true'))
  assert.equal(math.querySelector('mover')?.getAttribute('accent'), 'true')
  assert.equal(math.querySelector('mover')?.children[1].textContent, '¯')
  assert.ok(formula.fallbackText.includes('|a|={a(a≥0)'))
})

test('显式空括号与分隔符按 MathML 规则保留', () => {
  const { formula } = parseFormula('<mfenced open="" close="" separators="; ,"><mi>a</mi><mi>b</mi><mi>c</mi><mi>d</mi></mfenced>')
  assert.equal(formula.fallbackText, 'a;b,c,d')
})
