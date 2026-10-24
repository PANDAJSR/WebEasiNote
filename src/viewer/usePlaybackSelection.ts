import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { AnnotationCommand, AnnotationState, CoursewareMetadata, InkElement, SlideData, SlideElement } from '../types'
import { postToEnbxHost, subscribeToEnbxHost } from '../platform/host-bridge'
import { useHostImageInsertion } from './useHostImageInsertion'
import { defaultAnnotationState, patchAnnotationState } from './annotation/annotation-state'
import { useLaserInk } from './annotation/useLaserInk'
import { commitPage, emptyPage, replacePageInk, resolvePage, travelPage,
  type PageChanges, type PageHistory } from './annotation/playback-page'

export type PlaybackSelectionCommand = 'bring-front' | 'delete'
export interface PlaybackAnnotation {
  state: AnnotationState
  epoch: number
  canUndo: boolean
  canRedo: boolean
  setState: (patch: Record<string, unknown>) => void
  command: (command: AnnotationCommand) => void
  addInk: (ink: InkElement) => void
  replaceInk: (replacements: Map<string, SlideElement[]>) => void
}
export interface PlaybackSelection {
  enabled: boolean
  annotation?: PlaybackAnnotation
  onChange: (elements: SlideElement[]) => void
  onDuplicate: (elements: SlideElement[]) => void
  onCommand: (command: PlaybackSelectionCommand, elementIds: string[]) => void
}

