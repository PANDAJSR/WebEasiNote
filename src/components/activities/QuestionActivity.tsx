import { useReducer } from 'react'
import { Button } from 'antd'
import type { ActivityDefinition } from '../../types'
import { getQuestionSession, gradeQuestion, resetQuestionSession } from './question-session'
import { questionStyles as styles } from './question-styles'

interface QuestionActivityProps {
  definition: ActivityDefinition
  active: boolean
}

/** 题目与选项直接位于幻灯片坐标层，会话跨页面重新挂载保留。 */
export function QuestionActivity({ definition, active }: QuestionActivityProps) {
  const [, refresh] = useReducer(value => value + 1, 0)
  const questions = definition.questions || []
  const session = getQuestionSession(definition)
  if (!active || !definition.playable || !questions.length) return null
  const question = questions[session.index]
  const submitted = session.results.length > session.index
  const finished = submitted && session.index === questions.length - 1
  const multiple = question.kind === 'choice' && question.options.filter(option => option.correct).length > 1

  function handleSelect(id: string) {
    if (submitted) return
    session.selected = multiple
      ? session.selected.includes(id) ? session.selected.filter(value => value !== id) : [...session.selected, id]
      : [id]
    refresh()
  }

  function handleSubmit() {
    if (submitted || !session.selected.length) return
    session.results.push(gradeQuestion(question, session.selected))
    refresh()
  }

  function handleNext() {
    if (!submitted || finished) return
    session.index += 1
    session.selected = []
    refresh()
  }

  function handleReset() {
    resetQuestionSession(definition)
    refresh()
  }

  return <section style={styles.panel} aria-label="课堂活动答题" data-activity-canvas={definition.key} data-activity-control='true' data-prevent-swipe='true'
    onPointerDown={event => event.stopPropagation()}
    onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}>
    <div style={styles.header}>
      <strong>{question.kind === 'judge' ? '判断题' : multiple ? '多选题' : '单选题'} · {session.index + 1} / {questions.length}</strong>
      <Button onClick={handleReset}>重新开始</Button>
    </div>
    <div style={styles.title}>{question.text}</div>
    <div style={styles.options}>
      {question.options.map((option, index) => <Button key={option.id} style={styles.option}
        type={session.selected.includes(option.id) ? 'primary' : 'default'}
        aria-pressed={session.selected.includes(option.id)} disabled={submitted}
        onClick={() => handleSelect(option.id)}>
        {question.kind === 'choice' ? `${String.fromCharCode(65 + index)}. ` : ''}{option.text}
      </Button>)}
    </div>
    <div style={styles.footer}>
      {!submitted && <Button type="primary" disabled={!session.selected.length} onClick={handleSubmit}>提交答案</Button>}
      {submitted && <span role="status">{session.results[session.index] ? '回答正确' : '回答错误'}
        {!session.results[session.index] && `，正确答案：${question.options.filter(option => option.correct).map(option => option.text).join('、')}`}
      </span>}
      {submitted && !finished && <Button type="primary" onClick={handleNext}>下一题</Button>}
      {finished && <strong role="status">已完成，答对 {session.results.filter(Boolean).length} / {questions.length} 题</strong>}
    </div>
  </section>
}

export default QuestionActivity
