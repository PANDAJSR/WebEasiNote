export interface GeometryPoint {
  x: number
  y: number
}

export interface GeometryPrimitive {
  type: string
  points: GeometryPoint[]
  strokeColor: string
  strokeThickness: number
  lineType?: string
  segmentType?: string
  angleOfEllipse?: number
}

export interface GeometryAngle {
  value: number
  curPoint: GeometryPoint | null
  nextPoint: GeometryPoint | null
  prePoint: GeometryPoint | null
}

export interface GeometryMark {
  position: GeometryPoint
}

export interface GeometryElement {
  type: 'geometry'
  id: string
  rawXml?: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  geometries: GeometryPrimitive[]
  angles: GeometryAngle[]
  marks: GeometryMark[]
}

export interface MathFormulaElement {
  type: 'mathFormula'
  id: string
  rawXml?: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  color: string
  mathML: string
  fallbackText: string
}
