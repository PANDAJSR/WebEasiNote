import type { CoursewareMetadata } from './courseware'
import type { TextElement } from './text'
import type {
  ShapeElement,
  PictureElement,
  VideoElement,
  TableElement,
  TopicElement,
  CylinderElement,
  ConeElement,
  CubeElement
} from './elements'
import type { GeometryElement, MathFormulaElement } from './geometry'

export interface UnknownElement {
  type: 'unknown'
  id: string
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
  trigger: string
  triggerSource: string
  number: number
  start: number
  end: number
  magnitude?: string
  durationMs: number
  delayMs: number
  repeatBehaviorRaw?: string
  repeatCount?: number
  targetId: string
  sourceElementId: string
}

export type SlideElement =
  | TextElement
  | ShapeElement
  | PictureElement
  | VideoElement
  | TableElement
  | TopicElement
  | CylinderElement
  | ConeElement
  | CubeElement
  | GeometryElement
  | MathFormulaElement
  | UnknownElement

export interface SlideData {
  id: string
  width: number
  height: number
  backgroundColor: string
  backgroundImage?: string
  transition?: {
    key: string
    durationMs: number
  }
  animationOrders: string[]
  animations: ElementAnimation[]
  issues: SlideIssue[]
  elements: SlideElement[]
}

export interface CoursewareData {
  metadata: CoursewareMetadata
  slides: SlideData[]
}
