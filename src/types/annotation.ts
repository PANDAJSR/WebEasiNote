/** 放映会话墨迹，不属于 ENBX 文件格式。坐标为笔画局部逻辑坐标。 */
export interface InkPoint {
  x: number
  y: number
  pressure: number
  time: number
}

export interface InkBrush {
  color: string
  width: number
  opacity: number
  pressure: boolean
}

export interface InkElement {
  type: 'ink'
  id: string
  rawXml?: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  sourceWidth: number
  sourceHeight: number
  points: InkPoint[]
  brush: InkBrush
}

export type AnnotationTool = 'play' | 'select' | 'pen' | 'eraser' | 'stroke-eraser'
export type AnnotationCommand = 'clear' | 'undo' | 'redo'

export interface AnnotationState {
  tool: AnnotationTool
  brush: InkBrush
  eraser: { width: number; shape: 'circle' | 'rectangle' }
  frozen: boolean
}
