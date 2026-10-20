export type EnglishWordContentType = 'Semantic' | 'Phrase' | 'Sentence' | 'Synonym'

export interface WordSemantic {
  semantic: string
  partOfSpeech: string
}

export interface WordTranslation {
  text: string
  translation: string
}

export interface WordSynonym {
  word: string
  soundmark: string
  pronounceSource: string
  semantics: WordSemantic[]
}

export interface EnglishWordCardElement {
  type: 'englishWordCard'
  id: string
  rawXml?: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  word: string
  soundmark: string
  semantics: WordSemantic[]
  sentences: WordTranslation[]
  phrases: WordTranslation[]
  synonyms: WordSynonym[]
  pronounceSource: string
  remark: string
  isCollapsed: boolean
  scaleRatio: number
  currentContentType: EnglishWordContentType
}

export interface PronounceResource {
  name: string
  source: string
}

export interface HanziInfo {
  hanzi: string
  pinyin: string
  pinyinList: string[]
  radical: string
  strokeCount: number
  strokeCode: string
}

interface ChineseCardBounds {
  id: string
  rawXml?: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
}

export interface HanziCardElement extends ChineseCardBounds {
  type: 'hanziCard'
  characters: HanziInfo[]
  pronounceList: PronounceResource[]
  isInHandWriteMode: boolean
}

export interface PinyinInfo {
  pinyin: string
  tonePinyin: string
  isTonePinyinsVisible: boolean
  pronounceList: PronounceResource[]
}

export interface PinyinCardElement extends ChineseCardBounds {
  type: 'pinyinCard'
  pinyins: PinyinInfo[]
  lineColor: string
  backgroundColor: string
  opacity: number
  isTonePinyinsVisible: boolean
}
