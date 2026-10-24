import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Window } from 'happy-dom'
import { parseCompetitionConfig } from '../src/enbx/activities/competition-config'
import { advanceCompetition, competitionDuration, createCompetitionPlayers, hitCompetitionMaterial } from '../src/viewer/activities/competition'
import type { CompetitionSession } from '../src/viewer/activities/competition'
import { parseSlideXML } from '../src/enbx/parser'

const window = new Window()
Object.assign(globalThis, { DOMParser: window.DOMParser, XMLSerializer: window.XMLSerializer })
const parse = (xml: string) => new DOMParser().parseFromString(xml, 'text/xml').documentElement
const config = { difficulty: 'High' as const, items: Array.from({ length: 8 }, (_, i) => ({
  id: `item-${i}`, text: `${i}`, correct: i < 6
})) }

test('竞争配置布尔答案和难度校验，实际素材引用必须完整', () => {
  const xml = '<Config><GroupCompetitionConfig><Difficulty>High</Difficulty><Items><GroupCompetitionItem><Id>m</Id><Text>甲</Text><IsCorrect>True</IsCorrect></GroupCompetitionItem></Items></GroupCompetitionConfig></Config>'
  assert.deepEqual(parseCompetitionConfig(parse(xml)), {
    competition: { difficulty: 'High', items: [{ id: 'm', text: '甲', correct: true }] }, diagnostics: []
  })
  assert.equal(parseCompetitionConfig(parse(xml.replace('<Difficulty>', '<InteractiveTheme>找出水果</InteractiveTheme><Difficulty>')))
    .competition?.title, '找出水果')
  const slide = `<Slide><Id>s</Id><Width>800</Width><Height>600</Height><Elements><ActivityItem><Id>m</Id><ActivityId>a</ActivityId><ResourceType>Material</ResourceType><Width>100</Width><Height>60</Height></ActivityItem></Elements><Activity><Id>a</Id><Key>GroupCompetition</Key>${xml}</Activity></Slide>`
  assert.equal(parseSlideXML(slide).activities![0].playable, true)
  assert.equal(parseSlideXML(slide.replace('<Id>m</Id><Text>', '<Id>missing</Id><Text>')).activities![0].playable, false)
  assert.ok(parseCompetitionConfig(parse(xml.replace('True', 'unknown'))).diagnostics.length)
  assert.ok(parseCompetitionConfig(parse(xml.replace('High', 'Extreme'))).diagnostics.length)
  assert.deepEqual(parseCompetitionConfig(parse(`<Config>${JSON.stringify({ Difficulty: 2,
    Items: [{ Id: 'm', Text: '甲', IsCorrect: true }] })}</Config>`)).competition,
  { difficulty: 'High', items: [{ id: 'm', text: '甲', correct: true }] })
})

test('准备倒数不推进游戏时间，暂停不消耗倒数，倒数中禁止点击计分', () => {
  const session: CompetitionSession = { players: createCompetitionPlayers(config, 2), difficulty: 'High',
    elapsed: 0, countdown: 3000, state: 'running' }
  assert.equal(hitCompetitionMaterial(session, 0, 0), false)
  advanceCompetition(session, 1000)
  assert.equal(session.countdown, 2000)
  assert.equal(session.elapsed, 0)
  session.state = 'paused'
  advanceCompetition(session, 1000)
  assert.equal(session.countdown, 2000)
  session.state = 'running'
  advanceCompetition(session, 2300)
  assert.equal(session.countdown, 0)
  assert.equal(session.elapsed, 300)
})

test('竞争各组独立序列、双倍标记、连击、重复点击、超时和暂停计时', () => {
  const original = JSON.stringify(config)
  const players = createCompetitionPlayers(config, 4, () => 0.999)
  assert.equal(players.length, 4)
  assert.equal(players[0].drops.filter(item => item.correct && item.double).length, 1)
  const session: CompetitionSession = { players, difficulty: 'High', elapsed: 0, state: 'running' }
  assert.equal(competitionDuration(session), 7 * 1750 + 7000)
  assert.equal(hitCompetitionMaterial(session, 0, 1), false)
  assert.equal(hitCompetitionMaterial(session, 0, 0), true)
  assert.equal(hitCompetitionMaterial(session, 0, 0), false)
  assert.equal(players[0].score, 10)
  assert.equal(players[1].score, 0)
  advanceCompetition(session, 1750)
  hitCompetitionMaterial(session, 0, 1)
  advanceCompetition(session, 1750)
  hitCompetitionMaterial(session, 0, 2)
  assert.equal(players[0].score, 32)
  assert.equal(players[0].maximumCombo, 3)
  session.elapsed = 4 * 1750
  hitCompetitionMaterial(session, 0, 4)
  assert.equal(players[0].score, 54)
  session.elapsed = 6 * 1750
  hitCompetitionMaterial(session, 0, 6)
  assert.equal(players[0].score, 49)
  assert.equal(players[0].combo, 0)
  assert.equal(hitCompetitionMaterial(session, 1, 0), false)
  session.state = 'paused'
  const elapsed = session.elapsed
  advanceCompetition(session, 10000)
  assert.equal(session.elapsed, elapsed)
  assert.equal(hitCompetitionMaterial(session, 1, 6), false)
  session.state = 'running'
  advanceCompetition(session, 100000)
  assert.equal(session.state, 'finished')
  assert.equal(session.elapsed, competitionDuration(session))
  assert.equal(JSON.stringify(config), original)
})
