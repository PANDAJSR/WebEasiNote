import type { EnglishWordCardElement, EnglishWordContentType, WordSemantic, WordTranslation } from '../types'
import { getDirectChildElement, getDirectChildText } from './xml-utils'

const contentTypes: EnglishWordContentType[] = ['Semantic', 'Phrase', 'Sentence', 'Synonym']

function text(node: Element, name: string) {
  return getDirectChildText(node, name) || ''
}

function number(node: Element, name: string, fallback: number) {
  const value = Number.parseFloat(text(node, name))
  return Number.isFinite(value) ? value : fallback
}

function items(node: Element, name: string): Element[] {
  const parent = getDirectChildElement(node, name)
  return parent ? Array.from(parent.children) : []
}

function semantics(node: Element): WordSemantic[] {
  return items(node, 'Semantics').map(item => ({
    semantic: text(item, 'Semantic'), partOfSpeech: text(item, 'PartOfSpeech')
  }))
}

function translations(node: Element, name: string, field: string): WordTranslation[] {
  return items(node, name).map(item => ({ text: text(item, field), translation: text(item, 'Translation') }))
}

/** 字符串字段保留内容，不将课件中的词条解释为 HTML。 */
export function parseEnglishWordCardElement(node: Element): EnglishWordCardElement {
  const savedType = text(node, 'CurrentContentType').trim()
  const currentContentType = contentTypes.find(type => type === savedType)
    || contentTypes.find((_, index) => String(index) === savedType) || 'Semantic'
  return {
    type: 'englishWordCard',
    id: text(node, 'Id') || 'unknown',
    x: number(node, 'X', 0), y: number(node, 'Y', 0),
    width: Math.max(1, number(node, 'Width', 480)),
    height: Math.max(1, number(node, 'Height', 320)),
    rotation: number(node, 'Rotation', 0),
    word: text(node, 'Word'), soundmark: text(node, 'Soundmark'),
    semantics: semantics(node),
    sentences: translations(node, 'Sentences', 'Sentence'),
    phrases: translations(node, 'Phrases', 'Phrase'),
    synonyms: items(node, 'Synonym').map(item => ({
      word: text(item, 'Word'), soundmark: text(item, 'Soundmark'),
      pronounceSource: text(item, 'PronounceSource'), semantics: semantics(item)
    })),
    pronounceSource: text(node, 'PronounceSource'),
    remark: text(node, 'Remark'),
    isCollapsed: text(node, 'IsCollapsed').trim().toLowerCase() === 'true',
    scaleRatio: Math.max(0.01, number(node, 'ScaleRatio', 1)),
    currentContentType
  }
}
