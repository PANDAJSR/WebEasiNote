import type { TextLine } from './text'
import type { EnglishWordContentType } from './subjects'

export interface SubjectBounds {
  id: string
  rawXml?: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
}
export interface SavedSubjectText {
  width: number
  lines: TextLine[]
}
export interface ClassicalWorkElement extends SubjectBounds {
  type: 'classicalWork'
  title: string
  author: string
  authorIntroduction: string
  introduction: string
  showTitleIntroduction: boolean
  showAuthorIntroduction: boolean
  themeColor: string
  state: string
  content: SavedSubjectText[]
  originals: SavedSubjectText[]
  translations: SavedSubjectText[]
}
export interface VocabularyPageElement extends SubjectBounds {
  type: 'vocabularyPage'
  word: string
  soundmark: string
  pronounceSource: string
  currentContentType: EnglishWordContentType
  semantics: SavedSubjectText[]
  phrases: SavedSubjectText[]
  sentences: { text: SavedSubjectText; translation: SavedSubjectText }[]
  synonyms: { word: string; soundmark: string; pronounceSource: string; text: SavedSubjectText }[]
}
export interface ResourceCardElement extends SubjectBounds {
  type: 'resourceCard'
  kind: 'WebPresentationCard2' | 'TeachingDrawingBoardCard' | 'NoBookExperiment' | 'AIToolCard' | 'PhysicalGraph'
  title: string
  subtitle: string
  thumbnail: string
  icon: string
  buttonImage: string
  displayUrl: string
  buttonContent: string
  titleVisible: boolean
  thumbnailVisible: boolean
  layoutWidth: number
  layoutHeight: number
}
export interface QuestionCardElement extends SubjectBounds {
  type: 'questionCard'
  title: string
  question: string
  options: string
  answer: string
  analysis: string
  isCollapsed: boolean
  scaleRatio: number
  imageScale: number
}
export interface DictationWord {
  word: string
  soundmark: string
  interpretation: string
  maleAudio: string
  femaleAudio: string
}
export interface DictationCardElement extends SubjectBounds {
  type: 'dictationCard'
  title: string
  count: number
  words: DictationWord[]
}
export interface ChartLabel {
  text: string
  color: string
  fontSize: number
}
export interface ChartElement extends SubjectBounds {
  type: 'chart'
  chartType: string
  dataType: string
  data: { title: ChartLabel; values: ChartLabel[] }[]
  legend: ChartLabel[]
  legendVisible: boolean
  legendLocation: number[]
  legendWidth: number
  dataTagVisible: boolean
  colors: string[]
  coordinateColor: string
  initSize: number[]
  is3D: boolean
}

export interface MathFunctionElement extends SubjectBounds {
  type: 'mathFunction'
  visualBounds: number[]
  basicSize: number[]
  tagStep: number[]
  tagValueStep: number[]
  tagScale: number
  showTypes: string[]
  functions: { id: string; expression: string; color: string }[]
}

export interface SolarSystemElement extends SubjectBounds {
  type: 'solarSystem'
  system: string
  textureKey: string
  view: string
  state: string
  cameraPosition: number[]
  cameraLook: number[]
  cameraUp: number[]
  textureMatrix: number[]
  textures: Record<string, string>
  maps: Record<string, string>
}
