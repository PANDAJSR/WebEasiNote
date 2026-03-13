export interface CoursewareMetadata {
  type: 'enbx' | 'folder'
  name: string
  creator: string
  appVersion: string
  documentVersion: string
  modifiedDate: string | null
  slideCount: number
  resourceCount: number
  resources?: string[]
  slideFiles?: string[]
  slideIds: string[]
  raw: {
    board: unknown
    document: unknown
  }
}

export interface DocumentData {
  Name?: string
  Creator?: string
  AppVersion?: string
  DocumentVersion?: string
  ModifiedDateTime?: string
}
