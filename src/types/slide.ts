import type { CoursewareMetadata } from './courseware'
import type { TextElement } from './text'
import type {
  ShapeElement,
  PictureElement,
  VideoElement,
  FlashElement,
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
  | TextElement
  | ShapeElement
  | PictureElement
  | VideoElement
  | FlashElement
  | TableElement
  | TopicElement
  | CylinderElement
  | ConeElement
  | CubeElement
  | GeometryElement
  | MathFormulaElement
  | UnknownElement
) & {
  groupId?: string
  groupAncestorIds?: string[]
  staticCacheSafe?: boolean
}

export interface SlideData {
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
}

export interface CoursewareData {
  metadata: CoursewareMetadata
  slides: SlideData[]
}
