import type { Brush } from '../enbx/brushes'

export interface TextRun {
  text: string
  fontFamily: string
  fontSize: number
  fontStyle: 'normal' | 'italic'
  fontWeight: 'normal' | 'bold'
  color: string
  gradient?: {
    startPoint: { x: number; y: number }
    endPoint: { x: number; y: number }
    stops: Array<{ color: string; offset: number }>
    opacity: number
  }
  opacity?: number
  decoration?: 'None' | 'Underline'
  variants?: 'Normal' | 'Subscript' | 'Superscript'
  emphasisMark?: boolean
  underlineStyle?: 'solid' | 'wavy' | 'dashed' | 'dotted' | 'double'
  underlineColor?: string
  strikethrough?: boolean
  textEffects?: {
    frame?: {
      thickness: number
      opacity: number
      color: string
    }
    shadow?: {
      blur: number
      direction: number
      distance: number
      opacity: number
      color: string
    }
    reflection?: {
      depth: number
      distance: number
      opacity: number
    }
  }
}

export interface TextMarkerStyle {
  char?: string
  fontFamily?: string
  fontSize?: number
  autoNumberType?: string
  startAt?: number
}

export interface TextLineProperty {
  startOffset: number
  length: number
}

export interface TextLine {
  textRuns: TextRun[]
  textAlignment: 'Left' | 'Center' | 'Right'
  textMarker?: string
  textMarkerStyle?: TextMarkerStyle
  lines?: TextLineProperty[]
  indent?: number
  indentLevel?: number
  indentType?: string
  marginLeft?: number
  direction?: 'LeftToRight' | 'RightToLeft'
  lineSpacing?: number
  fixedLineSpacing?: number
  spaceBefore?: number
  spaceAfter?: number
}

export interface TextElement {
  type: 'text'
  id: string
  rawXml?: string
  x: number
  y: number
  width: number
  height: number
  rotation?: number
  borderThickness?: number
  borderType?: string
  borderColor?: string
  borderBrush?: Brush
  backgroundColor?: string
  backgroundBrush?: Brush
  arrangingType?: 'Horizontal' | 'Vertical'
  sizeToContent?: 'Manual' | 'Height' | 'WidthAndHeight'
  verticalTextAlignment?: 'Top' | 'Center' | 'Bottom'
  textLines: TextLine[]
  /** 放映会话的整体内容缩放，不对应 ENBX XML 字段；保留原始文字布局与字号。 */
  playbackContentScale?: number
  ruledPaper?: {
    lineColor: string
    backgroundColor: string
    opacity: number
  }
}

