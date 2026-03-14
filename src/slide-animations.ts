import type { ElementAnimation } from './types'
import { getDirectChildElement, getDirectChildText } from './xml-utils'

interface ParseSlideAnimationsResult {
  animationOrders: string[]
  animations: ElementAnimation[]
}

function parseNumber(value: string | null, fallback = 0): number {
  if (!value) return fallback
  const parsed = parseFloat(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function parseTicksToMs(value: string | null): number {
  const ticks = parseNumber(value, 0)
  if (!Number.isFinite(ticks) || ticks <= 0) return 0
  return Math.max(0, Math.round(ticks / 10000))
}

function findClosestElementId(node: Element | null): string | null {
  let current: Element | null = node
  while (current) {
    const id = getDirectChildText(current, 'Id')
    if (id) return id
    current = current.parentElement
  }
  return null
}

function parseAnimationNode(
  animationNode: Element,
  sourceElementId: string,
  sourceIndex: number
): ElementAnimation & { sourceIndex: number } {
  const id = getDirectChildText(animationNode, 'Id') || `${sourceElementId}-animation-${sourceIndex}`
  const targetId =
    getDirectChildText(animationNode, 'TargetId')
    || getDirectChildText(animationNode, 'ElementId')
    || sourceElementId
  const repeatBehaviorRaw = getDirectChildText(animationNode, 'RepeatBehavior') || undefined
  const repeatCountRaw = parseFloat(repeatBehaviorRaw || '')
  const repeatCount = Number.isFinite(repeatCountRaw) ? repeatCountRaw : undefined

  return {
    id,
    type: getDirectChildText(animationNode, 'Type') || 'Unknown',
    category: getDirectChildText(animationNode, 'Category') || 'Unknown',
    effect: getDirectChildText(animationNode, 'Effect') || undefined,
    orientation: getDirectChildText(animationNode, 'Orientation') || undefined,
    trigger: getDirectChildText(animationNode, 'Trigger') || 'Click',
    triggerSource: getDirectChildText(animationNode, 'TriggerSource') || '',
    number: parseInt(getDirectChildText(animationNode, 'Number') || '0', 10),
    start: parseNumber(getDirectChildText(animationNode, 'Start'), 0),
    end: parseNumber(getDirectChildText(animationNode, 'End'), 1),
    magnitude: getDirectChildText(animationNode, 'Magnitude') || undefined,
    durationMs: parseTicksToMs(getDirectChildText(animationNode, 'Duration')),
    delayMs: parseTicksToMs(getDirectChildText(animationNode, 'Delay')),
    repeatBehaviorRaw,
    repeatCount,
    targetId,
    sourceElementId,
    sourceIndex
  }
}

export function parseSlideAnimations(slideElement: Element): ParseSlideAnimationsResult {
  const animationOrders = Array.from(
    slideElement.querySelectorAll(':scope > AnimationOrders > Item')
  )
    .map(node => node.textContent?.trim() || '')
    .filter(Boolean)
  const orderRank = new Map(animationOrders.map((id, index) => [id, index]))
  const collected: Array<ElementAnimation & { sourceIndex: number }> = []
  const elementsNode = getDirectChildElement(slideElement, 'Elements')
  if (!elementsNode) {
    return {
      animationOrders,
      animations: []
    }
  }

  const stack: Element[] = Array.from(elementsNode.children)
  let sourceIndex = 0
  while (stack.length > 0) {
    const current = stack.shift() as Element
    if (current.tagName === 'Group') {
      const childElementsNode = getDirectChildElement(current, 'Elements')
      if (childElementsNode) {
        stack.unshift(...Array.from(childElementsNode.children))
      }
    }

    const sourceElementId = getDirectChildText(current, 'Id') || `${current.tagName.toLowerCase()}-${sourceIndex}`
    const animationsNode = getDirectChildElement(current, 'Animations')
    if (!animationsNode) {
      sourceIndex += 1
      continue
    }

    Array.from(animationsNode.children).forEach(childNode => {
      if (childNode.tagName !== 'Animation') return
      const sourceHostId = findClosestElementId(childNode.parentElement) || sourceElementId
      collected.push(parseAnimationNode(childNode, sourceHostId, sourceIndex))
    })
    sourceIndex += 1
  }

  collected.sort((a, b) => {
    const orderA = orderRank.get(a.id)
    const orderB = orderRank.get(b.id)
    const hasOrderA = orderA !== undefined
    const hasOrderB = orderB !== undefined
    if (hasOrderA && hasOrderB) return orderA - orderB
    if (hasOrderA) return -1
    if (hasOrderB) return 1

    if (a.number !== b.number) return a.number - b.number
    return a.sourceIndex - b.sourceIndex
  })

  return {
    animationOrders,
    animations: collected.map(({ sourceIndex: _, ...animation }) => animation)
  }
}
