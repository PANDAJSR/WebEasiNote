import assert from 'node:assert/strict'
import { test } from 'node:test'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { Window } from 'happy-dom'
import { QuestionActivity } from '../src/components/activities/QuestionActivity'
import type { ActivityDefinition } from '../src/types'
import type { ActivityQuestion } from '../src/enbx/activities/question-config'

const window = new Window()
Object.assign(globalThis, { window, document: window.document, HTMLElement: window.HTMLElement,
  Element: window.Element, SVGElement: window.SVGElement, ShadowRoot: window.ShadowRoot,
  getComputedStyle: window.getComputedStyle.bind(window), IS_REACT_ACT_ENVIRONMENT: true, React })

test('question panel submits once, advances, preserves remounted sessions, pauses and resets', async () => {
  const questions: ActivityQuestion[] = [
    { id: 'one', kind: 'choice', text: '选 A 和 C', options: [
      { id: 'a', text: '甲', correct: true }, { id: 'b', text: '乙', correct: false },
      { id: 'c', text: '丙', correct: true }
    ] },
    { id: 'two', kind: 'judge', text: '判断第二题', options: [
      { id: 'true', text: '正确', correct: false }, { id: 'false', text: '错误', correct: true }
    ] }
  ]
  const definition = Object.freeze({ id: 'test', key: 'Choice', playable: true, questions,
    categories: [], diagnostics: [], rawXml: '', mode: '', isPlayAudio: false }) as ActivityDefinition
  const saved = JSON.stringify(definition)
  const host = document.createElement('div')
  document.body.appendChild(host)
  let root = createRoot(host as unknown as HTMLElement)
  const render = (active = true) => act(async () => root.render(<QuestionActivity definition={definition} active={active} />))
  const click = async (label: string) => {
    const button = Array.from(host.querySelectorAll('button')).find(node => node.textContent?.replace(/\s/g, '') === label.replace(/\s/g, ''))
    assert.ok(button, `missing button: ${label}`)
    await act(async () => button.click())
  }
  await render()
  await click('A. 甲')
  await render(false)
  assert.equal(host.querySelector('section'), null)
  await render()
  assert.equal(host.querySelector('[aria-pressed="true"]')?.textContent, 'A. 甲')
  await click('C. 丙')
  await click('提交答案')
  assert.match(host.textContent, /回答正确/)
  assert.equal(host.querySelectorAll('button[disabled]').length, 3)
  await click('下一题')
  assert.match(host.textContent, /判断第二题/)
  await act(async () => root.unmount())
  root = createRoot(host as unknown as HTMLElement)
  await render()
  assert.match(host.textContent, /判断第二题/)
  await click('错误')
  await click('提交答案')
  assert.match(host.textContent, /已完成，答对 2 \/ 2 题/)
  await click('重新开始')
  assert.match(host.textContent, /选 A 和 C/)
  assert.equal(host.querySelectorAll('[aria-pressed="true"]').length, 0)
  assert.equal(JSON.stringify(definition), saved)
  await act(async () => root.unmount())
  host.remove()
})
