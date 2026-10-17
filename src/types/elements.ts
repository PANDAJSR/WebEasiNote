import type { Brush } from '../brushes'
import type { TextLine } from './text'

export interface ShapeElement {
  type: 'shape'
  id: string
  rawXml?: string
  x: number
  y: number
  width: number
  height: number
  rotation?: number
  opacity?: number
  backgroundColor: string
  backgroundBrush?: Brush
  foregroundColor: string
  foregroundBrush?: Brush
  path: string
  fillRule?: 'nonzero' | 'evenodd'
  geometryType: string
  adjusts?: number[]
  inlineText?: TextLine[]
  borderWidth?: number
  borderColor?: string
  lineType?: string
  dashStyle?: string
  strokeDashArray?: string
  arrowType?: string
  shadow?: {
    offset: number
    opacity: number
    blurRadius: number
    angle: number
    color: string
  }
  reflection?: {
    offsetY: number
    opacity: number
    gradientStart: number
    gradientEnd: number
  }
}

export interface PictureElement {
  type: 'picture'
  id: string
  rawXml?: string
  x: number
  y: number
  width: number
  height: number
  sourceId: string
  pictureName: string
  alpha: number
  rotation: number
  bright?: number
  contrast?: number
  saturation?: number
  clippingShape?: string
  pictureRahmenType?: string | number
  rahmenThickness?: number
  displayRegion?: {
    x: number
    y: number
    width: number
    height: number
  }
  pictureSize?: {
    width: number
    height: number
  }
}

export interface VideoElement {
  type: 'video'
  id: string
  rawXml?: string
  x: number
  y: number
  width: number
  height: number
  sourceId: string
  mediaName: string
  rotation: number
  volume: number
  clipStart: number
  isLoopPlay: boolean
  isAutoPlay: boolean
  isCrossSlidePlay: boolean
  stopPlayPageNumber: number
  thumbnailSourceId?: string
}

export interface TableCell {
  rowSpan: number
  columnSpan: number
  hMerged: boolean
  vMerged: boolean
  background?: string
  backgroundBrush?: Brush
  verticalAlignment?: 'Top' | 'Center' | 'Bottom'
  textLines: TextLine[]
}

export interface TableElement {
  type: 'table'
  id: string
  rawXml?: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  cellHPadding: number
  cellVPadding: number
  strokeColor: string
  strokeThickness: number
  headerFillColor?: string
  headerFillBrush?: Brush
  rowFillColors: string[]
  columnWidths: number[]
  rowHeights: number[]
  rows: TableCell[][]
}

export interface TopicSummarizeNode {
  id: string
  range: [number, number]
  title: string
  location?: { x: number; y: number }
}

export interface TopicRelationNode {
  id: string
  fromNodeId: string
  toNodeId: string
  title?: string
}

export interface TopicNode {
  id: string
  title: string
  textLines: TextLine[]
  textAlignment: 'Left' | 'Center' | 'Right'
  location: {
    x: number
    y: number
  }
  contentWidth: number
  contentHeight: number
  fillColor: string
  strokeColor: string
  textColor: string
  fontFamily: string
  fontSize: number
  children: TopicNode[]
}

export interface TopicElement {
  type: 'topic'
  id: string
  rawXml?: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  topicType: string
  mapType?: string | number
  branchType: string
  title: string
  textLines: TextLine[]
  textAlignment: 'Left' | 'Center' | 'Right'
  contentWidth: number
  contentHeight: number
  fillColor: string
  strokeColor: string
  textColor: string
  fontFamily: string
  fontSize: number
  branchColor: string
  children: TopicNode[]
  summarizeNodes?: TopicSummarizeNode[]
  relationNodes?: TopicRelationNode[]
}

export interface CylinderElement {
  type: 'cylinder'
  id: string
  rawXml?: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  edgeThickness: number
  edgeColor: string
  topFillColor: string
  sideFillColor: string
  bottomFillColor: string
}

export interface ConeElement {
  type: 'cone'
  id: string
  rawXml?: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  edgeThickness: number
  edgeColor: string
  sideFillColor: string
  baseFillColor: string
}

export interface CubeElement {
  type: 'cube'
  id: string
  rawXml?: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  edgeThickness: number
  edgeColor: string
  topFillColor: string
  frontFillColor: string
  rightFillColor: string
}
