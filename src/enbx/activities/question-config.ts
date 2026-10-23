/** 题目数据独立于课件元素；局部 ID 只用于放映会话，不冒充资源 ID。 */
export interface ActivityOption {
  id: string
  text: string
  correct: boolean
}

export interface ActivityQuestion {
  id: string
  kind: 'choice' | 'judge'
  text: string
  options: ActivityOption[]
}

type RecordValue = Record<string, unknown>

function record(value: unknown): RecordValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('题目对象无效')
  return value as RecordValue
}

function list(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error('题目列表无效')
  return value
}

function requiredText(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error('题目或选项文字为空')
  return value
}

function boolean(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new Error('答案缺失或不是布尔值')
  return value
}

function child(parent: Element, name: string): Element | undefined {
  const matches = Array.from(parent.children).filter(node => node.localName === name)
  if (matches.length > 1) throw new Error(`重复字段 ${name}`)
  return matches[0]
}

function xmlBoolean(parent: Element, name: string): boolean {
  const node = child(parent, name)
  if (!node || node.children.length) throw new Error('答案缺失或格式无效')
  const value = node.textContent?.trim().toLowerCase()
  if (value !== 'true' && value !== 'false') throw new Error('答案缺失或不是布尔值')
  return value === 'true'
}

function xmlList(parent: Element, name: string, itemName: string): Element[] {
  const node = child(parent, name)
  if (!node || Array.from(node.children).some(item => item.localName !== itemName)) {
    throw new Error(`列表 ${name} 格式无效`)
  }
  return Array.from(node.children)
}

function xmlRichText(wrapper: Element | undefined): string {
  if (!wrapper) throw new Error('缺少富文本')
  if (wrapper.querySelector('ExtChar, ElementRootChar, Formula')) throw new Error('富文本包含未支持的内嵌内容')
  const root = child(wrapper, 'RichText') || wrapper
  const plain = child(root, 'Text')
  if (plain && !plain.children.length && plain.textContent?.trim()) return plain.textContent
  const lines = xmlList(root, 'TextLines', 'TextLine')
  return requiredText(lines.map(line => xmlList(line, 'TextRuns', 'TextRun').map(run => {
    const text = child(run, 'Text')
    if (!text || text.children.length) throw new Error('富文本包含未支持的内容')
    return text.textContent || ''
  }).join('')).join('\n'))
}

function jsonRichText(value: unknown): string {
  const rich = record(value)
  if (typeof rich.Text === 'string' && rich.Text.trim()) return rich.Text
  // 旧 JSON 使用 CLR 属性名；XML 使用 SaveInfoMember 名称。
  const lines = list(rich.Paragraphs ?? rich.TextLines)
  return requiredText(lines.map(line => list(record(line).TextRuns)
    .map(run => {
      const text = record(run).Text
      if (typeof text !== 'string') throw new Error('富文本内容无效')
      return text
    }).join('')).join('\n'))
}

function choiceQuestion(text: string, options: ActivityOption[], index: number): ActivityQuestion {
  if (options.length < 2 || !options.some(option => option.correct)) throw new Error('选择题需要至少两个选项和一个正确答案')
  return { id: `question-${index}`, kind: 'choice', text, options }
}

function judgeQuestion(text: string, answer: boolean, index: number): ActivityQuestion {
  return { id: `question-${index}`, kind: 'judge', text, options: [
    { id: 'true', text: '正确', correct: answer },
    { id: 'false', text: '错误', correct: !answer }
  ] }
}

function fromXml(key: string, config: Element): ActivityQuestion[] {
  const name = key === 'Choice' ? 'ChoiceActivityConfig' : 'JudgeConfig'
  const root = config.localName === name ? config : child(config, name)
    || (child(config, key === 'Choice' ? 'ChoiceQuestions' : 'JudgeItems') ? config : undefined)
  if (!root || (root !== config && config.children.length !== 1)) throw new Error('配置类型与玩法不一致')
  if (key === 'Choice') {
    return xmlList(root, 'ChoiceQuestions', 'ChoiceQuestion').map((question, index) => choiceQuestion(
      xmlRichText(child(question, 'Title')),
      xmlList(question, 'OptionItems', 'OptionItem').map((option, optionIndex) => ({
        id: `option-${optionIndex}`, text: xmlRichText(child(option, 'Option')), correct: xmlBoolean(option, 'Answer')
      })), index))
  }
  return xmlList(root, 'JudgeItems', 'JudgeItem').map((question, index) => {
    const contents = child(question, 'Contents')
    if (contents && (contents.children.length || contents.textContent?.trim())) {
      throw new Error('判断题含图形或媒体内容，暂不支持完整答题')
    }
    const text = child(question, 'Text')
    if (text?.children.length) throw new Error('判断题文字格式无效')
    return judgeQuestion(requiredText(text?.textContent), xmlBoolean(question, 'Answer'), index)
  })
}

function fromJson(key: string, config: Element): ActivityQuestion[] {
  const root = record(JSON.parse(config.textContent || ''))
  if (key === 'Choice') {
    return list(root.ChoiceQuestions).map((value, index) => {
      const question = record(value)
      return choiceQuestion(jsonRichText(question.Title), list(question.OptionItems).map((value, optionIndex) => {
        const option = record(value)
        return { id: `option-${optionIndex}`, text: jsonRichText(option.Option), correct: boolean(option.Answer) }
      }), index)
    })
  }
  return list(root.JudgeItems).map((value, index) => {
    const question = record(value)
    if (question.Contents != null && list(question.Contents).length) {
      throw new Error('判断题含图形或媒体内容，暂不支持完整答题')
    }
    return judgeQuestion(requiredText(question.Text), boolean(question.Answer), index)
  })
}

/** 任何题目无效时关闭整个活动，避免部分题目被静默丢弃。 */
export function parseQuestionConfig(key: string, config: Element): { questions: ActivityQuestion[]; diagnostics: string[] } {
  try {
    if (key === 'GroupCompetition') throw new Error('分组竞争的下落、连击、计时和素材关联规则暂未实现')
    if (key !== 'Choice' && key !== 'Judge') throw new Error(`未支持的题目玩法 ${key}`)
    const questions = config.children.length || config.localName !== 'Config'
      ? fromXml(key, config) : fromJson(key, config)
    if (!questions.length) throw new Error('题目列表为空')
    return { questions, diagnostics: [] }
  } catch (error) {
    return { questions: [], diagnostics: [error instanceof Error ? error.message : '题目配置无效'] }
  }
}
