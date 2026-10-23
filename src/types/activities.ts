import type { Brush } from '../enbx/brushes'
import type { SlideElement } from './slide'
import type { TextElement } from './text'
import type { MatchingConfig } from '../enbx/activities/matching-config'
import type { ActivityQuestion } from '../enbx/activities/question-config'
import type { CompetitionConfig } from '../enbx/activities/competition-config'

export interface ActivityElement {
  type: 'activity'
  id: string
  rawXml?: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  activityId: string
  resourceId: string
  role: 'background' | 'container' | 'material' | 'unknown'
  background?: Brush
  stroke?: Brush
  strokeThickness: number
  roundRadius: number
  text?: TextElement
  contents: SlideElement[]
}

export interface ActivityCategory {
  id: string
  name: string
  items: { id: string; name: string }[]
}

/** 保存定义保持只读；答题位置和已完成素材由放映会话单独管理。 */
export interface ActivityDefinition {
  id: string
  key: string
  isPlayAudio: boolean
  mode: string
  categories: ActivityCategory[]
  matching?: MatchingConfig
  questions?: ActivityQuestion[]
  competition?: CompetitionConfig
  playable: boolean
  diagnostics: string[]
  rawXml: string
}