/** 课件和墨迹共用层序与按页事务；所有变更只属于当前放映会话。 */
export function usePlaybackSelection(slides: SlideData[], currentIndex: number, metadata: CoursewareMetadata, active = true) {
  const [state, setState] = useState(defaultAnnotationState)
  const [pages, setPages] = useState<Record<string, PageHistory>>({})
  const [epoch, setEpoch] = useState(0)
  const laser = useLaserInk(metadata)
  const pagesRef = useRef(pages)
  const stateRef = useRef(state)
  const sessionId = useRef('')
  const processed = useRef(new Set<string>())
  const { images, resources } = useHostImageInsertion(slides[currentIndex], metadata,
    () => updateState({ tool: 'select' }))
  const latest = useRef({ slides, currentIndex, images, active })
  latest.current = { slides, currentIndex, images, active }

  function updateState(patch: Record<string, unknown>) {
    if (!latest.current.active) return
    stateRef.current = patchAnnotationState(stateRef.current, patch)
    setState(stateRef.current)
    setEpoch(value => value + 1)
  }
  const baseFor = (slide: SlideData) => [...slide.elements,
    ...latest.current.images.filter(image => image.pageId === slide.id).map(image => image.element)]
  const updatePage = (update: (page: PageChanges, base: SlideElement[]) => PageChanges) => {
    const slide = latest.current.slides[latest.current.currentIndex]
    if (!slide || stateRef.current.frozen || !latest.current.active) return
    const history = pagesRef.current[slide.id]
    const page = history?.present || emptyPage()
    const next = update(page, baseFor(slide))
    if (next === page) return
    pagesRef.current = { ...pagesRef.current, [slide.id]: commitPage(history, next) }
    setPages(pagesRef.current)
  }
  const command = (command: AnnotationCommand) => {
    if (stateRef.current.frozen || !latest.current.active) return
    setEpoch(value => value + 1)
    const slide = latest.current.slides[latest.current.currentIndex]
    if (!slide) return
    if (command === 'clear') {
      laser.clear(slide.id)
      updatePage((page, base) => {
        const ids = resolvePage(base, page).filter(element => element.type === 'ink' && !element.isLocked).map(element => element.id)
        return ids.length ? { ...page, deleted: [...new Set([...page.deleted, ...ids])] } : page
      })
    } else {
      const history = travelPage(pagesRef.current[slide.id], command === 'redo')
      if (history) {
        pagesRef.current = { ...pagesRef.current, [slide.id]: history }
        setPages(pagesRef.current)
      }
    }
  }
  // 宿主监听器保持稳定；处理时读取当前页和最新状态，避免同一批命令丢失。
  const actions = useRef({ updateState, command })
  actions.current = { updateState, command }
  useLayoutEffect(() => {
    sessionId.current = crypto.randomUUID()
    processed.current.clear()
    pagesRef.current = {}
    stateRef.current = defaultAnnotationState()
    setPages({})
    setState(stateRef.current)
    setEpoch(value => value + 1)
  }, [metadata])
  useEffect(() => {
    const unsubscribe = subscribeToEnbxHost(message => {
      if (message.type === 'enbx:set-interaction-mode') {
        const active = message.mode === 'select'
        actions.current.updateState({ tool: active ? 'select' : 'play' })
        postToEnbxHost({ type: 'enbx:interaction-state', mode: active ? 'select' : 'play' })
        return
      }
      if (!['enbx:annotation-state', 'enbx:annotation-command'].includes(message.type)) return
      if (message.sessionId !== sessionId.current) return
      const page = latest.current.slides[latest.current.currentIndex]
      if (message.slideId !== undefined && message.slideId !== page?.id) return
      if (message.type === 'enbx:annotation-state') {
        actions.current.updateState(message)
        return
      }
      const valid = ['clear', 'undo', 'redo'].includes(String(message.command))
      if (typeof message.commandId !== 'string' || !message.commandId || !valid) return
      if (processed.current.has(message.commandId)) return
      processed.current.add(message.commandId)
      if (processed.current.size > 1000) processed.current.delete(processed.current.values().next().value!)
      const success = !stateRef.current.frozen && latest.current.active
      if (success) actions.current.command(message.command as AnnotationCommand)
      postToEnbxHost({ type: 'enbx:annotation-result', sessionId: sessionId.current, slideId: page?.id,
        commandId: message.commandId, success, error: success ? undefined : '当前页面已冻结或处于文件编辑模式' })
    })
    postToEnbxHost({ type: 'enbx:interaction-ready' })
    postToEnbxHost({ type: 'enbx:annotation-ready', protocolVersion: 1, sessionId: sessionId.current,
      tools: ['play', 'select', 'pen', 'eraser', 'stroke-eraser'] })
    return unsubscribe
  }, [metadata])
  const slideId = slides[currentIndex]?.id
  const history = pages[slideId]
  useEffect(() => {
    postToEnbxHost({ type: 'enbx:annotation-status', sessionId: sessionId.current, slideId,
      state, canUndo: !!history?.past.length, canRedo: !!history?.future.length })
  }, [slideId, state, history])
  const resolvedSlides = useMemo(() => slides.map(slide => {
    const inserted = images.filter(image => image.pageId === slide.id).map(image => image.element)
    const changes = pages[slide.id]?.present
    const transient = laser.pages[slide.id] ?? []
    if (!changes) return inserted.length || transient.length ? { ...slide, elements: [...slide.elements, ...inserted, ...transient] } : slide
    return { ...slide, elements: [...resolvePage([...slide.elements, ...inserted], changes), ...transient] }
  }), [slides, pages, images, laser.pages])

  const annotation: PlaybackAnnotation = {
    state, epoch, setState: updateState, command,
    canUndo: !!history?.past.length, canRedo: !!history?.future.length,
    addInk: ink => {
      if (ink.brush.kind === 'laser') {
        const slide = latest.current.slides[latest.current.currentIndex]
        if (slide && !stateRef.current.frozen && latest.current.active) laser.add(slide.id, ink)
      } else updatePage((page, base) => ({ ...page, added: [...page.added, ink],
        order: [...resolvePage(base, page).map(element => element.id), ink.id] }))
    },
    replaceInk: replacements => updatePage((page, base) => replacePageInk(page, base, replacements))
  }
  const selection: PlaybackSelection = {
    enabled: state.tool === 'select' && !state.frozen, annotation,
    onDuplicate: elements => updatePage((page, base) => ({ ...page, added: [...page.added, ...elements],
      order: [...resolvePage(base, page).map(element => element.id), ...elements.map(element => element.id)] })),
    onChange: elements => updatePage(page => ({ ...page,
      replacements: { ...page.replacements, ...Object.fromEntries(elements.map(element => [element.id, element])) } })),
    onCommand: (command, ids) => updatePage((page, base) => command === 'delete'
      ? { ...page, deleted: [...new Set([...page.deleted, ...ids])] }
      : { ...page, order: [...resolvePage(base, page).filter(element => !ids.includes(element.id)).map(element => element.id), ...ids] })
  }
  return { slides: resolvedSlides, selection, resources }
}
