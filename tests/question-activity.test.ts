import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Window } from 'happy-dom'
import { parseQuestionConfig } from '../src/enbx/activities/question-config'
import { getQuestionSession, gradeQuestion, resetQuestionSession } from '../src/components/activities/question-session'
import type { ActivityDefinition } from '../src/types'

const dom = new Window()
Object.assign(globalThis, { XMLSerializer: dom.XMLSerializer })
const xml = (value: string) => new dom.DOMParser().parseFromString(value, 'text/xml').documentElement as unknown as Element
const jsonConfig = (value: unknown) => {
  const config = new dom.DOMParser().parseFromString('<Config />', 'text/xml').documentElement
  config.textContent = JSON.stringify(value)
  return config as unknown as Element
}
const options = [
  { Option: { Text: 'A' }, Answer: true },
  { Option: { Text: 'B' }, Answer: false },
  { Option: { Text: 'C' }, Answer: true }
]

test('Choice legacy JSON preserves exact multi-answer sets and rejects unknown or duplicate selections', () => {
  const parsed = parseQuestionConfig('Choice', jsonConfig({ ChoiceQuestions: [{ Title: { Text: '选出答案' }, OptionItems: options }] }))
  assert.deepEqual(parsed.diagnostics, [])
  const question = parsed.questions[0]
  assert.equal(gradeQuestion(question, ['option-2', 'option-0']), true)
  for (const selected of [[], ['option-0'], ['option-0', 'option-1', 'option-2'], ['option-0', 'option-2', 'unknown'], ['option-0', 'option-0', 'option-2']]) {
    assert.equal(gradeQuestion(question, selected), false)
  }
})

test('Choice typed XML reads RichText TextLines in document order', () => {
  const rich = (value: string) => `<RichText><TextLines><TextLine><TextRuns><TextRun><Text>${value}</Text></TextRun></TextRuns></TextLine></TextLines></RichText>`
  const result = parseQuestionConfig('Choice', xml(`<Config><ChoiceActivityConfig><ChoiceQuestions><ChoiceQuestion>
    <Title>${rich('问题 &amp; 标题')}</Title><OptionItems>
    <OptionItem><Option>${rich('是')}</Option><Answer>true</Answer></OptionItem>
    <OptionItem><Option>${rich('否')}</Option><Answer>false</Answer></OptionItem>
    </OptionItems></ChoiceQuestion></ChoiceQuestions></ChoiceActivityConfig></Config>`))
  assert.deepEqual(result.diagnostics, [])
  assert.equal(result.questions[0].text, '问题 & 标题')
  assert.equal(result.questions[0].options[1].text, '否')
})

test('Judge accepts explicit false and grades true/false independently', () => {
  const result = parseQuestionConfig('Judge', xml('<Config><JudgeConfig><JudgeItems><JudgeItem><Text>地球是平的</Text><Answer>False</Answer><Contents /></JudgeItem></JudgeItems></JudgeConfig></Config>'))
  assert.deepEqual(result.diagnostics, [])
  assert.equal(gradeQuestion(result.questions[0], ['false']), true)
  assert.equal(gradeQuestion(result.questions[0], ['true']), false)
})

test('Judge fails closed for missing, null, numeric, and string answers', () => {
  for (const answer of [undefined, null, 0, 'false']) {
    const result = parseQuestionConfig('Judge', jsonConfig({ JudgeItems: [{ Text: '题目', Answer: answer }] }))
    assert.equal(result.questions.length, 0)
    assert.equal(result.diagnostics.length, 1)
  }
})

test('one invalid question disables the entire activity', () => {
  const result = parseQuestionConfig('Judge', jsonConfig({ JudgeItems: [{ Text: '有效', Answer: true }, { Text: '无效', Answer: null }] }))
  assert.deepEqual(result.questions, [])
})

test('unresolved Judge contents and unsupported competition never produce playable text substitutes', () => {
  const result = parseQuestionConfig('Judge', xml('<Config><JudgeConfig><JudgeItems><JudgeItem><Text>图片判断</Text><Answer>true</Answer><Contents><ElementRef>missing</ElementRef></Contents></JudgeItem></JudgeItems></JudgeConfig></Config>'))
  assert.equal(result.questions.length, 0)
  assert.match(result.diagnostics[0], /内嵌元素/)
  assert.equal(parseQuestionConfig('GroupCompetition', jsonConfig({ Items: [] })).questions.length, 0)
})

test('strict XML rejects wrong contracts, duplicate answer fields, empty lists, and zero correct choices', () => {
  for (const value of [
    '<Config><ChoiceActivityConfig /></Config>',
    '<Config><JudgeConfig><JudgeItems /></JudgeConfig></Config>',
    '<Config><JudgeConfig><JudgeItems><JudgeItem><Text>题</Text><Answer>true</Answer><Answer>false</Answer></JudgeItem></JudgeItems></JudgeConfig></Config>'
  ]) assert.equal(parseQuestionConfig('Judge', xml(value)).questions.length, 0)
  const result = parseQuestionConfig('Choice', jsonConfig({ ChoiceQuestions: [{ Title: { Text: '题目' }, OptionItems: options.map(option => ({ ...option, Answer: false })) }] }))
  assert.equal(result.questions.length, 0)
})

test('question sessions survive reacquisition and reset without mutating saved definitions', () => {
  const definition = Object.freeze({ id: 'one' }) as ActivityDefinition
  const other = { id: 'one' } as ActivityDefinition
  const session = getQuestionSession(definition)
  session.index = 2
  session.selected = ['option-0']
  session.results.push(true)
  assert.equal(getQuestionSession(definition), session)
  assert.equal(getQuestionSession(other).index, 0)
  assert.deepEqual(resetQuestionSession(definition), { index: 0, selected: [], results: [] })
  assert.deepEqual(definition, { id: 'one' })
})
