export interface TextSelectionRange {
  start: number
  end: number
}

export interface TextStyleState {
  fontFamily: string
  fontSize: number
  color: string
  isBold: boolean
  isItalic: boolean
  isUnderline: boolean
}

export interface TextStyleCommand {
  id: number
  type:
    | 'set-font-family'
    | 'set-font-size'
    | 'adjust-font-size'
    | 'set-color'
    | 'toggle-bold'
    | 'toggle-italic'
    | 'toggle-underline'
  value?: string | number
}

export type TextStyleAction = Omit<TextStyleCommand, 'id'>
