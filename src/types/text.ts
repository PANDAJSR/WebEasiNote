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
  autoNumberType?: string
  startAt?: number
}

export interface TextLine {
  textRuns: TextRun[]
  textAlignment: 'Left' | 'Center' | 'Right'
  textMarker?: string
  textMarkerStyle?: TextMarkerStyle
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
  x: number
  y: number
  width: number
  height: number
  rotation?: number
  borderThickness?: number
  borderType?: string
  arrangingType?: 'Horizontal' | 'Vertical'
  sizeToContent?: 'Manual' | 'Height' | 'WidthAndHeight'
  verticalTextAlignment?: 'Top' | 'Center' | 'Bottom'
  textLines: TextLine[]
  ruledPaper?: {
    lineColor: string
    backgroundColor: string
    opacity: number
  }
}
