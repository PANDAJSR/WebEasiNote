import type { SlideElement } from './slide'

/** 官方 UIContainerSaveInfo（View），子元素保留容器内坐标。 */
export interface ViewElement {
  type: 'view'
  id: string
  rawXml?: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  rotateOrigin: [number, number]
  localId: string
  layoutType: string
  permittedTransforms: string
  isHidden: boolean
  elements: SlideElement[]
}
