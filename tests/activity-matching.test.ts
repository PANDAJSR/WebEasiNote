import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Window } from 'happy-dom'
import { parseMatchingConfig } from '../src/enbx/activities/matching-config'
import { checkMatchingAnswers, clearWrongMatchingPlacements, placeMatchingMaterial } from '../src/viewer/activities/matching'

const window = new Window()
const parse = (xml: string) => new window.DOMParser().parseFromString(xml, 'text/xml').documentElement as unknown as Element
const pair = (id: string, text: string, matchId: string, matchText: string, invalid = false) =>
  `<TextMatchItem><Id>${id}</Id><Text>${text}</Text><MatchId>${matchId}</MatchId><MatchText>${matchText}</MatchText><IsInvalid>${invalid}</IsInvalid></TextMatchItem>`
const textMatch = () => parseMatchingConfig('TextMatch', parse(`<Config><TextMatchConfig><MatchItems>${
  pair('c1', '甲', 'm1', '一') + pair('c2', '乙', 'm2', '二') + pair('', '', 'd', '干扰', true)
}</MatchItems></TextMatchConfig></Config>`))
const gap = () => parseMatchingConfig('GapFilling', parse(`<Config><GapFillingConfig><Stem><Id>stem</Id><Paragraphs>
  <Paragraph><Contents><PlainContent><Text>词语 </Text></PlainContent>
  <FillingContent><Items><FillingItem><Id>a</Id><Name>甲</Name></FillingItem></Items><TieNumber>7</TieNumber></FillingContent>
  <PlainContent><Text> 与 </Text></PlainContent>
  <FillingContent><Items><FillingItem><Id>b</Id><Name>乙</Name></FillingItem></Items><TieNumber>7</TieNumber></FillingContent>
  </Contents></Paragraph></Paragraphs></Stem><InvalidItems><FillingItem><Id>d</Id><Name>甲</Name></FillingItem></InvalidItems></GapFillingConfig></Config>`))

test('TextMatch links containers and materials separately and preserves distractors without phantom containers', () => {
  const result = textMatch()
  assert.deepEqual(result.diagnostics, [])
  assert.equal(result.categories.length, 2)
  assert.equal(result.matching.materials.length, 3)
  assert.deepEqual(result.linkedElements.find(link => link.id === 'd'), { id: 'd', role: 'material' })
  assert.equal(result.linkedElements.some(link => !link.id), false)
  const duplicate = parseMatchingConfig('TextMatch', parse(`<TextMatchConfig><MatchItems>${pair('c', '', 'a', '') + pair('c', '', 'b', '')}</MatchItems></TextMatchConfig>`))
  assert.ok(duplicate.diagnostics.some(message => message.includes('重复')))
})

test('matching placement is deferred until explicit check, moves a material, and replaces occupied slots', () => {
  const config = textMatch().matching
  const first = placeMatchingMaterial(config, {}, 'm2', 'c1')
  assert.deepEqual(first, { c1: 'm2' })
  const checked = checkMatchingAnswers(config, first)
  assert.deepEqual(checked.wrongTargetIds, ['c1'])
  assert.deepEqual(checked.emptyTargetIds, ['c2'])
  assert.equal(checked.complete, false)
  assert.deepEqual(clearWrongMatchingPlacements(config, first, checked), {})
  assert.deepEqual(placeMatchingMaterial(config, first, 'm2', 'c2'), { c2: 'm2' })
  assert.deepEqual(placeMatchingMaterial(config, first, 'm1', 'c1'), { c1: 'm1' })
  assert.equal(placeMatchingMaterial(config, first, 'unknown', 'c1'), first)
  assert.equal(checkMatchingAnswers(config, { c1: 'm1', c2: 'm2' }).complete, true)
  assert.equal(checkMatchingAnswers(config, { c1: 'm1', c2: 'm1' }).complete, false)
})

test('TextMatch accepts equivalent pure text only when caller confirms actual element text', () => {
  const config = textMatch().matching
  assert.deepEqual(checkMatchingAnswers(config, { c1: 'd' }).wrongTargetIds, ['c1'])
  assert.deepEqual(checkMatchingAnswers(config, { c1: 'd' }, { d: ' 一 ', m1: '一' }).correctTargetIds, ['c1'])
  assert.deepEqual(checkMatchingAnswers(config, { c1: 'm2' }, { c1: '同义', c2: ' 同义 ' }).correctTargetIds, ['c1'])
})

test('GapFilling keeps ordered embedded blanks and one real stem link; tied blanks accept swapped answers', () => {
  const result = gap()
  assert.deepEqual(result.diagnostics, [])
  assert.equal(result.matching.stemId, 'stem')
  assert.deepEqual(result.linkedElements.filter(link => link.role === 'container'), [{ id: 'stem', role: 'container' }])
  assert.deepEqual(result.matching.targets.map(target => target.hotspotIndex), [0, 1])
  assert.deepEqual(result.matching.paragraphs[0], [{ kind: 'text', text: '词语 ' }, { kind: 'blank', targetId: 'stem:gap:0' },
    { kind: 'text', text: ' 与 ' }, { kind: 'blank', targetId: 'stem:gap:1' }])
  const swapped = { 'stem:gap:0': 'b', 'stem:gap:1': 'a' }
  assert.equal(checkMatchingAnswers(result.matching, swapped).complete, true)
  const repeated = { 'stem:gap:0': 'a', 'stem:gap:1': 'd' }
  const checked = checkMatchingAnswers(result.matching, repeated, { a: '甲', b: '乙', d: '甲' })
  assert.deepEqual(checked.wrongTargetIds, ['stem:gap:1'])
  assert.equal(clearWrongMatchingPlacements(result.matching, repeated, checked), repeated)
})

test('legacy JSON contracts, missing configuration, unknown content, and invalid ties fail safely', () => {
  const json = { Stem: { Id: 's', Paragraphs: [{ Contents: [{ Text: '题' }, { Items: [{ Id: 'a', Name: '答' }], TieNumber: null }] }] }, InvalidItems: [] }
  const result = parseMatchingConfig('GapFilling', parse(`<Config>${JSON.stringify(json)}</Config>`))
  assert.deepEqual(result.diagnostics, [])
  assert.equal(result.matching.targets[0].tieNumber, undefined)
  assert.ok(parseMatchingConfig('TextMatch', parse('<Config>bad</Config>')).diagnostics.length)
  assert.ok(parseMatchingConfig('GapFilling', parse('<Config><GapFillingConfig /></Config>')).diagnostics.length)
  const malformed = parseMatchingConfig('GapFilling', parse('<GapFillingConfig><Stem><Id>s</Id><Paragraphs><Paragraph><Contents><Other/><FillingContent><TieNumber>bad</TieNumber></FillingContent></Contents></Paragraph></Paragraphs></Stem></GapFillingConfig>'))
  assert.ok(malformed.diagnostics.some(message => message.includes('TieNumber')))
  assert.ok(malformed.diagnostics.some(message => message.includes('题干内容')))
  assert.equal(checkMatchingAnswers({ ...result.matching, targets: [] }, {}).complete, false)
})
