import type { ClassicalWorkElement, VocabularyPageElement, ResourceCardElement, QuestionCardElement,
  DictationCardElement, ChartElement, SavedSubjectText, ChartLabel, EnglishWordContentType } from '../types'
import { getDirectChildElement } from './xml-utils'
import { parseRichTextNode } from './text-parser'
import { parseMathFunction, parseSolarSystem } from './science-scenes'
import { subjectText as text, subjectNumber as number, subjectItems as items,
  subjectColor as color, subjectBoolean as boolean, subjectBounds as bounds } from './subject-xml'

export function parseComplexSubject(node: Element) {
  switch (node.tagName) {
    case 'MathFunction': return parseMathFunction(node)
    case 'SolarSystem': return parseSolarSystem(node)
    case 'ClassicalWorkElement': return parseClassicalWork(node)
    case 'VocabularyPage': return parseVocabularyPage(node)
    case 'QuestionCard': return parseQuestionCard(node)
    case 'DictationCard': return parseDictationCard(node)
    case 'Chart': return parseChart(node)
    case 'WebPresentationCard2': case 'TeachingDrawingBoardCard': case 'NoBookExperiment':
    case 'AIToolCard': case 'PhysicalGraph': return parseResourceCard(node)
    default: return null
  }
}

function savedText(node: Element | null, fallback = '', fontSize = 42): SavedSubjectText {
  const rich = node && (getDirectChildElement(node, 'RichText') || node)
  return { width: node ? number(node, 'EditorWidth') : 0,
    lines: rich && getDirectChildElement(rich, 'TextLines') ? parseRichTextNode(rich).textLines
      : [{ textAlignment: 'Left', textRuns: [{ text: fallback, fontFamily: 'KaiTi', fontSize,
        fontStyle: 'normal', fontWeight: 'normal', color: '#464646' }] }] }
}

export function parseClassicalWork(node: Element): ClassicalWorkElement {
  const content = items(node, 'Editors').map(item => savedText(item))
  const translations = items(node, 'TranslationExpandEditors').map(item => savedText(item))
  return { ...bounds(node), type: 'classicalWork', title: text(node, 'Title'), author: text(node, 'Author'),
    authorIntroduction: text(node, 'AuthorIntroduction'), introduction: text(node, 'WorksIntroduction'),
    showTitleIntroduction: boolean(node, 'IsTitleIntroductionShow'), showAuthorIntroduction: boolean(node, 'IsAnthorIntroductionShow'),
    themeColor: color(node, 'ThemeBrush', '#157c8c'), state: text(node, 'ClassicalWorksState'),
    content: content.length ? content : [savedText(null, text(node, 'Content'))],
    originals: items(node, 'TranslationOriginalEditors').map(item => savedText(item)),
    translations: translations.length ? translations : [savedText(null, text(node, 'Translation'), 36)] }
}

export function parseVocabularyPage(node: Element): VocabularyPageElement {
  const type = text(node, 'EnglishWordContentType')
  const types: EnglishWordContentType[] = ['Semantic', 'Phrase', 'Sentence', 'Synonym']
  return { ...bounds(node), type: 'vocabularyPage', word: text(node, 'Word'), soundmark: text(node, 'Pronounce'),
    pronounceSource: text(node, 'PronounceSource'), currentContentType: types.find(t => t === type) || types[Number(type)] || 'Semantic',
    semantics: items(node, 'Semantics').map(item => savedText(item)),
    phrases: items(node, 'Phrases').map(item => savedText(item)),
    sentences: items(node, 'Sentences').map(item => ({ text: savedText(getDirectChildElement(item, 'Sentence')),
      translation: savedText(getDirectChildElement(item, 'Translation')) })),
    synonyms: items(node, 'Synonym').map(item => ({ word: text(item, 'Word'), soundmark: text(item, 'Soundmark'),
      pronounceSource: text(item, 'PronounceUri'), text: savedText(getDirectChildElement(item, 'Semantics')) })) }
}

