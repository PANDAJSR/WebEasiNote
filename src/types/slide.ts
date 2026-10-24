import type { CoursewareMetadata } from './courseware'
import type { ViewElement } from './view'
import type { InkElement } from './annotation'
import type { ActivityDefinition, ActivityElement } from './activities'
import type { TextElement } from './text'
import type {
  ShapeElement,
  PictureElement,
  VideoElement,
  AudioElement,
  FlashElement,
  TableElement,
  TopicElement,
  CylinderElement,
  ConeElement,
  CubeElement
} from './elements'
import type { GeometryElement, MathFormulaElement } from './geometry'
import type { EnglishWordCardElement, HanziCardElement, PinyinCardElement } from './subjects'
import type { ClassicalWorkElement, VocabularyPageElement, ResourceCardElement, QuestionCardElement,
  DictationCardElement, ChartElement, MathFunctionElement, SolarSystemElement } from './complex-subjects'

export interface UnknownElement {
  type: 'unknown'
  id: string
  rawXml?: string
  x: number
  y: number
  width: number
  height: number
  originalType: string
}

export interface SlideIssue {
  kind: 'unknown-element' | 'unknown-parameter' | 'missing-font'
  slideId: string
  elementType: string
  elementId: string
  name: string
  value?: string
}

export interface ElementAnimation {
  id: string
  type: string
  category: string
  effect?: string
  orientation?: string
  direction?: string
  path?: string
  trigger: string
  triggerSource: string
  number: number
  start: number
  end: number
  startSize?: { x: number; y: number }
  endSize?: { x: number; y: number }
  center?: { x: number; y: number }
  magnitude?: string
  frequency?: number
  accelerationRatio?: number
  decelerationRatio?: number
  durationMs: number
  delayMs: number
  repeatBehaviorRaw?: string
  repeatCount?: number
  targetId: string
  sourceElementId: string
}

export type SlideElement = (
  | ViewElement
  | InkElement
  | TextElement
  | ShapeElement
  | PictureElement
  | VideoElement
  | AudioElement
  | FlashElement
  | TableElement
  | TopicElement
  | CylinderElement
  | ConeElement
  | CubeElement
  | GeometryElement
  | MathFormulaElement
  | EnglishWordCardElement
  | HanziCardElement
  | PinyinCardElement
  | ClassicalWorkElement
  | VocabularyPageElement
  | ResourceCardElement
  | QuestionCardElement
  | DictationCardElement
  | ChartElement
  | MathFunctionElement
  | SolarSystemElement
  | ActivityElement
  | UnknownElement
) & {
  groupId?: string
  groupAncestorIds?: string[]
  staticCacheSafe?: boolean
  hyperlink?: string
  isLocked?: boolean
  canClone?: boolean
}

export interface SlideData {
  /** HTTP 页目录投影的状态；只有 core-ready 的正文允许提交为当前页。 */
  loadState?: 'unrequested' | 'loading' | 'core-ready' | 'error'
  id: string
  width: number
  height: number
  rawXml?: string
  backgroundColor: string
  backgroundImage?: string
  thumbnail?: string
  transition?: {
    key: string
    durationMs: number
  }
  animationOrders: string[]
  animations: ElementAnimation[]
  issues: SlideIssue[]
  elements: SlideElement[]
  activities?: ActivityDefinition[]
}

export interface CoursewareData {
  metadata: CoursewareMetadata
  slides: SlideData[]
}
