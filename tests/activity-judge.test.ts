import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Window } from 'happy-dom'
import { parseSlideXML } from '../src/enbx/parser'
import { advanceJudge, judgeSession, resetJudge, selectJudge, startJudge } from '../src/viewer/activities/judge'

const window = new Window()
Object.assign(globalThis, { DOMParser: window.DOMParser, XMLSerializer: window.XMLSerializer })
export const judgeXml = (contents = '', interval = '1000') => `<Slide><Id>judge</Id><Width>1920</Width><Height>1080</Height>
  <Elements /><Activity><Id>a</Id><Key>Judge</Key><Config><JudgeConfig><Theme>判断比赛</Theme><Interval>${interval}</Interval>
  <JudgeItems><JudgeItem><Text>错误的说法</Text><Answer>False</Answer><Contents>${contents}</Contents></JudgeItem>
  <JudgeItem><Text>正确的说法</Text><Answer>True</Answer></JudgeItem></JudgeItems></JudgeConfig></Config></Activity></Slide>`

test('判断题读取毫秒计时、题目和嵌入元素，缺失/无效答案与计时不降级', () => {
  const slide = parseSlideXML(judgeXml('<Text><Id>embedded</Id><Width>300</Width><Height>100</Height><RichText><Text>内嵌题目</Text></RichText></Text>'))
  const definition = slide.activities![0]
  assert.deepEqual(definition.diagnostics, [])
  assert.equal(definition.judge?.interval, 1000)
  assert.equal(definition.judge?.title, '判断比赛')
  assert.equal(definition.questions![0].contents![0].type, 'text')
  for (const interval of ['0', '-1', 'abc', '']) assert.equal(parseSlideXML(judgeXml('', interval)).activities![0].playable, false)
  assert.equal(parseSlideXML(judgeXml().replace('<Answer>False</Answer>', '<Answer />')).activities![0].playable, false)
})

test('判断会话独立题序、可修改选择、统一超时结算、最后一题双倍与暂停恢复', () => {
  const definition = parseSlideXML(judgeXml()).activities![0]
  const saved = JSON.stringify(definition)
  startJudge(definition, () => 0.999)
  const session = judgeSession(definition)
  assert.deepEqual(session.players.map(player => player.order), [[0, 1], [1, 0]])
  assert.equal(selectJudge(definition, 0, false), false)
  advanceJudge(definition, 3000)
  selectJudge(definition, 0, true)
  selectJudge(definition, 0, false)
  selectJudge(definition, 1, true)
  assert.equal(session.players[0].score, 0)
  session.state = 'paused'
  advanceJudge(definition, 10000)
  assert.equal(session.remaining, 1000)
  assert.equal(selectJudge(definition, 0, true), false)
  session.state = 'running'
  advanceJudge(definition, 1000)
  assert.deepEqual(session.players.map(player => player.score), [1, 1])
  assert.equal(selectJudge(definition, 0, true), false)
  advanceJudge(definition, 2000)
  assert.equal(session.index, 1)
  assert.equal(session.players[0].selected, null)
  selectJudge(definition, 0, true)
  advanceJudge(definition, 1000)
  assert.deepEqual(session.players.map(player => player.score), [3, 1])
  assert.equal(session.players[1].result, 'timeout')
  assert.equal(session.players[1].timeouts, 1)
  advanceJudge(definition, 2000)
  assert.equal(session.state, 'finished')
  advanceJudge(definition, 10000)
  assert.equal(session.players[0].score, 3)
  assert.equal(judgeSession(definition), session)
  resetJudge(definition)
  assert.equal(session.state, 'ready')
  assert.deepEqual(session.players, [])
  assert.equal(JSON.stringify(definition), saved)
})

test('单题正确只得一分，错误和未答分别记录，大步推进也可结束', () => {
  const definition = parseSlideXML(judgeXml().replace('<JudgeItem><Text>正确的说法</Text><Answer>True</Answer></JudgeItem>', '')).activities![0]
  startJudge(definition)
  advanceJudge(definition, 3000)
  selectJudge(definition, 0, false)
  selectJudge(definition, 1, true)
  advanceJudge(definition, 3000)
  const session = judgeSession(definition)
  assert.equal(session.state, 'finished')
  assert.deepEqual(session.players.map(player => player.score), [1, 0])
  assert.equal(session.players[1].result, 'wrong')
  assert.equal(session.players[1].timeouts, 0)
})