export function parseResourceCard(node: Element): ResourceCardElement {
  const kind = node.tagName as ResourceCardElement['kind']
  const layout = text(node, 'LayoutSize').split(',').map(Number)
  return { ...bounds(node), type: 'resourceCard', kind,
    title: text(node, 'Title') || text(node, 'ElementName'), subtitle: text(node, 'Text'),
    thumbnail: text(node, 'Thumbnail') || text(node, 'ThumbUri') || text(node, 'Thumb') || text(node, 'ImageUri'),
    icon: text(node, 'IconUri'), buttonImage: text(node, 'ButtonImageUri'), displayUrl: text(node, 'DisplayUrl'),
    buttonContent: text(node, 'ButtonContent') || '打开', titleVisible: boolean(node, 'IsTitleVisible', true),
    thumbnailVisible: boolean(node, 'IsThumbnailVisible', true),
    layoutWidth: layout[0] > 0 ? layout[0] : kind === 'TeachingDrawingBoardCard' ? 219 : 200,
    layoutHeight: layout[1] > 0 ? layout[1] : kind === 'TeachingDrawingBoardCard' ? 279 : kind === 'NoBookExperiment' ? 207 : 200 }
}

export function parseQuestionCard(node: Element): QuestionCardElement {
  return { ...bounds(node), type: 'questionCard', title: text(node, 'QuestionTypeName'),
    question: text(node, 'QuestionSource'), options: text(node, 'OptionSource'), answer: text(node, 'AnswerSource'),
    analysis: text(node, 'AnalysisSource'), isCollapsed: boolean(node, 'IsCollapsed', true),
    scaleRatio: number(node, 'ScaleRatio', 1) > 0 ? number(node, 'ScaleRatio', 1) : 1,
    imageScale: number(node, 'ImageScale', 1) > 0 ? number(node, 'ImageScale', 1) : 1 }
}

export function parseDictationCard(node: Element): DictationCardElement {
  const words = items(node, 'UnitsInfos').flatMap(unit => items(unit, 'WordsInfos').map(item => ({
    word: text(item, 'Word'), soundmark: text(item, 'PhoneticSymbol'), interpretation: text(item, 'WordInterpretation'),
    maleAudio: text(item, 'MaleAudioUri') || text(item, 'MaleDownloadAudioUrl'),
    femaleAudio: text(item, 'FemaleAudioUri') || text(item, 'FemaleDownloadAudioUrl') })))
  return { ...bounds(node), type: 'dictationCard', title: text(node, 'Title'), count: number(node, 'Count', words.length), words }
}

function label(node: Element): ChartLabel {
  return { text: text(node, 'Text'), color: color(node, 'Foreground', '#464646'), fontSize: number(node, 'FontSize', 16) }
}
export function parseChart(node: Element): ChartElement {
  const legend = getDirectChildElement(node, 'Legend')
  const coordinate = getDirectChildElement(node, 'CoordinateSkin')
  return { ...bounds(node), type: 'chart', chartType: text(node, 'ChartType'), dataType: text(node, 'DataType'),
    data: items(node, 'Data').map(item => ({ title: label(getDirectChildElement(item, 'Title') || item),
      values: items(item, 'Values').map(label) })), legend: legend ? items(legend, 'Contents').map(label) : [],
    legendVisible: !!legend && boolean(legend, 'IsVisible'),
    legendLocation: (legend ? text(legend, 'Location') : '').split(',').map(Number),
    legendWidth: legend ? number(legend, 'Width', 500) : 500,
    dataTagVisible: boolean(node, 'DataTagVisible'), colors: items(node, 'Materials').map(item => color(item, 'MaterialBrush', '#00c881')),
    coordinateColor: coordinate ? color(coordinate, 'CoordinateBrush', '#e6e6e6') : '#e6e6e6',
    initSize: text(node, 'ChartInitSize').split(',').map(Number), is3D: boolean(node, 'Is3DChart') }
}
