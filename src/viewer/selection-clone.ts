import type { SlideElement } from '../types'

/** 每次拖出生成独立元素/组合 ID；原始 XML 只用于文件编辑，不附给会话副本。 */
export function cloneSelection(elements: SlideElement[]): SlideElement[] {
  const groups = new Map<string, string>()
  const groupId = (id: string) => {
    if (!groups.has(id)) groups.set(id, crypto.randomUUID())
    return groups.get(id)!
  }
  return elements.map(element => ({ ...element, id: crypto.randomUUID(), rawXml: undefined,
    canClone: false, isLocked: false,
    groupId: element.groupId ? groupId(element.groupId) : undefined,
    groupAncestorIds: element.groupAncestorIds?.map(groupId) }))
}
