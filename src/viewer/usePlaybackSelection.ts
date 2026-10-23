import { useEffect, useMemo, useState } from 'react'
import type { CoursewareMetadata, SlideData, SlideElement } from '../enbx/parser'
import { postToEnbxHost, subscribeToEnbxHost } from '../platform/host-bridge'
import { useHostImageInsertion } from './useHostImageInsertion'

export type PlaybackSelectionCommand = 'bring-front' | 'delete'
export interface PlaybackSelection {
  enabled: boolean
  onChange: (elements: SlideElement[]) => void
  onDuplicate: (elements: SlideElement[]) => void
  onCommand: (command: PlaybackSelectionCommand, elementIds: string[]) => void
}
interface PageChanges {
  replacements: Record<string, SlideElement>
  deleted: string[]
  front: string[]
  added: SlideElement[]
}

/** 放映操作仅保存在当前文档会话，不进入 XML 编辑或文件导出。 */
export function usePlaybackSelection(slides: SlideData[], currentIndex: number, metadata: CoursewareMetadata) {
  const [enabled, setEnabled] = useState(false)
  const [pages, setPages] = useState<Record<string, PageChanges>>({})
  const { images, resources } = useHostImageInsertion(slides[currentIndex], metadata, () => setEnabled(true))
  useEffect(() => {
    setPages({})
    setEnabled(false)
  }, [metadata])
  useEffect(() => {
    const unsubscribe = subscribeToEnbxHost(message => {
      if (message.type !== 'enbx:set-interaction-mode') return
      const active = message.mode === 'select'
      setEnabled(active)
      postToEnbxHost({ type: 'enbx:interaction-state', mode: active ? 'select' : 'play' })
    })
    postToEnbxHost({ type: 'enbx:interaction-ready' })
    return unsubscribe
  }, [metadata])
  const resolvedSlides = useMemo(() => slides.map(slide => {
    const changes = pages[slide.id]
    const inserted = images.filter(image => image.pageId === slide.id).map(image => image.element)
    if (!changes) return inserted.length ? { ...slide, elements: [...slide.elements, ...inserted] } : slide
    const elements = [...slide.elements, ...inserted, ...changes.added].filter(element => !changes.deleted.includes(element.id))
      .map(element => changes.replacements[element.id] || element)
    const front = new Set(changes.front)
    return { ...slide, elements: [...elements.filter(element => !front.has(element.id)),
      ...changes.front.flatMap(id => elements.filter(element => element.id === id))] }
  }), [slides, pages, images])
  const slideId = slides[currentIndex]?.id
  const updatePage = (update: (page: PageChanges) => PageChanges) => setPages(previous => ({
    ...previous, ...(slideId ? { [slideId]: update(previous[slideId] || { replacements: {}, deleted: [], front: [], added: [] }) } : {})
  }))
  const selection: PlaybackSelection = {
    enabled,
    onDuplicate: elements => updatePage(page => ({ ...page, added: [...page.added, ...elements],
      front: [...page.front, ...elements.map(element => element.id)] })),
    onChange: elements => updatePage(page => ({ ...page,
      replacements: { ...page.replacements, ...Object.fromEntries(elements.map(element => [element.id, element])) } })),
    onCommand: (command, ids) => updatePage(page => command === 'delete'
      ? { ...page, deleted: [...new Set([...page.deleted, ...ids])] }
      : { ...page, front: [...page.front.filter(id => !ids.includes(id)), ...ids] })
  }
  return { slides: resolvedSlides, selection, resources }
}
