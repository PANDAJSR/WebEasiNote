import type { SlideElement } from '../../types'

export interface PageChanges {
  replacements: Record<string, SlideElement>
  deleted: string[]
  order: string[]
  added: SlideElement[]
}
export interface PageHistory {
  present: PageChanges
  past: PageChanges[]
  future: PageChanges[]
}

export const emptyPage = (): PageChanges => ({ replacements: {}, deleted: [], order: [], added: [] })

export function resolvePage(base: SlideElement[], changes: PageChanges) {
  const deleted = new Set(changes.deleted)
  const elements = [...base, ...changes.added].filter(element => !deleted.has(element.id))
    .map(element => changes.replacements[element.id] || element)
  const lookup = new Map(elements.map(element => [element.id, element]))
  const ordered = changes.order.flatMap(id => {
    const element = lookup.get(id)
    lookup.delete(id)
    return element ? [element] : []
  })
  return [...ordered, ...lookup.values()]
}

export function commitPage(history: PageHistory | undefined, next: PageChanges): PageHistory {
  const present = history?.present || emptyPage()
  if (present === next && history) return history
  return { present: next, past: [...(history?.past || []), present].slice(-100), future: [] }
}

export function travelPage(history: PageHistory | undefined, redo = false): PageHistory | undefined {
  if (!history) return history
  const stack = redo ? history.future : history.past
  if (!stack.length) return history
  const present = stack[stack.length - 1]
  return redo
    ? { present, past: [...history.past, history.present], future: stack.slice(0, -1) }
    : { present, past: stack.slice(0, -1), future: [...history.future, history.present] }
}

/** 替换发生在原笔画的位置，面积擦不会把片段提升到其他课件上方。 */
export function replacePageInk(page: PageChanges, base: SlideElement[], replacements: Map<string, SlideElement[]>) {
  if (!replacements.size) return page
  const elements = resolvePage(base, page)
  return { ...page,
    deleted: [...new Set([...page.deleted, ...replacements.keys()])],
    added: [...page.added, ...[...replacements.values()].flat()],
    order: elements.flatMap(element => replacements.get(element.id)?.map(fragment => fragment.id) ?? [element.id]) }
}
