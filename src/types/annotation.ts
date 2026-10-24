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
  kind?: 'pen' | 'highlighter' | 'laser'
  height?: number
  tip?: 'ellipse' | 'rectangle'
  inkStyle?: 0 | 1 | 2 | 3
  velocityMix?: number
  minDistanceScale?: number
  highlighterOverlap?: boolean
  fadeEnabled?: boolean
  fadeDelay?: number
  fadeSpeed?: number
  /** 页面坐标到宿主 DIP 的比例，用于速度和距离阈值。 */
  inputScale?: number
  smoothing?: boolean
  smoothingQuality?: 0 | 1 | 2
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
  laserStartedAt?: number
  strokeDuration?: number
}

export type AnnotationTool = 'play' | 'select' | 'pen' | 'eraser' | 'stroke-eraser'
export type AnnotationCommand = 'clear' | 'undo' | 'redo'

export interface AnnotationState {
  tool: AnnotationTool
  brush: InkBrush
  eraser: { width: number; shape: 'circle' | 'rectangle' }
  frozen: boolean
}
